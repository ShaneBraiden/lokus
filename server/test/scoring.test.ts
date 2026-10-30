import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { PERSONAS, type AssessmentResult } from '@lokus/engine';
import { assessmentResults, reviewItems, reviewerRatings } from '../src/db/schema';
import { SIMULATION_VERSION_ID } from '../src/db/seed';
import { createAttempt } from '../src/services/attempts';
import { latestResult, recomputeResult, recordGrDisposition, recordReviewerRatings } from '../src/services/scoring';
import { createTestContext, makeUser, perform, signIn, type TestContext } from './helpers';

let ctx: TestContext;
let assessorId: string;

beforeAll(async () => {
  ctx = await createTestContext();
  assessorId = (await makeUser(ctx, { email: 'rater@lokus.test', kind: 'staff', platformRole: 'assessor' })).id;
});
afterAll(() => ctx.close());

/** Plays a persona's candidate actions over HTTP (no assessor ratings) and returns the attempt id. */
async function playCandidate(personaId: string, email: string): Promise<string> {
  const run = PERSONAS.find((p) => p.id === personaId)!.build();
  ctx.clock.set(run.actions[0].at);
  const user = await makeUser(ctx, { email, kind: 'candidate' });
  const attempt = await ctx.deps.db.transaction((tx) => createAttempt(tx, { candidateId: user.id, simulationVersionId: SIMULATION_VERSION_ID, origin: 'self' }));
  const agent = await signIn(ctx, email);
  for (const { at, action } of run.actions) {
    ctx.clock.set(at);
    const res = await perform(agent, `/api/attempts/${attempt.id}`, action);
    if (res.status >= 300) throw new Error(`${action.kind}: ${JSON.stringify(res.body)}`);
  }
  return attempt.id;
}

const result = async (id: string) => (await latestResult(ctx.deps.db, id))!;
const res = async (id: string) => (await result(id)).result as AssessmentResult;
const crit = (r: AssessmentResult, id: string) => r.criteria.find((c) => c.criterion_id === id)!;
const ALL4 = ['T1_SEC4', 'T1_QUERY', 'T2_REFUSE', 'T2_WAIV', 'T2_REC', 'T2_TONE'].map((criterion_id) => ({ criterion_id, raw_rating: 4, rationale: 'Meets every anchor-4 descriptor.' }));

describe('scoring on submit and on rating', () => {
  let perfect: string;
  beforeAll(async () => {
    perfect = await playCandidate('p01', 'perfect@example.com');
  });

  it('stores a result at each submission, provisional until the assessor rates', async () => {
    const rows = await ctx.deps.db.select().from(assessmentResults).where(eq(assessmentResults.attemptId, perfect));
    expect(rows.map((r) => r.trigger)).toEqual(['t1_submit', 't2_submit']);
    expect(await res(perfect)).toMatchObject({ status: 'provisional', outcome: null });
    const [item] = await ctx.deps.db.select().from(reviewItems).where(eq(reviewItems.attemptId, perfect));
    expect(item.status).toBe('open');
  });

  it('becomes final on rating, closes the review item, and writes a new version only when inputs change', async () => {
    await recordReviewerRatings(ctx.deps, perfect, assessorId, ALL4);
    const r = await res(perfect);
    expect(r).toMatchObject({ status: 'final', outcome: 'MEETS_BAR' });
    expect([r.tasks.T1.score_q / 4, r.tasks.T2.score_q / 4]).toEqual([100, 100]);
    const [item] = await ctx.deps.db.select().from(reviewItems).where(eq(reviewItems.attemptId, perfect));
    expect(item.status).toBe('done');

    const v = (await result(perfect)).resultVersion;
    expect((await recomputeResult(ctx.deps, perfect, 'rescore')).created).toBe(false);
    expect((await result(perfect)).resultVersion).toBe(v);
  });

  it('applies the latest rating per criterion and keeps the full history', async () => {
    await recordReviewerRatings(ctx.deps, perfect, assessorId, [{ criterion_id: 'T2_TONE', raw_rating: 2, rationale: 'Noticeably apologetic on second reading.' }]);
    const r = await res(perfect);
    expect(crit(r, 'T2_TONE')).toMatchObject({ rating: 2, source: 'reviewer' });
    expect(r.tasks.T2.score_q / 4).toBe(92.5);
    const history = await ctx.deps.db.select().from(reviewerRatings).where(eq(reviewerRatings.attemptId, perfect));
    const tone = history.filter((h) => h.criterionId === 'T2_TONE');
    expect(tone.map((t) => t.rawRating)).toEqual([4, 2]);
    expect(tone[1].supersedesId).toBe(tone[0].id);
  });

  it('validates ratings', async () => {
    await expect(recordReviewerRatings(ctx.deps, perfect, assessorId, [{ criterion_id: 'T1_DISC', raw_rating: 4, rationale: 'x x x' }])).rejects.toMatchObject({ code: 'not_a_reviewer_criterion' });
    await expect(recordReviewerRatings(ctx.deps, perfect, assessorId, [{ criterion_id: 'T2_TONE', raw_rating: 5, rationale: 'x x x' }])).rejects.toMatchObject({ code: 'invalid_rating' });
    await expect(recordReviewerRatings(ctx.deps, perfect, assessorId, [{ criterion_id: 'T2_TONE', raw_rating: 3, rationale: '' }])).rejects.toMatchObject({ code: 'rationale_required' });
  });

  it('scores the "opens Section 4 but does not act" fixture after rating (persona 4b)', async () => {
    const id = await playCandidate('p04b', 'opens-s4@example.com');
    await recordReviewerRatings(ctx.deps, id, assessorId, [{ criterion_id: 'T1_SEC4', raw_rating: 1, rationale: 'Opened Section 4 but did not act.' }, ...ALL4.slice(2)]);
    expect(await res(id)).toMatchObject({ outcome: 'DOES_NOT_MEET_BAR', status: 'final' });
    expect((await res(id)).tasks.T1.score_q / 4).toBe(13.75);
  });
});

describe('GR hold lifecycle', () => {
  let held: string;
  beforeAll(async () => {
    held = await playCandidate('p13', 'gr@example.com');
    await recordReviewerRatings(ctx.deps, held, assessorId, [
      { criterion_id: 'T1_SEC4', raw_rating: 4, rationale: 'Reviewed and reported Section 4.' },
      { criterion_id: 'T1_QUERY', raw_rating: 4, rationale: 'Neutral, specific queries.' },
      { criterion_id: 'T2_REFUSE', raw_rating: 2, rationale: 'Leaves the delay partly open.' },
      { criterion_id: 'T2_WAIV', raw_rating: 3, rationale: 'Declines with minor routing gap.' },
      { criterion_id: 'T2_REC', raw_rating: 3, rationale: 'Accurate, one omission.' },
      { criterion_id: 'T2_TONE', raw_rating: 3, rationale: 'Professional with minor weakness.' },
    ]);
  });

  it('holds for review while GR is unresolved, even with every rating in', async () => {
    const r = await res(held);
    expect(r.outcome).toBe('HOLD_FOR_REVIEW');
    expect(r.gates.find((g) => g.gate_id === 'GR')).toMatchObject({ fired: true, resolved: false });
    const [item] = await ctx.deps.db.select().from(reviewItems).where(eq(reviewItems.attemptId, held));
    expect(item.status).toBe('open');
  });

  it('releases the hold when an assessor clears it, and a later confirmation zeroes T2_REFUSE', async () => {
    await expect(recordGrDisposition(ctx.deps, held, assessorId, { clause: 'delay', disposition: 'cleared', note: '' })).rejects.toMatchObject({ code: 'note_required' });
    await recordGrDisposition(ctx.deps, held, assessorId, { clause: 'delay', disposition: 'cleared', note: 'Reads as describing the timeline, not agreeing.' });
    expect(await res(held)).toMatchObject({ outcome: 'PARTIALLY_MEETS_BAR', status: 'final' });
    const [item] = await ctx.deps.db.select().from(reviewItems).where(eq(reviewItems.attemptId, held));
    expect(item.status).toBe('done');

    await recordGrDisposition(ctx.deps, held, assessorId, { clause: 'delay', disposition: 'confirmed', note: 'On review, the reply does agree to hold the report.' });
    const r = await res(held);
    expect(crit(r, 'T2_REFUSE')).toMatchObject({ raw_rating: 2, cap: 0, rating: 0 });
    expect(r).toMatchObject({ outcome: 'DOES_NOT_MEET_BAR' });
    expect(r.tasks.T2.score_q / 4).toBe(52.5);
  });

  it('refuses ratings on attempts that are not submitted', async () => {
    const user = await makeUser(ctx, { email: 'unsubmitted@example.com', kind: 'candidate' });
    const attempt = await ctx.deps.db.transaction((tx) => createAttempt(tx, { candidateId: user.id, simulationVersionId: SIMULATION_VERSION_ID, origin: 'self' }));
    await expect(recordReviewerRatings(ctx.deps, attempt.id, assessorId, ALL4)).rejects.toMatchObject({ code: 'not_submitted' });
  });
});
