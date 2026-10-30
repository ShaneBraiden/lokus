import { Router } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { ATTEMPT_STATUS_LABELS, type AttemptStatus } from '@lokus/shared';
import { directPassword, findOrCreateAccount } from '../auth/directAccounts';
import { passwordSchema } from '../auth/routes';
import { createSession } from '../auth/sessions';
import { loadOrgFor, toAuthUser } from '../auth/middleware';
import type { AppDeps } from '../context';
import { attempts, candidateProfiles, consentEvents, invitations, organizations, resultShares, shareRequests, simulationVersions, users } from '../db/schema';
import { PRIVACY_VERSION, SIMULATION_VERSION_ID, TALENT_POOL_CONSENT_VERSION, TERMS_VERSION } from '../db/seed';
import { audit } from '../lib/audit';
import { hashPassword, randomToken, sha256 } from '../lib/crypto';
import { emails, sendEmail } from '../lib/emails';
import { badRequest, conflict, gone, notFound } from '../lib/errors';
import { normaliseEmail, parseBody, parseParams } from '../lib/http';
import { createAttempt, findLiveAttempt } from '../services/attempts';

const DAY = 24 * 60 * 60 * 1000;
/** How long an emailed invitation link stays valid. */
const INVITE_LINK_TTL = 30 * DAY;
export const RESULT_SHARE_CONSENT_VERSION = '2026-10';

const idParam = z.object({ id: z.uuid() });

function formatDate(d: Date | null): string | null {
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : null;
}

async function sendInvite(deps: AppDeps, inv: { id: string; email: string; name: string; deadlineAt: Date | null }, orgName: string): Promise<void> {
  const token = randomToken(32);
  await deps.db.update(invitations).set({ tokenHash: sha256(token), lastSentAt: deps.clock.now(), expiresAt: new Date(deps.clock.now().getTime() + INVITE_LINK_TTL) }).where(eq(invitations.id, inv.id));
  const [sim] = await deps.db.select({ title: simulationVersions.title }).from(simulationVersions).where(eq(simulationVersions.id, SIMULATION_VERSION_ID));
  await sendEmail(deps, inv.email, emails.candidateInvite({ candidateName: inv.name, orgName, simulationTitle: sim?.title ?? 'a work simulation', url: `${deps.config.appUrl}/invite?token=${token}`, deadline: formatDate(inv.deadlineAt) }));
}

/** Accepts an invitation for a candidate: a new attempt shared with the employer, or a share request for a live one. */
async function acceptInvitation(deps: AppDeps, inv: typeof invitations.$inferSelect, userId: string, ip: string | undefined) {
  const now = deps.clock.now();
  return deps.db.transaction(async (tx) => {
    const live = await findLiveAttempt(tx, userId, inv.simulationVersionId);
    if (live) {
      // One attempt per version: the employer gets the existing result only if the candidate approves.
      const [share] = await tx.insert(shareRequests).values({ orgId: inv.orgId, candidateId: userId, attemptId: live.id, invitationId: inv.id }).returning();
      await tx.update(invitations).set({ status: 'accepted', acceptedAt: now, acceptedBy: userId, attemptId: live.id, shareRequestId: share.id }).where(eq(invitations.id, inv.id));
      return { attempt_id: live.id, share_request_id: share.id, shared: false };
    }
    const attempt = await createAttempt(tx, { candidateId: userId, simulationVersionId: inv.simulationVersionId, origin: 'invite', invitationId: inv.id, deadlineAt: inv.deadlineAt });
    const [consent] = await tx
      .insert(consentEvents)
      .values({ userId, kind: 'result_share', action: 'grant', textVersion: RESULT_SHARE_CONSENT_VERSION, orgId: inv.orgId, attemptId: attempt.id, ip })
      .returning();
    await tx.insert(resultShares).values({ attemptId: attempt.id, orgId: inv.orgId, basis: 'invite', consentEventId: consent.id });
    await tx.update(invitations).set({ status: 'accepted', acceptedAt: now, acceptedBy: userId, attemptId: attempt.id }).where(eq(invitations.id, inv.id));
    return { attempt_id: attempt.id, share_request_id: null, shared: true };
  });
}

/** Status the employer sees for an invitation, without revealing whether the candidate has a prior attempt elsewhere. */
function inviteView(inv: typeof invitations.$inferSelect, attempt: { status: string } | null, share: { status: string } | null) {
  let progress: string;
  if (inv.status === 'revoked') progress = 'Revoked';
  else if (inv.status === 'pending') progress = 'Invited';
  // Before the candidate decides, a share request looks exactly like a fresh, not-yet-started attempt.
  else if (share && share.status !== 'approved') progress = share.status === 'pending' ? ATTEMPT_STATUS_LABELS.not_started : ATTEMPT_STATUS_LABELS.void;
  else progress = attempt ? ATTEMPT_STATUS_LABELS[attempt.status as AttemptStatus] : ATTEMPT_STATUS_LABELS.not_started;
  return {
    id: inv.id,
    email: inv.email,
    name: inv.name,
    status: inv.status,
    progress,
    attempt_id: share?.status === 'approved' || (!share && inv.attemptId) ? inv.attemptId : null,
    deadline_at: inv.deadlineAt,
    lockdown: inv.lockdown,
    created_at: inv.createdAt,
    accepted_at: inv.acceptedAt,
    last_sent_at: inv.lastSentAt,
  };
}

/** Employer: invite candidates (single or bulk), list, resend and revoke. Mounted behind requireEmployer. */
export function employerInvitationsRouter(deps: AppDeps): Router {
  const r = Router();

  r.get('/', async (req, res) => {
    const orgId = req.auth!.org!.id;
    const rows = await deps.db.select().from(invitations).where(eq(invitations.orgId, orgId)).orderBy(desc(invitations.createdAt));
    const attemptIds = rows.map((i) => i.attemptId).filter((x): x is string => Boolean(x));
    const shareIds = rows.map((i) => i.shareRequestId).filter((x): x is string => Boolean(x));
    const attemptRows = attemptIds.length ? await deps.db.select({ id: attempts.id, status: attempts.status }).from(attempts).where(inArray(attempts.id, attemptIds)) : [];
    const shareRows = shareIds.length ? await deps.db.select({ id: shareRequests.id, status: shareRequests.status }).from(shareRequests).where(inArray(shareRequests.id, shareIds)) : [];
    const byAttempt = new Map(attemptRows.map((a) => [a.id, a]));
    const byShare = new Map(shareRows.map((s) => [s.id, s]));
    res.json({ invitations: rows.map((i) => inviteView(i, i.attemptId ? byAttempt.get(i.attemptId) ?? null : null, i.shareRequestId ? byShare.get(i.shareRequestId) ?? null : null)) });
  });

  r.post('/', async (req, res) => {
    const body = parseBody(
      z.object({
        candidates: z.array(z.object({ email: z.email().max(254), name: z.string().trim().max(120).default('') })).min(1).max(200),
        deadline_days: z.number().int().min(1).max(90).optional(),
      }),
      req,
    );
    const org = req.auth!.org!;
    const [orgRow] = await deps.db.select().from(organizations).where(eq(organizations.id, org.id));
    const now = deps.clock.now();
    const deadlineDays = body.deadline_days ?? orgRow.inviteDeadlineDays;
    const results: { email: string; status: 'invited' | 'already_invited' | 'duplicate_in_batch'; id?: string }[] = [];
    const seen = new Set<string>();
    for (const c of body.candidates) {
      const email = normaliseEmail(c.email);
      if (seen.has(email)) {
        results.push({ email, status: 'duplicate_in_batch' });
        continue;
      }
      seen.add(email);
      const [existing] = await deps.db
        .select({ id: invitations.id })
        .from(invitations)
        .where(and(eq(invitations.orgId, org.id), eq(invitations.email, email), inArray(invitations.status, ['pending', 'accepted'])));
      if (existing) {
        results.push({ email, status: 'already_invited', id: existing.id });
        continue;
      }
      const [inv] = await deps.db
        .insert(invitations)
        .values({
          orgId: org.id,
          email,
          name: c.name,
          simulationVersionId: SIMULATION_VERSION_ID,
          tokenHash: sha256(randomToken(32)),
          expiresAt: new Date(now.getTime() + INVITE_LINK_TTL),
          deadlineAt: new Date(now.getTime() + deadlineDays * DAY),
          lockdown: true,
          invitedBy: req.auth!.user.id,
        })
        .returning();
      if (deps.config.directAccounts) {
        // Testing phase: no email; the candidate account is created (or reused) and the invitation accepted for them.
        const user = await findOrCreateAccount(deps, { email, name: c.name, kind: 'candidate' });
        if (user.kind === 'candidate') await acceptInvitation(deps, inv, user.id, req.ip);
      } else {
        await sendInvite(deps, inv, org.name);
      }
      await audit(deps.db, req, { action: 'invitation.created', targetType: 'invitation', targetId: inv.id, orgId: org.id, details: { lockdown: true } });
      results.push({ email, status: 'invited', id: inv.id });
    }
    res.status(201).json({ results, ...directPassword(deps) });
  });

  async function ownInvitation(orgId: string, id: string) {
    const [inv] = await deps.db.select().from(invitations).where(and(eq(invitations.id, id), eq(invitations.orgId, orgId)));
    if (!inv) throw notFound('Invitation not found.');
    return inv;
  }

  r.post('/:id/resend', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const inv = await ownInvitation(req.auth!.org!.id, id);
    if (inv.status !== 'pending') throw conflict('invitation_not_pending', 'Only pending invitations can be resent.');
    await sendInvite(deps, inv, req.auth!.org!.name);
    await audit(deps.db, req, { action: 'invitation.resent', targetType: 'invitation', targetId: inv.id, orgId: inv.orgId });
    res.json({ ok: true });
  });

  r.post('/:id/revoke', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const inv = await ownInvitation(req.auth!.org!.id, id);
    if (inv.status !== 'pending') throw conflict('invitation_not_pending', 'Only pending invitations can be revoked.');
    await deps.db.update(invitations).set({ status: 'revoked', revokedAt: deps.clock.now() }).where(eq(invitations.id, inv.id));
    await audit(deps.db, req, { action: 'invitation.revoked', targetType: 'invitation', targetId: inv.id, orgId: inv.orgId });
    res.json({ ok: true });
  });

  return r;
}

async function invitationByToken(deps: AppDeps, token: string) {
  const [row] = await deps.db
    .select({ inv: invitations, orgName: organizations.name, orgStatus: organizations.status, simTitle: simulationVersions.title })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.orgId))
    .innerJoin(simulationVersions, eq(simulationVersions.id, invitations.simulationVersionId))
    .where(eq(invitations.tokenHash, sha256(token)));
  if (!row) throw notFound('This invitation link is not valid.');
  if (row.inv.status === 'revoked') throw gone('invitation_revoked', 'This invitation has been withdrawn by the employer.');
  if (row.inv.status === 'accepted') throw gone('invitation_used', 'This invitation has already been accepted. Sign in to continue.');
  if (row.inv.expiresAt.getTime() < deps.clock.now().getTime()) throw gone('invitation_expired', 'This invitation link has expired. Ask the employer to resend it.');
  if (row.orgStatus !== 'active') throw gone('invitation_unavailable', 'This invitation is no longer available.');
  return row;
}

/** Public: preview and accept a candidate invitation. Tokens travel in request bodies so they never reach URL logs. */
export function publicInvitesRouter(deps: AppDeps): Router {
  const r = Router();
  const tokenBody = z.object({ token: z.string().min(20).max(200) });

  r.post('/preview', async (req, res) => {
    const { token } = parseBody(tokenBody, req);
    const { inv, orgName, simTitle } = await invitationByToken(deps, token);
    const [account] = await deps.db.select({ id: users.id, kind: users.kind }).from(users).where(eq(users.email, inv.email));
    res.json({
      org_name: orgName,
      simulation_title: simTitle,
      email: inv.email,
      name: inv.name,
      deadline_at: inv.deadlineAt,
      lockdown: inv.lockdown,
      account_exists: Boolean(account),
      signed_in_as_invitee: req.auth?.user.email === inv.email,
    });
  });

  r.post('/accept', async (req, res) => {
    const body = parseBody(
      tokenBody.extend({ name: z.string().trim().min(1).max(120).optional(), password: passwordSchema.optional(), consent: z.literal(true) }),
      req,
    );
    const { inv, orgName } = await invitationByToken(deps, body.token);
    const now = deps.clock.now();
    let [user] = await deps.db.select().from(users).where(eq(users.email, inv.email));
    let newSession = false;

    if (!user) {
      if (!body.name || !body.password) throw badRequest('account_details_required', 'Enter your name and choose a password to create your account.');
      [user] = await deps.db
        .insert(users)
        .values({ email: inv.email, name: body.name, kind: 'candidate', passwordHash: await hashPassword(body.password), emailVerifiedAt: now })
        .returning();
      await deps.db.insert(candidateProfiles).values({ userId: user.id, talentPoolListed: true });
      await deps.db.insert(consentEvents).values([
        { userId: user.id, kind: 'terms', action: 'grant', textVersion: TERMS_VERSION, ip: req.ip },
        { userId: user.id, kind: 'privacy', action: 'grant', textVersion: PRIVACY_VERSION, ip: req.ip },
        { userId: user.id, kind: 'talent_pool', action: 'grant', textVersion: TALENT_POOL_CONSENT_VERSION, ip: req.ip },
      ]);
      newSession = true;
    } else {
      if (req.auth?.user.id !== user.id) throw conflict('login_required', 'Sign in with the invited email address to accept this invitation.');
      if (user.kind !== 'candidate') throw conflict('not_a_candidate_account', 'This email belongs to an employer or staff account and cannot take assessments.');
      if (!user.emailVerifiedAt) await deps.db.update(users).set({ emailVerifiedAt: now }).where(eq(users.id, user.id));
    }

    const outcome = await acceptInvitation(deps, inv, user.id, req.ip);

    if (newSession) {
      const sessionId = await createSession(deps, user, req, res);
      req.auth = { sessionId, user: toAuthUser(user), mfaVerified: false, org: await loadOrgFor(deps.db, user) };
    }
    await audit(deps.db, req, { action: 'invitation.accepted', targetType: 'invitation', targetId: inv.id, orgId: inv.orgId, details: { share_request: Boolean(outcome.share_request_id) } });
    res.json({ ...outcome, org_name: orgName });
  });

  return r;
}
