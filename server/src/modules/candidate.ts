import { Router } from 'express';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { ATTEMPT_STATUS_LABELS, type AttemptStatus } from '@lokus/shared';
import { isEmailConfirmed } from '../auth/routes';
import type { AppDeps } from '../context';
import { attempts, candidateProfiles, consentEvents, invitations, organizations, resultShares, shareRequests, simulationVersions } from '../db/schema';
import { SIMULATION_VERSION_ID, TALENT_POOL_CONSENT_VERSION } from '../db/seed';
import { audit } from '../lib/audit';
import { conflict, forbidden, notFound } from '../lib/errors';
import { parseBody, parseParams } from '../lib/http';
import { createAttempt } from '../services/attempts';
import { RESULT_SHARE_CONSENT_VERSION } from './invitations';

/**
 * Candidate area. Candidates see status only — never scores, ratings, gates or outcomes (workbook Outcome_Rules
 * "Visibility"). Mounted at /api/candidate behind requireCandidate.
 */
export function candidateRouter(deps: AppDeps): Router {
  const r = Router();

  r.get('/home', async (req, res) => {
    const userId = req.auth!.user.id;
    const rows = await deps.db
      .select({ a: attempts, simTitle: simulationVersions.title, orgName: organizations.name })
      .from(attempts)
      .innerJoin(simulationVersions, eq(simulationVersions.id, attempts.simulationVersionId))
      .leftJoin(invitations, eq(invitations.id, attempts.invitationId))
      .leftJoin(organizations, eq(organizations.id, invitations.orgId))
      .where(eq(attempts.candidateId, userId))
      .orderBy(desc(attempts.createdAt));
    const pending = await deps.db
      .select({ id: shareRequests.id, org_name: organizations.name, created_at: shareRequests.createdAt })
      .from(shareRequests)
      .innerJoin(organizations, eq(organizations.id, shareRequests.orgId))
      .where(and(eq(shareRequests.candidateId, userId), eq(shareRequests.status, 'pending')));
    res.json({
      email_verified: isEmailConfirmed(deps, req.auth!.user),
      attempts: rows.map(({ a, simTitle, orgName }) => ({
        id: a.id,
        simulation_title: simTitle,
        org_name: orgName ?? null,
        origin: a.origin,
        status: a.status,
        status_label: ATTEMPT_STATUS_LABELS[a.status as AttemptStatus],
        deadline_at: a.deadlineAt,
        started_at: a.startedAt,
        submitted_at: a.t2SubmittedAt,
        created_at: a.createdAt,
      })),
      share_requests: pending,
    });
  });

  r.get('/profile', async (req, res) => {
    const [p] = await deps.db.select().from(candidateProfiles).where(eq(candidateProfiles.userId, req.auth!.user.id));
    res.json({ name: req.auth!.user.name, email: req.auth!.user.email, headline: p?.headline ?? '', location: p?.location ?? '' });
  });

  r.put('/profile', async (req, res) => {
    const body = parseBody(z.object({ headline: z.string().trim().max(160).default(''), location: z.string().trim().max(120).default('') }), req);
    await deps.db
      .insert(candidateProfiles)
      .values({ userId: req.auth!.user.id, ...body })
      .onConflictDoUpdate({ target: candidateProfiles.userId, set: { ...body, updatedAt: deps.clock.now() } });
    res.json({ ok: true });
  });

  r.get('/privacy', async (req, res) => {
    const userId = req.auth!.user.id;
    const [p] = await deps.db.select().from(candidateProfiles).where(eq(candidateProfiles.userId, userId));
    // While the testing-phase open pool is on, any submitted result is listed, invited ones included.
    const open = deps.config.openTalentPool;
    const [poolable] = await deps.db
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.candidateId, userId), open ? eq(attempts.status, 'submitted') : eq(attempts.origin, 'self')));
    const shares = await deps.db
      .select({ id: resultShares.id, org_name: organizations.name, basis: resultShares.basis, granted_at: resultShares.grantedAt, revoked_at: resultShares.revokedAt })
      .from(resultShares)
      .innerJoin(attempts, eq(attempts.id, resultShares.attemptId))
      .innerJoin(organizations, eq(organizations.id, resultShares.orgId))
      .where(eq(attempts.candidateId, userId));
    res.json({
      talent_pool: { listed: p?.talentPoolListed ?? false, eligible: Boolean(poolable), all_results: open, consent_version: TALENT_POOL_CONSENT_VERSION },
      shares,
    });
  });

  /**
   * Join the talent pool (self-sign-up results only); every change is an append-only consent event. Listing is part of
   * the terms a candidate accepts, so leaving is refused; accounts from before those terms can still opt in here.
   */
  r.put('/talent-pool', async (req, res) => {
    const { listed } = parseBody(z.object({ listed: z.boolean() }), req);
    if (!listed) throw conflict('talent_pool_required', 'Sharing your self-started result with employers is part of the Lokus terms and cannot be turned off.');
    const userId = req.auth!.user.id;
    await deps.db.transaction(async (tx) => {
      await tx
        .insert(candidateProfiles)
        .values({ userId, talentPoolListed: listed })
        .onConflictDoUpdate({ target: candidateProfiles.userId, set: { talentPoolListed: listed, updatedAt: deps.clock.now() } });
      await tx.insert(consentEvents).values({ userId, kind: 'talent_pool', action: listed ? 'grant' : 'withdraw', textVersion: TALENT_POOL_CONSENT_VERSION, ip: req.ip });
    });
    res.json({ listed });
  });

  /** Revoke an employer's access to a shared result. */
  r.post('/shares/:id/revoke', async (req, res) => {
    const { id } = parseParams(z.object({ id: z.uuid() }), req);
    const userId = req.auth!.user.id;
    const [share] = await deps.db
      .select({ s: resultShares })
      .from(resultShares)
      .innerJoin(attempts, eq(attempts.id, resultShares.attemptId))
      .where(and(eq(resultShares.id, id), eq(attempts.candidateId, userId), isNull(resultShares.revokedAt)));
    if (!share) throw notFound('Share not found.');
    await deps.db.transaction(async (tx) => {
      await tx.update(resultShares).set({ revokedAt: deps.clock.now() }).where(eq(resultShares.id, id));
      await tx.insert(consentEvents).values({ userId, kind: 'result_share', action: 'withdraw', textVersion: RESULT_SHARE_CONSENT_VERSION, orgId: share.s.orgId, attemptId: share.s.attemptId, ip: req.ip });
    });
    res.json({ ok: true });
  });

  r.get('/share-requests', async (req, res) => {
    const rows = await deps.db
      .select({ id: shareRequests.id, org_name: organizations.name, status: shareRequests.status, created_at: shareRequests.createdAt, decided_at: shareRequests.decidedAt })
      .from(shareRequests)
      .innerJoin(organizations, eq(organizations.id, shareRequests.orgId))
      .where(eq(shareRequests.candidateId, req.auth!.user.id))
      .orderBy(desc(shareRequests.createdAt));
    res.json({ share_requests: rows });
  });

  async function ownPendingRequest(id: string, userId: string) {
    const [sr] = await deps.db.select().from(shareRequests).where(and(eq(shareRequests.id, id), eq(shareRequests.candidateId, userId)));
    if (!sr) throw notFound('Request not found.');
    if (sr.status !== 'pending') throw conflict('already_decided', 'You have already answered this request.');
    return sr;
  }

  r.post('/share-requests/:id/approve', async (req, res) => {
    const { id } = parseParams(z.object({ id: z.uuid() }), req);
    const userId = req.auth!.user.id;
    const sr = await ownPendingRequest(id, userId);
    await deps.db.transaction(async (tx) => {
      const [consent] = await tx
        .insert(consentEvents)
        .values({ userId, kind: 'result_share', action: 'grant', textVersion: RESULT_SHARE_CONSENT_VERSION, orgId: sr.orgId, attemptId: sr.attemptId, ip: req.ip })
        .returning();
      await tx.insert(resultShares).values({ attemptId: sr.attemptId, orgId: sr.orgId, basis: 'reuse_consent', consentEventId: consent.id }).onConflictDoNothing();
      await tx.update(shareRequests).set({ status: 'approved', decidedAt: deps.clock.now() }).where(eq(shareRequests.id, id));
    });
    await audit(deps.db, req, { action: 'share_request.approved', targetType: 'share_request', targetId: id, orgId: sr.orgId });
    res.json({ ok: true });
  });

  r.post('/share-requests/:id/decline', async (req, res) => {
    const { id } = parseParams(z.object({ id: z.uuid() }), req);
    const sr = await ownPendingRequest(id, req.auth!.user.id);
    await deps.db.update(shareRequests).set({ status: 'declined', decidedAt: deps.clock.now() }).where(eq(shareRequests.id, id));
    await audit(deps.db, req, { action: 'share_request.declined', targetType: 'share_request', targetId: id, orgId: sr.orgId });
    res.json({ ok: true });
  });

  /** Open self-sign-up attempt (talent-pool route). Requires a verified email when REQUIRE_EMAIL_VERIFICATION is on. */
  r.post('/attempts', async (req, res) => {
    parseBody(z.object({ consent: z.literal(true) }), req);
    if (!isEmailConfirmed(deps, req.auth!.user)) throw forbidden('email_unverified', 'Confirm your email address before starting an assessment.');
    const attempt = await deps.db.transaction((tx) => createAttempt(tx, { candidateId: req.auth!.user.id, simulationVersionId: SIMULATION_VERSION_ID, origin: 'self' }));
    res.status(201).json({ attempt_id: attempt.id });
  });

  return r;
}
