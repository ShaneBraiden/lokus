import { createHash } from 'node:crypto';
import { asc, desc, eq } from 'drizzle-orm';
import { calculateAssessment, REVIEWER_CRITERIA, type AssessmentResult, type GrClause, type Rating, type ReviewerCriterionId } from '@lokus/engine';
import type { AppDeps } from '../context';
import type { Tx } from '../db/client';
import { assessmentResults, grDispositions, reviewerRatings, reviewItems } from '../db/schema';
import { badRequest, conflict } from '../lib/errors';
import { listEvents, toEngineEvents, withAttemptLock, type AttemptRow } from './eventStore';
import { loadScoringPackage } from './scoringPackages';

export type ResultTrigger = 't1_submit' | 't2_submit' | 'rating' | 'disposition' | 'close' | 'rescore';
export type StoredResult = typeof assessmentResults.$inferSelect;

/** Statuses after which no more candidate events can arrive (the engine then reports Incomplete as final). */
const CLOSED_STATUSES = new Set(['submitted', 'closed', 'void']);

export function pseudonymFor(attemptId: string): string {
  return `Candidate ${createHash('sha256').update(attemptId).digest('hex').slice(0, 6).toUpperCase()}`;
}

/** Review is needed while reviewer criteria are pending or a GR hold has not been dispositioned. */
export function needsReview(result: AssessmentResult): boolean {
  const gr = result.gates.find((g) => g.gate_id === 'GR');
  return result.pending_review.length > 0 || Boolean(gr?.fired && !gr.resolved);
}

async function syncReviewItem(tx: Tx, deps: Pick<AppDeps, 'clock'>, attempt: AttemptRow, result: AssessmentResult) {
  if (attempt.status !== 'submitted') return;
  const [item] = await tx.select().from(reviewItems).where(eq(reviewItems.attemptId, attempt.id));
  const now = deps.clock.now();
  if (needsReview(result)) {
    if (!item) {
      await tx.insert(reviewItems).values({ attemptId: attempt.id, pseudonym: pseudonymFor(attempt.id), priority: attempt.origin === 'invite' ? 1 : 0 });
    } else if (item.status === 'done') {
      await tx.update(reviewItems).set({ status: 'open', completedAt: null, updatedAt: now }).where(eq(reviewItems.id, item.id));
    }
  } else if (item && item.status !== 'done') {
    await tx.update(reviewItems).set({ status: 'done', completedAt: now, updatedAt: now }).where(eq(reviewItems.id, item.id));
  }
}

async function recomputeInTx(tx: Tx, deps: Pick<AppDeps, 'clock'>, attempt: AttemptRow, trigger: ResultTrigger): Promise<{ row: StoredResult; created: boolean }> {
  const pkg = await loadScoringPackage(tx, attempt.scoringPackageId);
  const events = toEngineEvents(await listEvents(tx, attempt.id));
  const ratings = await tx.select().from(reviewerRatings).where(eq(reviewerRatings.attemptId, attempt.id)).orderBy(asc(reviewerRatings.seq));
  const dispositions = await tx.select().from(grDispositions).where(eq(grDispositions.attemptId, attempt.id)).orderBy(asc(grDispositions.seq));
  const now = deps.clock.now();
  // The engine orders reviews by created_at; insertion sequence is passed so "latest wins" never depends on clock ties.
  const result = calculateAssessment({
    events,
    reviewerRatings: ratings.map((r) => ({ id: r.id, criterion_id: r.criterionId as ReviewerCriterionId, raw_rating: r.rawRating as Rating, rationale: r.rationale, assessor_id: r.assessorId, created_at: r.seq })),
    grDispositions: dispositions.map((d) => ({ id: d.id, clause: d.clause as GrClause, disposition: d.disposition as 'cleared' | 'confirmed', note: d.note, assessor_id: d.assessorId, created_at: d.seq })),
    pkg,
    evaluatedAt: now.getTime(),
    closed: CLOSED_STATUSES.has(attempt.status),
  });
  const [latest] = await tx.select().from(assessmentResults).where(eq(assessmentResults.attemptId, attempt.id)).orderBy(desc(assessmentResults.resultVersion)).limit(1);
  await syncReviewItem(tx, deps, attempt, result);
  if (latest && latest.inputDigest === result.input_digest) return { row: latest, created: false };
  const [row] = await tx
    .insert(assessmentResults)
    .values({
      attemptId: attempt.id,
      resultVersion: (latest?.resultVersion ?? 0) + 1,
      scoringPackageId: pkg.id,
      engineVersion: pkg.engine_version,
      inputDigest: result.input_digest,
      status: result.status,
      outcome: result.outcome,
      outcomeLocked: result.outcome_locked,
      t1Q: result.tasks.T1.score_q,
      t2Q: result.tasks.T2.score_q,
      result,
      trigger,
      computedAt: now,
    })
    .returning();
  return { row, created: true };
}

/**
 * Recomputes the deterministic result from the stored evidence, ratings and dispositions (serialised per attempt).
 * A new append-only result version is written only when the inputs changed.
 */
export async function recomputeResult(deps: Pick<AppDeps, 'db' | 'clock'>, attemptId: string, trigger: ResultTrigger): Promise<{ row: StoredResult; created: boolean }> {
  return withAttemptLock(deps.db, attemptId, (tx, attempt) => recomputeInTx(tx, deps, attempt, trigger));
}

export async function latestResult(db: AppDeps['db'], attemptId: string): Promise<StoredResult | null> {
  const [row] = await db.select().from(assessmentResults).where(eq(assessmentResults.attemptId, attemptId)).orderBy(desc(assessmentResults.resultVersion)).limit(1);
  return row ?? null;
}

export interface RatingInput {
  criterion_id: string;
  raw_rating: number;
  rationale: string;
}

/** Stores assessor ratings (append-only; the latest per criterion wins) and recomputes the result. */
export async function recordReviewerRatings(deps: Pick<AppDeps, 'db' | 'clock'>, attemptId: string, assessorId: string, ratings: RatingInput[]) {
  for (const r of ratings) {
    if (!(REVIEWER_CRITERIA as readonly string[]).includes(r.criterion_id)) throw badRequest('not_a_reviewer_criterion', `${r.criterion_id} is scored automatically.`);
    if (!Number.isInteger(r.raw_rating) || r.raw_rating < 0 || r.raw_rating > 4) throw badRequest('invalid_rating', 'Ratings are whole numbers from 0 to 4.');
    if (r.rationale.trim().length < 3) throw badRequest('rationale_required', 'Give a short rationale for every rating.');
  }
  return withAttemptLock(deps.db, attemptId, async (tx, attempt) => {
    if (attempt.status !== 'submitted') throw conflict('not_submitted', 'Only submitted attempts can be rated.');
    const previous = await tx.select().from(reviewerRatings).where(eq(reviewerRatings.attemptId, attemptId)).orderBy(asc(reviewerRatings.seq));
    const now = deps.clock.now();
    for (const r of ratings) {
      const prior = [...previous].reverse().find((p) => p.criterionId === r.criterion_id);
      await tx.insert(reviewerRatings).values({ attemptId, criterionId: r.criterion_id, rawRating: r.raw_rating, rationale: r.rationale.trim(), assessorId, supersedesId: prior?.id ?? null, createdAt: now });
    }
    return recomputeInTx(tx, deps, attempt, 'rating');
  });
}

/** Records an assessor's GR disposition for one clause ("cleared" or "confirmed") and recomputes the result. */
export async function recordGrDisposition(deps: Pick<AppDeps, 'db' | 'clock'>, attemptId: string, assessorId: string, input: { clause: GrClause; disposition: 'cleared' | 'confirmed'; note: string }) {
  if (input.note.trim().length < 3) throw badRequest('note_required', 'Explain the disposition.');
  return withAttemptLock(deps.db, attemptId, async (tx, attempt) => {
    if (attempt.status !== 'submitted') throw conflict('not_submitted', 'Only submitted attempts can be reviewed.');
    const previous = await tx.select().from(grDispositions).where(eq(grDispositions.attemptId, attemptId)).orderBy(desc(grDispositions.seq));
    const prior = previous.find((p) => p.clause === input.clause);
    await tx.insert(grDispositions).values({ attemptId, clause: input.clause, disposition: input.disposition, note: input.note.trim(), assessorId, supersedesId: prior?.id ?? null, createdAt: deps.clock.now() });
    return recomputeInTx(tx, deps, attempt, 'disposition');
  });
}

export { recomputeInTx };
