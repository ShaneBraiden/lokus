import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Outcome } from '@lokus/shared';
import { describe, expect, it } from 'vitest';
import { CRITERIA, PERSONAS, RUBRIC_V1_1, calculateAssessment, decideOutcome, defaultScoringPackage, type CriterionId, type Rating, type TaskScore } from '../src';

const wb = JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/workbook_v1_1.json', import.meta.url)), 'utf8'));
const OUTCOME: Record<string, Outcome> = {
  'Meets bar': 'MEETS_BAR',
  'Does not meet bar': 'DOES_NOT_MEET_BAR',
  'Hold for review': 'HOLD_FOR_REVIEW',
  'Partially meets bar': 'PARTIALLY_MEETS_BAR',
  Incomplete: 'INCOMPLETE',
};
const pkg = defaultScoringPackage();

describe('workbook outcome formula (rating-level layer)', () => {
  const rows: [string, any][] = wb.regression_personas.map((r: any) => [r.Persona, r]);
  it.each(rows)('%s', (_name, row) => {
    const finished = row.Finished === 1;
    const task = (t: 'T1' | 'T2'): TaskScore => {
      const ids = RUBRIC_V1_1.criteria.filter((c) => c.task === t);
      const q = ids.reduce((s, c) => s + (finished ? (row[c.id] as number) * c.weight : 0), 0);
      return { task: t, submitted: finished, score_q: q, best_q: q, pending_criteria: [] };
    };
    const gates = (['G1', 'G2', 'G3'] as const).filter((g) => row[g] === 1);
    const d = decideOutcome({
      t1: task('T1'),
      t2: task('T2'),
      discRating: finished ? (row.T1_DISC as Rating) : null,
      gatesFired: gates,
      grFired: row.GR === 1,
      grResolved: false,
      closed: true,
      params: pkg.parameters,
    });
    expect(d.outcome).toBe(OUTCOME[row['Expected outcome']]);
    if (finished) {
      expect(task('T1').score_q / 4).toBe(row['T1 score']);
      expect(task('T2').score_q / 4).toBe(row['T2 score']);
    }
  });
});

function expectationFor(persona: (typeof PERSONAS)[number]) {
  if (persona.expected) return persona.expected;
  const row = wb.regression_personas.find((r: any) => r.Persona === persona.workbookRow);
  if (!row) throw new Error(`no workbook row for ${persona.id}`);
  const finished = row.Finished === 1;
  const ratings: Partial<Record<CriterionId, Rating | null>> = {};
  for (const c of CRITERIA) ratings[c] = finished ? (row[c] as Rating) : null;
  return {
    ratings,
    t1: finished ? (row['T1 score'] as number) : ('Pending' as const),
    t2: finished ? (row['T2 score'] as number) : ('Pending' as const),
    gates: { G1: row.G1, G2: row.G2, G3: row.G3, GR: row.GR },
    outcome: OUTCOME[row['Expected outcome']],
    discKey: finished ? (row['DISC key score'] as number) : null,
  };
}

describe('regression personas (event-level layer)', () => {
  it('covers all 13 workbook personas', () => {
    const rows = wb.regression_personas.map((r: any) => r.Persona);
    expect(PERSONAS.filter((p) => p.workbookRow).map((p) => p.workbookRow)).toEqual(rows);
  });

  it.each(PERSONAS.map((p) => [p.id, p.name, p]))('%s %s', (_id, _name, persona) => {
    const exp = expectationFor(persona);
    const run = persona.build();
    const result = calculateAssessment({ events: run.events, reviewerRatings: run.ratings, grDispositions: run.dispositions, pkg, evaluatedAt: 0, closed: true });

    for (const [id, rating] of Object.entries(exp.ratings)) {
      const c = result.criteria.find((x) => x.criterion_id === id)!;
      expect({ id, rating: c.rating, status: c.status, why: c.explanation }).toMatchObject({ id, rating, status: rating === null ? 'PENDING' : 'SCORED' });
    }
    const score = (t: 'T1' | 'T2') => (result.tasks[t].submitted ? result.tasks[t].score_q / 4 : 'Pending');
    expect(score('T1')).toBe(exp.t1);
    expect(score('T2')).toBe(exp.t2);
    const fired = Object.fromEntries(result.gates.map((g) => [g.gate_id, g.fired ? 1 : 0]));
    expect(fired).toEqual(exp.gates);
    expect(result.outcome).toBe(exp.outcome);
    expect(result.status).toBe('final');
  });

  it('reproduces the workbook DISC key scores for submitted personas', () => {
    for (const persona of PERSONAS.filter((p) => p.workbookRow)) {
      const exp = expectationFor(persona) as ReturnType<typeof expectationFor> & { discKey: number | null };
      if (exp.discKey === null) continue;
      const run = persona.build();
      const result = calculateAssessment({ events: run.events, reviewerRatings: run.ratings, pkg, evaluatedAt: 0, closed: true });
      const disc = result.criteria.find((c) => c.criterion_id === 'T1_DISC')!;
      expect(disc.explanation, persona.id).toContain(`Key score ${exp.discKey}/100`);
    }
  });
});
