import { buildEvidence, type AssessmentResult, type ScoringPackage } from '#engine';
import { GATE_LABELS, OUTCOME_LABELS, type EvidenceView, type GateId, type Outcome } from '@lokus/shared';
import type { AppDeps } from '../context';
import { listEvents, toEngineEvents, type AttemptRow } from './eventStore';
import { buildEvidenceView } from './evidenceView';
import { latestResult } from './scoring';
import { loadScoringPackage } from './scoringPackages';

/**
 * The employer-permitted view of a result (workbook Outcome_Rules "Visibility"): outcome, true task scores, gate
 * flags, competencies C1–C4 and links to the candidate's evidence. Never criterion ratings, caps, rule ids,
 * assessor rationale or anything from the answer key.
 */

export type OutcomeKey = Outcome | 'AWAITING_REVIEW';

export interface EmployerResult {
  status: 'provisional' | 'final';
  outcome: OutcomeKey;
  outcome_label: string;
  outcome_locked: boolean;
  reason: string;
  t1: number | null;
  t2: number | null;
  scores_final: boolean;
  gates: { gate_id: GateId; label: string; fired: boolean; held: boolean; explanation: string; evidence: 'evidence-safety' | 'evidence-decisions' | 'evidence-reply' }[];
  competencies: { id: string; name: string; reportable: boolean; score: number | null }[];
  computed_at: string;
}

const GATE_TEXT: Record<GateId, { fired: string; clear: string; evidence: EmployerResult['gates'][number]['evidence'] }> = {
  G1: { fired: 'The participant with the safety signal was never escalated through the safety pathway.', clear: 'The safety signal was escalated.', evidence: 'evidence-safety' },
  G2: { fired: 'The candidate chose to wait with the SAE report until after the interim analysis.', clear: 'The candidate chose to report the SAE now.', evidence: 'evidence-decisions' },
  G3: { fired: 'The candidate accepted the informal screening waiver.', clear: 'The candidate declined the informal waiver.', evidence: 'evidence-decisions' },
  GR: { fired: 'The written reply or record appears to agree with a request the candidate declined.', clear: 'Written work is consistent with the decisions.', evidence: 'evidence-reply' },
};

export function outcomeKeyOf(result: Pick<AssessmentResult, 'status' | 'outcome' | 'outcome_locked'>): OutcomeKey {
  if (result.outcome && (result.status === 'final' || result.outcome_locked)) return result.outcome;
  return 'AWAITING_REVIEW';
}

/** Plain-language reason without criterion ids, band thresholds or other rubric internals. */
function plainReason(result: AssessmentResult, key: OutcomeKey, pkg: ScoringPackage): string {
  const fired = result.gates.filter((g) => g.fired && g.gate_id !== 'GR').map((g) => GATE_LABELS[g.gate_id as GateId].toLowerCase());
  const day = (t: 'T1' | 'T2') => (t === 'T1' ? 'Workday 1' : 'Workday 2');
  const below = (['T1', 'T2'] as const).filter((t) => result.tasks[t].score_q / 4 < pkg.parameters.BAND_MEETS).map(day);
  // "Well below" only names a workday that cannot reach the floor even with the best pending ratings.
  const floor = (['T1', 'T2'] as const).filter((t) => result.tasks[t].best_q / 4 < pkg.parameters.BAND_FLOOR).map(day);
  switch (key) {
    case 'INCOMPLETE':
      return !result.tasks.T1.submitted ? 'Workday 1 was not submitted.' : 'Workday 2 was not submitted.';
    case 'AWAITING_REVIEW':
      return 'Submitted. Trained assessors are rating the written work; the result becomes final when they finish.';
    case 'HOLD_FOR_REVIEW':
      return 'The written reply or record appears to conflict with a decision. An assessor is checking it before the result is final.';
    case 'MEETS_BAR':
      return 'Both workdays met the bar, with no critical flags.';
    case 'PARTIALLY_MEETS_BAR':
      return below.length ? `${below.join(' and ')} ${below.length > 1 ? 'are' : 'is'} below the bar; no critical flags were raised.` : 'Part of the work is below the bar; no critical flags were raised.';
    case 'DOES_NOT_MEET_BAR':
      return fired.length ? `Critical flag${fired.length > 1 ? 's' : ''}: ${fired.join('; ')}.` : `${floor.join(' and ') || 'A workday'} ${floor.length > 1 ? 'are' : 'is'} well below the bar.`;
  }
}

export function employerResult(result: AssessmentResult, pkg: ScoringPackage, computedAt: Date): EmployerResult {
  const key = outcomeKeyOf(result);
  const final = result.status === 'final';
  return {
    status: result.status,
    outcome: key,
    outcome_label: key === 'AWAITING_REVIEW' ? 'Awaiting review' : OUTCOME_LABELS[key],
    outcome_locked: result.outcome_locked,
    reason: plainReason(result, key, pkg),
    t1: final ? result.tasks.T1.score_q / 4 : null,
    t2: final ? result.tasks.T2.score_q / 4 : null,
    scores_final: final,
    gates: result.gates.map((g) => {
      const id = g.gate_id as GateId;
      const held = id === 'GR' && g.fired && !g.resolved;
      return { gate_id: id, label: GATE_LABELS[id], fired: g.fired, held, explanation: g.fired ? GATE_TEXT[id].fired : GATE_TEXT[id].clear, evidence: GATE_TEXT[id].evidence };
    }),
    competencies: result.competencies.map((c) => ({ id: c.competency_id, name: c.name, reportable: final && c.reportable, score: final && c.reportable ? c.score : null })),
    computed_at: computedAt.toISOString(),
  };
}

export async function buildEmployerReport(deps: Pick<AppDeps, 'db'>, attempt: AttemptRow): Promise<{ result: EmployerResult | null; evidence: EvidenceView }> {
  const pkg = await loadScoringPackage(deps.db, attempt.scoringPackageId);
  const rows = await listEvents(deps.db, attempt.id);
  const evidence = buildEvidenceView(rows, buildEvidence(toEngineEvents(rows), pkg), pkg);
  const stored = await latestResult(deps.db, attempt.id);
  return { result: stored ? employerResult(stored.result as AssessmentResult, pkg, stored.computedAt) : null, evidence };
}
