import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { loadOrgFor, requireOrgOwner, toAuthUser } from '../auth/middleware';
import { passwordSchema } from '../auth/routes';
import { createSession } from '../auth/sessions';
import type { AppDeps } from '../context';
import { memberships, orgInvitations, organizations, users } from '../db/schema';
import { audit } from '../lib/audit';
import { hashPassword, randomToken, sha256 } from '../lib/crypto';
import { emails, sendEmail } from '../lib/emails';
import { badRequest, conflict, gone, notFound } from '../lib/errors';
import { normaliseEmail, parseBody, parseParams } from '../lib/http';

const TEAM_INVITE_TTL = 7 * 24 * 60 * 60 * 1000;

/** Creates (or refreshes) a team invitation and emails the link. Used by owners and by Lokus admins onboarding an org. */
export async function inviteTeamMember(deps: AppDeps, input: { orgId: string; orgName: string; email: string; role: 'owner' | 'recruiter'; invitedBy: string | null }): Promise<string> {
  const email = normaliseEmail(input.email);
  const [existingUser] = await deps.db.select({ id: users.id, kind: users.kind }).from(users).where(eq(users.email, email));
  if (existingUser && existingUser.kind !== 'employer') throw conflict('email_in_use', 'This email belongs to a candidate or staff account and cannot join an employer team.');
  if (existingUser) {
    const [m] = await deps.db.select({ orgId: memberships.orgId }).from(memberships).where(eq(memberships.userId, existingUser.id));
    if (m) throw conflict('already_member', m.orgId === input.orgId ? 'This person is already a member of your team.' : 'This person already belongs to another organisation.');
  }
  const token = randomToken(32);
  await deps.db
    .update(orgInvitations)
    .set({ status: 'revoked' })
    .where(and(eq(orgInvitations.orgId, input.orgId), eq(orgInvitations.email, email), eq(orgInvitations.status, 'pending')));
  const [inv] = await deps.db
    .insert(orgInvitations)
    .values({ orgId: input.orgId, email, role: input.role, tokenHash: sha256(token), expiresAt: new Date(deps.clock.now().getTime() + TEAM_INVITE_TTL), invitedBy: input.invitedBy })
    .returning({ id: orgInvitations.id });
  await sendEmail(deps, email, emails.teamInvite({ orgName: input.orgName, role: input.role, url: `${deps.config.appUrl}/team-invite?token=${token}` }));
  return inv.id;
}

/** Employer team management, mounted at /api/org behind requireEmployer. */
export function teamRouter(deps: AppDeps): Router {
  const r = Router();

  r.get('/', async (req, res) => {
    const org = req.auth!.org!;
    const [row] = await deps.db.select().from(organizations).where(eq(organizations.id, org.id));
    res.json({ id: row.id, name: row.name, slug: row.slug, status: row.status, invite_deadline_days: row.inviteDeadlineDays, role: org.role });
  });

  r.patch('/', requireOrgOwner, async (req, res) => {
    const body = parseBody(z.object({ name: z.string().trim().min(2).max(120).optional(), invite_deadline_days: z.number().int().min(1).max(90).optional() }), req);
    const org = req.auth!.org!;
    await deps.db
      .update(organizations)
      .set({ ...(body.name ? { name: body.name } : {}), ...(body.invite_deadline_days ? { inviteDeadlineDays: body.invite_deadline_days } : {}) })
      .where(eq(organizations.id, org.id));
    await audit(deps.db, req, { action: 'org.updated', targetType: 'organization', targetId: org.id, orgId: org.id, details: body });
    res.json({ ok: true });
  });

  r.get('/members', async (req, res) => {
    const orgId = req.auth!.org!.id;
    const members = await deps.db
      .select({ user_id: users.id, name: users.name, email: users.email, role: memberships.role, joined_at: memberships.createdAt, last_login_at: users.lastLoginAt })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.orgId, orgId))
      .orderBy(asc(users.name));
    const pending = await deps.db
      .select({ id: orgInvitations.id, email: orgInvitations.email, role: orgInvitations.role, expires_at: orgInvitations.expiresAt, created_at: orgInvitations.createdAt })
      .from(orgInvitations)
      .where(and(eq(orgInvitations.orgId, orgId), eq(orgInvitations.status, 'pending')));
    res.json({ members, pending_invitations: pending });
  });

  r.post('/members/invite', requireOrgOwner, async (req, res) => {
    const body = parseBody(z.object({ email: z.email().max(254), role: z.enum(['owner', 'recruiter']) }), req);
    const org = req.auth!.org!;
    const id = await inviteTeamMember(deps, { orgId: org.id, orgName: org.name, email: body.email, role: body.role, invitedBy: req.auth!.user.id });
    await audit(deps.db, req, { action: 'team.invited', targetType: 'org_invitation', targetId: id, orgId: org.id, details: { role: body.role } });
    res.status(201).json({ id });
  });

  r.post('/members/invitations/:id/revoke', requireOrgOwner, async (req, res) => {
    const { id } = parseParams(z.object({ id: z.uuid() }), req);
    const org = req.auth!.org!;
    const [inv] = await deps.db.select().from(orgInvitations).where(and(eq(orgInvitations.id, id), eq(orgInvitations.orgId, org.id)));
    if (!inv) throw notFound('Invitation not found.');
    await deps.db.update(orgInvitations).set({ status: 'revoked' }).where(eq(orgInvitations.id, id));
    res.json({ ok: true });
  });

  r.delete('/members/:userId', requireOrgOwner, async (req, res) => {
    const { userId } = parseParams(z.object({ userId: z.uuid() }), req);
    const org = req.auth!.org!;
    const rows = await deps.db.select().from(memberships).where(eq(memberships.orgId, org.id));
    const target = rows.find((m) => m.userId === userId);
    if (!target) throw notFound('Member not found.');
    if (target.role === 'owner' && rows.filter((m) => m.role === 'owner').length === 1) throw conflict('last_owner', 'An organisation needs at least one owner.');
    await deps.db.delete(memberships).where(and(eq(memberships.orgId, org.id), eq(memberships.userId, userId)));
    await audit(deps.db, req, { action: 'team.removed', targetType: 'user', targetId: userId, orgId: org.id });
    res.json({ ok: true });
  });

  return r;
}

/** Public: preview and accept a team invitation (creates an employer account when needed). */
export function publicTeamInvitesRouter(deps: AppDeps): Router {
  const r = Router();
  const tokenBody = z.object({ token: z.string().min(20).max(200) });

  async function byToken(token: string) {
    const [row] = await deps.db
      .select({ inv: orgInvitations, orgName: organizations.name, orgStatus: organizations.status })
      .from(orgInvitations)
      .innerJoin(organizations, eq(organizations.id, orgInvitations.orgId))
      .where(eq(orgInvitations.tokenHash, sha256(token)));
    if (!row) throw notFound('This invitation link is not valid.');
    if (row.inv.status !== 'pending') throw gone('invitation_used', 'This invitation is no longer valid.');
    if (row.inv.expiresAt.getTime() < deps.clock.now().getTime()) throw gone('invitation_expired', 'This invitation has expired. Ask your team owner to resend it.');
    if (row.orgStatus !== 'active') throw gone('invitation_unavailable', 'This invitation is no longer available.');
    return row;
  }

  r.post('/preview', async (req, res) => {
    const { token } = parseBody(tokenBody, req);
    const { inv, orgName } = await byToken(token);
    const [account] = await deps.db.select({ id: users.id }).from(users).where(eq(users.email, inv.email));
    res.json({ org_name: orgName, email: inv.email, role: inv.role, account_exists: Boolean(account) });
  });

  r.post('/accept', async (req, res) => {
    const body = parseBody(tokenBody.extend({ name: z.string().trim().min(1).max(120).optional(), password: passwordSchema.optional() }), req);
    const { inv } = await byToken(body.token);
    const now = deps.clock.now();
    let [user] = await deps.db.select().from(users).where(eq(users.email, inv.email));
    let newSession = false;
    if (!user) {
      if (!body.name || !body.password) throw badRequest('account_details_required', 'Enter your name and choose a password to create your account.');
      [user] = await deps.db.insert(users).values({ email: inv.email, name: body.name, kind: 'employer', passwordHash: await hashPassword(body.password), emailVerifiedAt: now }).returning();
      newSession = true;
    } else {
      if (req.auth?.user.id !== user.id) throw conflict('login_required', 'Sign in with the invited email address to accept this invitation.');
      if (user.kind !== 'employer') throw conflict('email_in_use', 'This email belongs to a candidate or staff account.');
    }
    await deps.db.transaction(async (tx) => {
      const [m] = await tx.select().from(memberships).where(eq(memberships.userId, user.id));
      if (m) throw conflict('already_member', 'This account already belongs to an organisation.');
      await tx.insert(memberships).values({ userId: user.id, orgId: inv.orgId, role: inv.role });
      await tx.update(orgInvitations).set({ status: 'accepted', acceptedAt: now, acceptedBy: user.id }).where(eq(orgInvitations.id, inv.id));
    });
    if (newSession) {
      const sessionId = await createSession(deps, user, req, res);
      req.auth = { sessionId, user: toAuthUser(user), mfaVerified: false, org: await loadOrgFor(deps.db, user) };
    }
    await audit(deps.db, req, { action: 'team.joined', targetType: 'organization', targetId: inv.orgId, orgId: inv.orgId, details: { role: inv.role } });
    res.json({ ok: true, org_id: inv.orgId });
  });

  return r;
}
