import type { Outcome } from '@lokus/shared';
import workbook from '../../fixtures/workbook_v1_1.json';
import { calculateAssessment } from './calculate';
import { PERSONAS, type Persona, type PersonaExpectation } from './personas';
import { CRITERIA, type CriterionId, type Rating, type ScoringPackage } from './types';

const OUTCOME_BY_LABEL: Record<string, Outcome> = {
  'Meets bar': 'MEETS_BAR',
  'Does not meet bar': 'DOES_NOT_MEET_BAR',
  'Hold for review': 'HOLD_FOR_REVIEW',
  'Partially meets bar': 'PARTIALLY_MEETS_BAR',
  Incomplete: 'INCOMPLETE',
};

interface WorkbookPersonaRow {
  Persona: string;
  Finished: number;
  'T1 score': number | string;
  'T2 score': number | string;
  'Expected outcome': string;
  G1: number;
  G2: number;
  G3: number;
  GR: number;
  [criterion: string]: unknown;
}

/** Expected values for a persona: the workbook row for workbook personas, the fixture's own expectation otherwise. */
export function personaExpectation(persona: Persona): PersonaExpectation {
  if (persona.expected) return persona.expected;
  const row = (workbook.regression_personas as unknown as WorkbookPersonaRow[]).find((r) => r.Persona === persona.workbookRow);
  if (!row) throw new Error(`No workbook row for persona ${persona.id}`);
  const finished = row.Finished === 1;
  const ratings: Partial<Record<CriterionId, Rating | null>> = {};
  for (const c of CRITERIA) ratings[c] = finished ? (row[c] as Rating) : null;
  return {
    ratings,
    t1: finished ? Number(row['T1 score']) : 'Pending',
    t2: finished ? Number(row['T2 score']) : 'Pending',
    gates: { G1: row.G1 as 0 | 1, G2: row.G2 as 0 | 1, G3: row.G3 as 0 | 1, GR: row.GR as 0 | 1 },
    outcome: OUTCOME_BY_LABEL[row['Expected outcome']],
  };
}

export interface RegressionCase {
  persona_id: string;
  name: string;
  workbook_row: string | null;
  passed: boolean;
  mismatches: string[];
  expected: { t1: number | 'Pending'; t2: number | 'Pending'; outcome: Outcome; gates: Record<string, number> };
  actual: { t1: number | 'Pending'; t2: number | 'Pending'; outcome: Outcome | null; gates: Record<string, number> };
}

export interface RegressionReport {
  passed: boolean;
  total: number;
  failed: number;
  cases: RegressionCase[];
}

/**
 * Runs every regression persona against a scoring package (spec build step 10). Publishing a package requires a
 * passing report. Pure and deterministic: the same package always yields the same report.
 */
export function runRegressionSuite(pkg: ScoringPackage): RegressionReport {
  const cases = PERSONAS.map((persona): RegressionCase => {
    const exp = personaExpectation(persona);
    const run = persona.build();
    const result = calculateAssessment({ events: run.events, reviewerRatings: run.ratings, grDispositions: run.dispositions, pkg, evaluatedAt: 0, closed: true });
    const mismatches: string[] = [];
    for (const [id, rating] of Object.entries(exp.ratings)) {
      const c = result.criteria.find((x) => x.criterion_id === id);
      if (!c || c.rating !== rating) mismatches.push(`${id}: expected ${rating ?? 'PENDING'}, got ${c?.rating ?? 'PENDING'}`);
    }
    const score = (t: 'T1' | 'T2') => (result.tasks[t].submitted ? result.tasks[t].score_q / 4 : ('Pending' as const));
    const gates = Object.fromEntries(result.gates.map((g) => [g.gate_id, g.fired ? 1 : 0]));
    if (score('T1') !== exp.t1) mismatches.push(`T1 score: expected ${exp.t1}, got ${score('T1')}`);
    if (score('T2') !== exp.t2) mismatches.push(`T2 score: expected ${exp.t2}, got ${score('T2')}`);
    for (const [g, v] of Object.entries(exp.gates)) if (gates[g] !== v) mismatches.push(`${g}: expected ${v}, got ${gates[g]}`);
    if (result.outcome !== exp.outcome) mismatches.push(`outcome: expected ${exp.outcome}, got ${result.outcome}`);
    return {
      persona_id: persona.id,
      name: persona.name,
      workbook_row: persona.workbookRow ?? null,
      passed: mismatches.length === 0,
      mismatches,
      expected: { t1: exp.t1, t2: exp.t2, outcome: exp.outcome, gates: exp.gates },
      actual: { t1: score('T1'), t2: score('T2'), outcome: result.outcome, gates },
    };
  });
  const failed = cases.filter((c) => !c.passed).length;
  return { passed: failed === 0, total: cases.length, failed, cases };
}
