import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { PERSONAS, calculateAssessment, defaultScoringPackage, type AssessmentResult } from '@lokus/engine';
import { attempts } from '../src/db/schema';
import { SIMULATION_VERSION_ID } from '../src/db/seed';
import { createAttempt } from '../src/services/attempts';
import { verifyChain } from '../src/services/eventStore';
import { latestResult, recomputeResult, recordGrDisposition, recordReviewerRatings } from '../src/services/scoring';
import { createTestContext, makeUser, perform, signIn, type TestContext } from './helpers';

let ctx: TestContext;
let assessorId: string;

beforeAll(async () => {
  ctx = await createTestContext();
  assessorId = (await makeUser(ctx, { email: 'rater@lokus.test', kind: 'staff', platformRole: 'assessor' })).id;
});
afterAll(() => ctx.close());

/** Everything that must match between the HTTP replay and the engine-only run (event ids and digests differ). */
function comparable(r: AssessmentResult) {
  return {
    status: r.status,
    outcome: r.outcome,
    outcome_locked: r.outcome_locked,
    outcome_reason: r.outcome_reason,
    tasks: r.tasks,
    criteria: r.criteria.map((c) => ({ id: c.criterion_id, status: c.status, rating: c.rating, raw: c.raw_rating, cap: c.cap, caps: c.cap_reasons, rule: c.rule_id, points: c.points_q, max: c.max_reachable_q, review: c.needs_review, explanation: c.explanation })),
    gates: r.gates.map((g) => ({ id: g.gate_id, fired: g.fired, resolved: g.resolved, clauses: g.clauses, reason: g.reason })),
    competencies: r.competencies,
    pending_review: r.pending_review,
  };
}

describe('Phase 4 gate: every persona replayed over HTTP scores exactly as the engine', () => {
  it.each(PERSONAS.map((p) => [p.id, p.name, p] as const))('%s %s', async (_id, _name, persona) => {
    const run = persona.build();
    const email = `${persona.id}@replay.example`;
    ctx.clock.set(run.actions[0].at);
    const user = await makeUser(ctx, { email, kind: 'candidate' });
    const attempt = await ctx.deps.db.transaction((tx) => createAttempt(tx, { candidateId: user.id, simulationVersionId: SIMULATION_VERSION_ID, origin: 'self' }));
    const agent = await signIn(ctx, email);
    const base = `/api/attempts/${attempt.id}`;

    for (const { at, action } of run.actions) {
      ctx.clock.set(at);
      const res = await perform(agent, base, action);
      expect(res.status, `${action.kind} → ${JSON.stringify(res.body)}`).toBeLessThan(300);
    }

    const [row] = await ctx.deps.db.select().from(attempts).where(eq(attempts.id, attempt.id));
    if (row.status !== 'submitted') {
      // Persona 8 never submits: the attempt is closed (e.g. expired), making Incomplete final.
      await ctx.deps.db.update(attempts).set({ status: 'closed', closedAt: ctx.clock.now(), closeReason: 'expired' }).where(eq(attempts.id, attempt.id));
      await recomputeResult(ctx.deps, attempt.id, 'close');
    }
    if (run.ratings.length) {
      await recordReviewerRatings(ctx.deps, attempt.id, assessorId, run.ratings.map((r) => ({ criterion_id: r.criterion_id, raw_rating: r.raw_rating, rationale: r.rationale })));
    }
    for (const d of run.dispositions) await recordGrDisposition(ctx.deps, attempt.id, assessorId, { clause: d.clause, disposition: d.disposition, note: d.note });

    const stored = (await latestResult(ctx.deps.db, attempt.id))!.result as AssessmentResult;
    const direct = calculateAssessment({ events: run.events, reviewerRatings: run.ratings, grDispositions: run.dispositions, pkg: defaultScoringPackage(), evaluatedAt: 0, closed: true });
    expect(comparable(stored)).toEqual(comparable(direct));
    expect((await verifyChain(ctx.deps.db, attempt.id)).ok).toBe(true);
  });
});
