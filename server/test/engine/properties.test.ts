import { describe, expect, it } from 'vitest';
import {
  PERSONAS,
  ScenarioBuilder,
  calculateAssessment,
  defaultScoringPackage,
  discKeyScore,
  buildEvidence,
  scriptWorkday1,
  type AssessmentResult,
  type EngineEvent,
  type T1Script,
} from '../../src/engine';

const pkg = defaultScoringPackage();

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const run = (events: readonly EngineEvent[], ratings = PERSONAS[0].build().ratings) =>
  calculateAssessment({ events, reviewerRatings: ratings, pkg, evaluatedAt: 1_000, closed: true });

describe('determinism and reproducibility', () => {
  const base = PERSONAS[0].build();

  it('returns identical results and digests for identical inputs', () => {
    const a = run(base.events, base.ratings);
    const b = run(structuredClone(base.events), structuredClone(base.ratings));
    expect(b).toEqual(a);
    expect(a.input_digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([1, 2, 3, 42, 2026])('is invariant to the order events arrive in (seed %i)', (seed) => {
    expect(run(shuffle(base.events, seed), base.ratings)).toEqual(run(base.events, base.ratings));
  });

  it('ignores telemetry events entirely', () => {
    const noisy: EngineEvent[] = [
      ...base.events,
      { event_id: 'tel-1', seq: 9001, task_id: 'T1', event_type: 'interruption_started', object_id: null, metadata: { reason: 'tab_hidden' }, server_ts: 5, source: 'T' },
      { event_id: 'tel-2', seq: 9002, task_id: 'T1', event_type: 'interruption_ended', object_id: null, metadata: {}, server_ts: 6, source: 'T' },
    ];
    expect(run(noisy, base.ratings)).toEqual(run(base.events, base.ratings));
  });

  it('changes the input digest when any scored event changes', () => {
    const changed = base.events.map((e, i) => (i === 10 ? { ...e, server_ts: e.server_ts + 1 } : e));
    expect(run(changed, base.ratings).input_digest).not.toBe(run(base.events, base.ratings).input_digest);
  });

  it('ignores events recorded after a task was submitted', () => {
    const t1Done = base.events.find((e) => e.task_id === 'T1' && e.event_type === 'task_completed')!;
    const late: EngineEvent = { event_id: 'late-1', seq: t1Done.seq, task_id: 'T1', event_type: 'no_deviation_recorded', object_id: 'AHS-007-DM-008', metadata: { participant_id: 'AHS-007-DM-008' }, server_ts: t1Done.server_ts + 1, source: 'C' };
    const withLate = [...base.events.map((e) => (e.seq >= t1Done.seq ? { ...e, seq: e.seq + 1 } : e)), { ...late, seq: t1Done.seq + 1 }];
    const a = run(base.events, base.ratings);
    const b = run(withLate, base.ratings);
    expect(b.criteria).toEqual(a.criteria);
    expect(b.outcome).toBe(a.outcome);
  });
});

const ERRORS = {
  missDM008: (o: T1Script) => ({ ...o, missed: [...(o.missed ?? []), 'AHS-007-DM-008'] }),
  missDM494: (o: T1Script) => ({ ...o, missed: [...(o.missed ?? []), 'AHS-007-DM-494'] }),
  flag206: (o: T1Script) => ({ ...o, falseFlags: [...(o.falseFlags ?? []), 'AHS-007-DM-206'] }),
  flag022: (o: T1Script) => ({ ...o, falseFlags: [...(o.falseFlags ?? []), 'AHS-007-DM-022'] }),
  wrongCodes: (o: T1Script) => ({ ...o, wrongCodes: true }),
  dm220AsDataQuery: (o: T1Script) => ({ ...o, dm220: 'data_query' as const }),
  skipSection4: (o: T1Script) => ({ ...o, sec4: 'skip' as const }),
  lateEscalation: (o: T1Script) => ({ ...o, escalateAfterMin: 31 }),
};
type ErrorName = keyof typeof ERRORS;
const NAMES = Object.keys(ERRORS) as ErrorName[];

function t1For(mask: number): { result: AssessmentResult; key: number } {
  let o: T1Script = {};
  NAMES.forEach((name, i) => {
    if (mask & (1 << i)) o = ERRORS[name](o);
  });
  const s = new ScenarioBuilder();
  scriptWorkday1(s, o);
  s.rateAll({ T1_SEC4: 4, T1_QUERY: 4 });
  const built = s.build();
  const result = calculateAssessment({ events: built.events, reviewerRatings: built.ratings, pkg, evaluatedAt: 0, closed: true });
  const ctx = { pkg, evidence: buildEvidence(built.events, pkg), ratings: new Map(), dispositions: new Map() };
  return { result, key: discKeyScore(ctx).score };
}

describe('score separation over a lattice of 256 Workday 1 error combinations', () => {
  const lattice = Array.from({ length: 1 << NAMES.length }, (_, mask) => t1For(mask));

  it('keeps every rating and task score within bounds', () => {
    for (const { result } of lattice) {
      for (const c of result.criteria) {
        if (c.rating !== null) expect([0, 1, 2, 3, 4]).toContain(c.rating);
        expect(c.max_reachable_q).toBeGreaterThanOrEqual(c.points_q ?? 0);
      }
      expect(result.tasks.T1.score_q).toBeGreaterThanOrEqual(0);
      expect(result.tasks.T1.score_q).toBeLessThanOrEqual(400);
    }
  });

  it('never rewards an added error: T1 score and DISC key score are monotone', () => {
    for (let mask = 0; mask < lattice.length; mask++) {
      for (let i = 0; i < NAMES.length; i++) {
        if (mask & (1 << i)) continue;
        const better = lattice[mask];
        const worse = lattice[mask | (1 << i)];
        expect(worse.result.tasks.T1.score_q, `adding ${NAMES[i]} to mask ${mask}`).toBeLessThanOrEqual(better.result.tasks.T1.score_q);
        expect(worse.key, `key score adding ${NAMES[i]} to mask ${mask}`).toBeLessThanOrEqual(better.key);
      }
    }
  });

  it('registers every single error on a perfect review in the task score or the DISC key score', () => {
    const perfect = lattice[0];
    NAMES.forEach((name, i) => {
      const one = lattice[1 << i];
      const lower = one.result.tasks.T1.score_q < perfect.result.tasks.T1.score_q || one.key < perfect.key;
      expect(lower, name).toBe(true);
    });
    // One flagged clean record costs 2 key points but stays in the DISC_R4 band (persona 5 needs three to drop a band).
    expect(lattice[1 << NAMES.indexOf('flag206')].key).toBe(98);
  });

  it('separates materially different behaviour into distinct scores', () => {
    const scores = new Set(lattice.map((l) => l.result.tasks.T1.score_q));
    const pairs = new Set(lattice.map((l) => `${l.result.tasks.T1.score_q}|${l.key}`));
    expect(scores.size).toBeGreaterThanOrEqual(10);
    expect(pairs.size).toBeGreaterThanOrEqual(18);
    const outcomes = new Set(PERSONAS.map((p) => {
      const b = p.build();
      return calculateAssessment({ events: b.events, reviewerRatings: b.ratings, grDispositions: b.dispositions, pkg, evaluatedAt: 0, closed: true }).outcome;
    }));
    expect([...outcomes].sort()).toEqual(['DOES_NOT_MEET_BAR', 'HOLD_FOR_REVIEW', 'INCOMPLETE', 'MEETS_BAR', 'PARTIALLY_MEETS_BAR']);
  });
});
