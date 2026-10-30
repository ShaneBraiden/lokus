import { Router, type Request } from 'express';
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { buildEvidence, REVIEWER_CRITERIA, type AssessmentResult, type ReviewerCriterionId } from '#engine';
import type { AppDeps } from '../context';
import { attempts, grDispositions, reviewItems, reviewerRatings, users } from '../db/schema';
import { audit } from '../lib/audit';
import { conflict, notFound } from '../lib/errors';
import { parseBody, parseParams, parseQuery } from '../lib/http';
import { listEvents, toEngineEvents } from '../services/eventStore';
import { buildEvidenceView, nameRedactor } from '../services/evidenceView';
import { latestResult, recordGrDisposition, recordReviewerRatings } from '../services/scoring';
import { loadScoringPackage } from '../services/scoringPackages';

const idParam = z.object({ id: z.uuid() });
const HOUR = 60 * 60 * 1000;

/**
 * Assessor workflow (/api/review): a blind queue and pseudonymised review packets. Nothing here reveals the
 * candidate's identity, their employer, task scores or the outcome; assessors see the rubric anchors, the
 * candidate's work, the caps the engine will apply, and the review history.
 */
export function reviewRouter(deps: AppDeps): Router {
  const r = Router();

  async function loadItem(id: string) {
    const [row] = await deps.db.select({ item: reviewItems, attempt: attempts }).from(reviewItems).innerJoin(attempts, eq(attempts.id, reviewItems.attemptId)).where(eq(reviewItems.id, id));
    if (!row) throw notFound('Review item not found.');
    return row;
  }

  r.get('/queue', async (req, res) => {
    const { scope } = parseQuery(z.object({ scope: z.enum(['open', 'mine', 'done']).default('open') }), req);
    const me = req.auth!.user.id;
    const where =
      scope === 'done'
        ? eq(reviewItems.status, 'done')
        : scope === 'mine'
          ? and(eq(reviewItems.assignedTo, me), inArray(reviewItems.status, ['open', 'in_progress']))
          : and(inArray(reviewItems.status, ['open', 'in_progress']), or(isNull(reviewItems.assignedTo), eq(reviewItems.assignedTo, me)));
    const rows = await deps.db
      .select({ item: reviewItems, assignee: users.name })
      .from(reviewItems)
      .leftJoin(users, eq(users.id, reviewItems.assignedTo))
      .where(where)
      .orderBy(desc(reviewItems.priority), asc(reviewItems.createdAt))
      .limit(200);
    const now = deps.clock.now().getTime();
    const items = await Promise.all(
      rows.map(async ({ item, assignee }) => {
        const result = (await latestResult(deps.db, item.attemptId))?.result as AssessmentResult | undefined;
        const gr = result?.gates.find((g) => g.gate_id === 'GR');
        return {
          id: item.id,
          pseudonym: item.pseudonym,
          status: item.status,
          priority: item.priority,
          assigned_to_me: item.assignedTo === me,
          assignee: item.assignedTo && item.assignedTo !== me ? assignee : null,
          created_at: item.createdAt,
          completed_at: item.completedAt,
          age_hours: Math.round((now - item.createdAt.getTime()) / HOUR),
          pending: result?.pending_review ?? [],
          gr_hold: Boolean(gr?.fired && !gr.resolved),
        };
      }),
    );
    res.json({ items });
  });

  r.get('/items/:id', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const { item, attempt } = await loadItem(id);
    const [candidate] = await deps.db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, attempt.candidateId));
    const pkg = await loadScoringPackage(deps.db, attempt.scoringPackageId);
    const rows = await listEvents(deps.db, attempt.id);
    const evidence = buildEvidence(toEngineEvents(rows), pkg);
    const result = (await latestResult(deps.db, attempt.id))?.result as AssessmentResult | undefined;
    const ratingRows = await deps.db
      .select({ r: reviewerRatings, assessor: users.name })
      .from(reviewerRatings)
      .innerJoin(users, eq(users.id, reviewerRatings.assessorId))
      .where(eq(reviewerRatings.attemptId, attempt.id))
      .orderBy(asc(reviewerRatings.seq));
    const dispositionRows = await deps.db
      .select({ d: grDispositions, assessor: users.name })
      .from(grDispositions)
      .innerJoin(users, eq(users.id, grDispositions.assessorId))
      .where(eq(grDispositions.attemptId, attempt.id))
      .orderBy(asc(grDispositions.seq));
    const redact = nameRedactor(candidate?.name ?? '', candidate?.email ?? '');

    const criteria = REVIEWER_CRITERIA.map((cid) => {
      const def = pkg.rubric.criteria.find((c) => c.id === cid)!;
      const res = result?.criteria.find((c) => c.criterion_id === cid);
      const latest = [...ratingRows].reverse().find((x) => x.r.criterionId === cid);
      return {
        id: cid,
        name: def.name,
        task: def.task,
        weight: def.weight,
        what_to_observe: def.what_to_observe,
        anchors: def.anchors,
        notes: def.notes,
        status: res?.status ?? 'PENDING',
        needs_review: res?.needs_review ?? true,
        source: res?.source ?? 'none',
        auto_rating: res && res.source === 'auto_rule' ? res.rating : null,
        cap: res?.cap ?? null,
        cap_reasons: res?.cap_reasons ?? [],
        explanation: res ? redact(res.explanation) : '',
        effective_rating: res?.rating ?? null,
        current: latest ? { raw_rating: latest.r.rawRating, rationale: latest.r.rationale, assessor: latest.assessor, at: latest.r.createdAt } : null,
      };
    });
    const gr = result?.gates.find((g) => g.gate_id === 'GR');
    await audit(deps.db, req, { action: 'review.packet_viewed', targetType: 'review_item', targetId: item.id });
    res.json({
      item: { id: item.id, pseudonym: item.pseudonym, status: item.status, assigned_to_me: item.assignedTo === req.auth!.user.id, assigned: Boolean(item.assignedTo), created_at: item.createdAt },
      criteria,
      gr: gr
        ? {
            fired: gr.fired,
            resolved: gr.resolved ?? !gr.fired,
            reason: redact(gr.reason),
            clauses: (gr.clauses ?? []).map((c) => ({ clause: c.clause, fired: c.fired, disposition: c.disposition, matches: c.matches.map(redact) })),
          }
        : { fired: false, resolved: true, reason: '', clauses: [] },
      pending: result?.pending_review ?? [],
      evidence: buildEvidenceView(rows, evidence, pkg, redact),
      history: {
        ratings: ratingRows.map(({ r: x, assessor }) => ({ criterion_id: x.criterionId, raw_rating: x.rawRating, rationale: x.rationale, assessor, at: x.createdAt, supersedes: Boolean(x.supersedesId) })),
        dispositions: dispositionRows.map(({ d, assessor }) => ({ clause: d.clause, disposition: d.disposition, note: d.note, assessor, at: d.createdAt })),
      },
    });
  });

  async function assignTo(id: string, userId: string | null, req: Request) {
    const { item } = await loadItem(id);
    if (item.status === 'done') throw conflict('review_done', 'This review is complete.');
    const admin = req.auth!.user.platformRole === 'admin';
    if (userId && item.assignedTo && item.assignedTo !== userId && !admin) throw conflict('review_assigned', 'Another assessor is reviewing this candidate.');
    if (!userId && item.assignedTo && item.assignedTo !== req.auth!.user.id && !admin) throw conflict('review_assigned', 'Only the assigned assessor can release this review.');
    await deps.db.update(reviewItems).set({ assignedTo: userId, status: userId ? 'in_progress' : 'open', updatedAt: deps.clock.now() }).where(eq(reviewItems.id, id));
    return item;
  }

  r.post('/items/:id/claim', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const item = await assignTo(id, req.auth!.user.id, req);
    await audit(deps.db, req, { action: 'review.claimed', targetType: 'review_item', targetId: item.id });
    res.json({ ok: true });
  });

  r.post('/items/:id/release', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const item = await assignTo(id, null, req);
    await audit(deps.db, req, { action: 'review.released', targetType: 'review_item', targetId: item.id });
    res.json({ ok: true });
  });

  /** Rating someone else's claimed item is refused (admins may step in); rating an unclaimed item claims it. */
  async function guardAndClaim(id: string, req: Request) {
    const { item, attempt } = await loadItem(id);
    const me = req.auth!.user.id;
    if (item.assignedTo && item.assignedTo !== me && req.auth!.user.platformRole !== 'admin') throw conflict('review_assigned', 'Another assessor is reviewing this candidate.');
    if (!item.assignedTo) await deps.db.update(reviewItems).set({ assignedTo: me, status: 'in_progress', updatedAt: deps.clock.now() }).where(eq(reviewItems.id, id));
    return { item, attempt };
  }

  const reviewState = (result: AssessmentResult) => {
    const gr = result.gates.find((g) => g.gate_id === 'GR');
    return { pending: result.pending_review, gr_hold: Boolean(gr?.fired && !gr.resolved), complete: result.pending_review.length === 0 && !(gr?.fired && !gr.resolved) };
  };

  r.post('/items/:id/ratings', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const body = parseBody(
      z.object({
        ratings: z
          .array(z.object({ criterion_id: z.enum(REVIEWER_CRITERIA as unknown as [ReviewerCriterionId, ...ReviewerCriterionId[]]), raw_rating: z.number().int().min(0).max(4), rationale: z.string().trim().min(3, 'Give a short rationale for every rating.').max(4000) }))
          .min(1)
          .max(6),
      }),
      req,
    );
    const { item, attempt } = await guardAndClaim(id, req);
    const { row } = await recordReviewerRatings(deps, attempt.id, req.auth!.user.id, body.ratings);
    await audit(deps.db, req, { action: 'review.rated', targetType: 'review_item', targetId: item.id, details: { criteria: body.ratings.map((x) => x.criterion_id) } });
    res.json(reviewState(row.result as AssessmentResult));
  });

  r.post('/items/:id/gr', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const body = parseBody(z.object({ clause: z.enum(['delay', 'waiver']), disposition: z.enum(['cleared', 'confirmed']), note: z.string().trim().min(3, 'Explain the disposition.').max(4000) }), req);
    const { item, attempt } = await guardAndClaim(id, req);
    const { row } = await recordGrDisposition(deps, attempt.id, req.auth!.user.id, body);
    await audit(deps.db, req, { action: 'review.gr_disposition', targetType: 'review_item', targetId: item.id, details: { clause: body.clause, disposition: body.disposition } });
    res.json(reviewState(row.result as AssessmentResult));
  });

  return r;
}
