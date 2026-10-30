import { Router } from 'express';
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { buildEvidence, type AssessmentResult, type CriterionResult } from '#engine';
import { ATTEMPT_STATUS_LABELS, OUTCOME_LABELS, type AttemptStatus, type Outcome } from '@lokus/shared';
import type { AppDeps } from '../context';
import { assessmentResults, attempts, grDispositions, invitations, organizations, resultShares, retakeGrants, reviewItems, reviewerRatings, users } from '../db/schema';
import { audit } from '../lib/audit';
import { badRequest, conflict, notFound } from '../lib/errors';
import { parseBody, parseParams, parseQuery } from '../lib/http';
import { createAttempt } from '../services/attempts';
import { listEvents, toEngineEvents, verifyChain, withAttemptLock } from '../services/eventStore';
import { buildEvidenceView } from '../services/evidenceView';
import { latestResult, latestVersions, recomputeInTx, recomputeResult } from '../services/scoring';
import { loadScoringPackage } from '../services/scoringPackages';

const DAY = 24 * 60 * 60 * 1000;
const idParam = z.object({ id: z.uuid() });
const ACTIVE = ['not_started', 'w1_in_progress', 'w1_submitted', 'w2_in_progress'];

const score = (q: number | null | undefined) => (q === null || q === undefined ? null : q / 4);

/** Admin: platform overview, the attempts explorer, attempt actions, and criterion-level comparison. */
export function adminAttemptsRouter(deps: AppDeps): Router {
  const r = Router();

  r.get('/overview', async (_req, res) => {
    const now = deps.clock.now().getTime();
    const byStatus = await deps.db.select({ status: attempts.status, n: count() }).from(attempts).groupBy(attempts.status);
    const [recent] = await deps.db.select({ n: count() }).from(attempts).where(gte(attempts.t2SubmittedAt, new Date(now - 7 * DAY)));
    const queue = await deps.db.select({ status: reviewItems.status, createdAt: reviewItems.createdAt }).from(reviewItems).where(inArray(reviewItems.status, ['open', 'in_progress']));
    const lv = latestVersions(deps.db);
    const latest = await deps.db
      .select({ status: assessmentResults.status, outcome: assessmentResults.outcome, gates: sql<AssessmentResult['gates']>`${assessmentResults.result}->'gates'` })
      .from(assessmentResults)
      .innerJoin(lv, and(eq(lv.attemptId, assessmentResults.attemptId), eq(lv.version, assessmentResults.resultVersion)))
      .innerJoin(attempts, eq(attempts.id, assessmentResults.attemptId))
      .where(eq(attempts.status, 'submitted'));
    const [orgs] = await deps.db.select({ n: count() }).from(organizations).where(eq(organizations.status, 'active'));
    const [candidates] = await deps.db.select({ n: count() }).from(users).where(eq(users.kind, 'candidate'));
    const outcomes: Record<string, number> = {};
    for (const l of latest) {
      const key = l.status === 'final' && l.outcome ? l.outcome : 'AWAITING_REVIEW';
      outcomes[key] = (outcomes[key] ?? 0) + 1;
    }
    const gateRates = (['G1', 'G2', 'G3', 'GR'] as const).map((g) => ({ gate: g, fired: latest.filter((l) => l.gates?.some((x) => x.gate_id === g && x.fired)).length, of: latest.length }));
    const oldest = queue.reduce<number | null>((min, q) => (min === null || q.createdAt.getTime() < min ? q.createdAt.getTime() : min), null);
    res.json({
      attempts: Object.fromEntries(byStatus.map((s) => [s.status, s.n])),
      submitted_last_7_days: recent.n,
      review_queue: { open: queue.filter((q) => q.status === 'open').length, in_progress: queue.filter((q) => q.status === 'in_progress').length, oldest_hours: oldest === null ? null : Math.round((now - oldest) / 3_600_000) },
      outcomes,
      gate_rates: gateRates,
      organizations: orgs.n,
      candidates: candidates.n,
      environment: { env: deps.config.env, database: deps.config.databaseUrl ? 'postgres' : 'pglite' },
    });
  });

  r.get('/attempts', async (req, res) => {
    const q = parseQuery(
      z.object({
        query: z.string().trim().max(120).optional(),
        status: z.string().max(40).optional(),
        outcome: z.string().max(40).optional(),
        org: z.uuid().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      req,
    );
    const lv = latestVersions(deps.db);
    const conds: SQL[] = [];
    if (q.query) conds.push(or(ilike(users.name, `%${q.query}%`), ilike(users.email, `%${q.query}%`), ilike(sql`${attempts.id}::text`, `${q.query}%`))!);
    if (q.status) conds.push(eq(attempts.status, q.status));
    if (q.org) conds.push(eq(invitations.orgId, q.org));
    if (q.outcome === 'AWAITING_REVIEW') conds.push(eq(assessmentResults.status, 'provisional'), eq(attempts.status, 'submitted'));
    else if (q.outcome) conds.push(eq(assessmentResults.outcome, q.outcome), eq(assessmentResults.status, 'final'));
    const base = deps.db
      .select({
        a: attempts,
        candidate: { id: users.id, name: users.name, email: users.email },
        org: organizations.name,
        result: { status: assessmentResults.status, outcome: assessmentResults.outcome, t1Q: assessmentResults.t1Q, t2Q: assessmentResults.t2Q },
      })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .leftJoin(invitations, eq(invitations.id, attempts.invitationId))
      .leftJoin(organizations, eq(organizations.id, invitations.orgId))
      .leftJoin(lv, eq(lv.attemptId, attempts.id))
      .leftJoin(assessmentResults, and(eq(assessmentResults.attemptId, attempts.id), eq(assessmentResults.resultVersion, lv.version)))
      .where(conds.length ? and(...conds) : undefined);
    const rows = await base.orderBy(desc(attempts.createdAt)).limit(q.limit + 1).offset(q.offset);
    res.json({
      has_more: rows.length > q.limit,
      attempts: rows.slice(0, q.limit).map(({ a, candidate, org, result }) => ({
        id: a.id,
        candidate,
        org_name: org ?? null,
        origin: a.origin,
        status: a.status,
        status_label: ATTEMPT_STATUS_LABELS[a.status as AttemptStatus],
        is_retake: a.isRetake,
        created_at: a.createdAt,
        submitted_at: a.t2SubmittedAt,
        result: result?.status ? { status: result.status, outcome: result.outcome, outcome_label: result.outcome ? OUTCOME_LABELS[result.outcome as Outcome] : null, t1: score(result.t1Q), t2: score(result.t2Q) } : null,
      })),
    });
  });

  async function loadAttempt(id: string) {
    const [row] = await deps.db
      .select({ a: attempts, candidate: { id: users.id, name: users.name, email: users.email }, org: { id: organizations.id, name: organizations.name } })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .leftJoin(invitations, eq(invitations.id, attempts.invitationId))
      .leftJoin(organizations, eq(organizations.id, invitations.orgId))
      .where(eq(attempts.id, id));
    if (!row) throw notFound('Attempt not found.');
    return row;
  }

  r.get('/attempts/:id', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const { a, candidate, org } = await loadAttempt(id);
    const pkg = await loadScoringPackage(deps.db, a.scoringPackageId);
    const rows = await listEvents(deps.db, a.id);
    const evidence = buildEvidence(toEngineEvents(rows), pkg);
    const versions = await deps.db.select().from(assessmentResults).where(eq(assessmentResults.attemptId, a.id)).orderBy(desc(assessmentResults.resultVersion));
    const [item] = await deps.db.select({ item: reviewItems, assignee: users.name }).from(reviewItems).leftJoin(users, eq(users.id, reviewItems.assignedTo)).where(eq(reviewItems.attemptId, a.id));
    const ratings = await deps.db.select({ r: reviewerRatings, assessor: users.name }).from(reviewerRatings).innerJoin(users, eq(users.id, reviewerRatings.assessorId)).where(eq(reviewerRatings.attemptId, a.id)).orderBy(asc(reviewerRatings.seq));
    const dispositions = await deps.db.select({ d: grDispositions, assessor: users.name }).from(grDispositions).innerJoin(users, eq(users.id, grDispositions.assessorId)).where(eq(grDispositions.attemptId, a.id)).orderBy(asc(grDispositions.seq));
    const shares = await deps.db.select({ org: organizations.name, basis: resultShares.basis, granted_at: resultShares.grantedAt, revoked_at: resultShares.revokedAt }).from(resultShares).innerJoin(organizations, eq(organizations.id, resultShares.orgId)).where(eq(resultShares.attemptId, a.id));
    const chain = await verifyChain(deps.db, a.id);
    const latest = versions[0];
    await audit(deps.db, req, { action: 'attempt.viewed', targetType: 'attempt', targetId: a.id, orgId: org?.id ?? null });
    res.json({
      attempt: {
        id: a.id,
        status: a.status,
        status_label: ATTEMPT_STATUS_LABELS[a.status as AttemptStatus],
        origin: a.origin,
        is_retake: a.isRetake,
        scoring_package_id: a.scoringPackageId,
        created_at: a.createdAt,
        started_at: a.startedAt,
        t1_submitted_at: a.t1SubmittedAt,
        w2_clock_started_at: a.w2ClockStartedAt,
        t2_submitted_at: a.t2SubmittedAt,
        deadline_at: a.deadlineAt,
        closed_at: a.closedAt,
        close_reason: a.closeReason,
        events: a.lastSeq,
      },
      candidate,
      org: org?.id ? org : null,
      result: latest ? { version: latest.resultVersion, trigger: latest.trigger, computed_at: latest.computedAt, ...(latest.result as AssessmentResult) } : null,
      versions: versions.map((v) => ({ version: v.resultVersion, trigger: v.trigger, status: v.status, outcome: v.outcome, t1: score(v.t1Q), t2: score(v.t2Q), computed_at: v.computedAt, input_digest: v.inputDigest, package: v.scoringPackageId })),
      review: item ? { id: item.item.id, status: item.item.status, pseudonym: item.item.pseudonym, assignee: item.assignee, created_at: item.item.createdAt, completed_at: item.item.completedAt } : null,
      ratings: ratings.map(({ r: x, assessor }) => ({ criterion_id: x.criterionId, raw_rating: x.rawRating, rationale: x.rationale, assessor, at: x.createdAt })),
      dispositions: dispositions.map(({ d, assessor }) => ({ clause: d.clause, disposition: d.disposition, note: d.note, assessor, at: d.createdAt })),
      shares,
      chain,
      evidence: buildEvidenceView(rows, evidence, pkg),
    });
  });

  /** The raw, append-only event log with per-event chain checks (telemetry included). */
  r.get('/attempts/:id/events', async (req, res) => {
    const { id } = parseParams(idParam, req);
    await loadAttempt(id);
    const rows = await listEvents(deps.db, id);
    const chain = await verifyChain(deps.db, id);
    res.json({
      chain,
      events: rows.map((e) => ({ seq: e.seq, event_id: e.eventId, at: e.serverTs, task: e.taskId, type: e.eventType, object_id: e.objectId, source: e.source, metadata: e.metadata, hash: e.hash, prev_hash: e.prevHash, actor: e.actorUserId })),
    });
  });

  r.post('/attempts/:id/rescore', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const { created, row } = await recomputeResult(deps, id, 'rescore');
    await audit(deps.db, req, { action: 'attempt.rescored', targetType: 'attempt', targetId: id, details: { new_version: created, version: row.resultVersion } });
    res.json({ created, version: row.resultVersion });
  });

  const reasonBody = z.object({ reason: z.string().trim().min(3, 'Give a reason.').max(500) });

  r.post('/attempts/:id/close', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const { reason } = parseBody(reasonBody, req);
    await withAttemptLock(deps.db, id, async (tx, a) => {
      if (!ACTIVE.includes(a.status)) throw conflict('not_active', 'Only unfinished attempts can be closed.');
      const now = deps.clock.now();
      const [updated] = await tx.update(attempts).set({ status: 'closed', closedAt: now, closeReason: `admin: ${reason}`, updatedAt: now }).where(eq(attempts.id, id)).returning();
      await recomputeInTx(tx, deps, updated, 'close');
    });
    await audit(deps.db, req, { action: 'attempt.closed', targetType: 'attempt', targetId: id, details: { reason } });
    res.json({ ok: true });
  });

  r.post('/attempts/:id/void', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const { reason } = parseBody(reasonBody, req);
    await withAttemptLock(deps.db, id, async (tx, a) => {
      if (a.status === 'void') throw conflict('already_void', 'This attempt is already withdrawn.');
      const now = deps.clock.now();
      await tx.update(attempts).set({ status: 'void', closedAt: a.closedAt ?? now, closeReason: `void: ${reason}`, updatedAt: now }).where(eq(attempts.id, id));
      await tx.update(reviewItems).set({ status: 'done', completedAt: now, updatedAt: now }).where(and(eq(reviewItems.attemptId, id), ne(reviewItems.status, 'done')));
    });
    await audit(deps.db, req, { action: 'attempt.voided', targetType: 'attempt', targetId: id, details: { reason } });
    res.json({ ok: true });
  });

  /**
   * Grants a retake: optionally withdraws the previous attempt, creates a fresh attempt (pinned to the active
   * scoring package) and carries over the employers who could see the previous one.
   */
  r.post('/attempts/:id/retake', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const body = parseBody(z.object({ reason: z.string().trim().min(3, 'Give a reason.').max(500), void_previous: z.boolean().default(true), deadline_days: z.number().int().min(1).max(90).default(14) }), req);
    const { a: previous } = await loadAttempt(id);
    const created = await deps.db.transaction(async (tx) => {
      const now = deps.clock.now();
      if (body.void_previous && previous.status !== 'void') {
        await tx.update(attempts).set({ status: 'void', closedAt: previous.closedAt ?? now, closeReason: `void: retake granted — ${body.reason}`, updatedAt: now }).where(eq(attempts.id, previous.id));
        await tx.update(reviewItems).set({ status: 'done', completedAt: now, updatedAt: now }).where(and(eq(reviewItems.attemptId, previous.id), ne(reviewItems.status, 'done')));
      }
      const [grant] = await tx.insert(retakeGrants).values({ candidateId: previous.candidateId, simulationVersionId: previous.simulationVersionId, grantedBy: req.auth!.user.id, reason: body.reason }).returning();
      const attempt = await createAttempt(tx, {
        candidateId: previous.candidateId,
        simulationVersionId: previous.simulationVersionId,
        origin: previous.origin as 'invite' | 'self',
        invitationId: previous.invitationId,
        deadlineAt: new Date(now.getTime() + body.deadline_days * DAY),
        isRetake: true,
        retakeGrantId: grant.id,
      });
      await tx.update(retakeGrants).set({ consumedAttemptId: attempt.id }).where(eq(retakeGrants.id, grant.id));
      const shares = await tx.select().from(resultShares).where(and(eq(resultShares.attemptId, previous.id), sql`${resultShares.revokedAt} is null`));
      if (shares.length) await tx.insert(resultShares).values(shares.map((s) => ({ attemptId: attempt.id, orgId: s.orgId, basis: s.basis, consentEventId: s.consentEventId })));
      if (previous.invitationId) await tx.update(invitations).set({ attemptId: attempt.id }).where(eq(invitations.id, previous.invitationId));
      return attempt;
    });
    await audit(deps.db, req, { action: 'attempt.retake_granted', targetType: 'attempt', targetId: previous.id, details: { reason: body.reason, new_attempt_id: created.id, void_previous: body.void_previous } });
    res.status(201).json({ attempt_id: created.id });
  });

  /** "Why did A score differently from B?": criterion-by-criterion, largest point differences first. */
  r.get('/compare', async (req, res) => {
    const q = parseQuery(z.object({ a: z.uuid(), b: z.uuid() }), req);
    if (q.a === q.b) throw badRequest('same_attempt', 'Choose two different attempts.');
    const side = async (id: string) => {
      const { a, candidate, org } = await loadAttempt(id);
      const stored = await latestResult(deps.db, id);
      if (!stored) throw conflict('no_result', 'One of these attempts has no result yet.');
      return { attempt: { id: a.id, status: a.status, candidate, org_name: org?.name ?? null }, result: stored.result as AssessmentResult };
    };
    const [A, B] = await Promise.all([side(q.a), side(q.b)]);
    const byId = (res: AssessmentResult) => new Map(res.criteria.map((c) => [c.criterion_id, c]));
    const ca = byId(A.result);
    const cb = byId(B.result);
    const pick = (c: CriterionResult | undefined) => (c ? { rating: c.rating, raw_rating: c.raw_rating, points: c.points_q === null ? null : c.points_q / 4, status: c.status, cap: c.cap, cap_reasons: c.cap_reasons, rule_id: c.rule_id, explanation: c.explanation, source: c.source } : null);
    const criteria = A.result.criteria.map((c) => {
      const x = ca.get(c.criterion_id);
      const y = cb.get(c.criterion_id);
      const diff = ((x?.points_q ?? 0) - (y?.points_q ?? 0)) / 4;
      return { criterion_id: c.criterion_id, name: c.name, task: c.task, weight: c.weight, method: c.method, a: pick(x), b: pick(y), points_difference: diff };
    });
    const summary = (s: typeof A) => ({
      ...s.attempt,
      status: s.result.status,
      outcome: s.result.outcome,
      outcome_label: s.result.outcome ? OUTCOME_LABELS[s.result.outcome] : 'Awaiting review',
      outcome_reason: s.result.outcome_reason,
      t1: s.result.tasks.T1.score_q / 4,
      t2: s.result.tasks.T2.score_q / 4,
      gates: s.result.gates.map((g) => ({ gate_id: g.gate_id, fired: g.fired, resolved: g.resolved ?? null, reason: g.reason })),
      competencies: s.result.competencies.map((c) => ({ id: c.competency_id, name: c.name, score: c.score, reportable: c.reportable })),
    });
    await audit(deps.db, req, { action: 'attempt.compared', targetType: 'attempt', targetId: `${q.a},${q.b}` });
    res.json({
      a: summary(A),
      b: summary(B),
      criteria,
      differences: criteria.filter((c) => c.a?.rating !== c.b?.rating).sort((x, y) => Math.abs(y.points_difference) - Math.abs(x.points_difference)),
    });
  });

  /** Attempts eligible to compare (have a result), for pickers. */
  r.get('/attempts-with-results', async (req, res) => {
    const { query } = parseQuery(z.object({ query: z.string().trim().max(120).optional() }), req);
    const lv = latestVersions(deps.db);
    const rows = await deps.db
      .select({ id: attempts.id, name: users.name, email: users.email, outcome: assessmentResults.outcome, status: assessmentResults.status, t1Q: assessmentResults.t1Q, t2Q: assessmentResults.t2Q })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .innerJoin(lv, eq(lv.attemptId, attempts.id))
      .innerJoin(assessmentResults, and(eq(assessmentResults.attemptId, attempts.id), eq(assessmentResults.resultVersion, lv.version)))
      .where(and(isNotNull(attempts.t1SubmittedAt), query ? or(ilike(users.name, `%${query}%`), ilike(users.email, `%${query}%`)) : undefined))
      .orderBy(desc(attempts.createdAt))
      .limit(100);
    res.json({ attempts: rows.map((x) => ({ id: x.id, name: x.name, email: x.email, outcome_label: x.status === 'final' && x.outcome ? OUTCOME_LABELS[x.outcome as Outcome] : 'Awaiting review', t1: score(x.t1Q), t2: score(x.t2Q) })) });
  });

  return r;
}
