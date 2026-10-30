import type { Outcome, ResultStatus } from '@lokus/shared';
import { evaluateCriterion, type EvalContext } from './criteria';
import { canonicalJson, sha256Hex } from './digest';
import { buildEvidence, orderEvents, positionT2Text, type Evidence } from './evidence';
import { packageDigest } from './package';
import { affirmedPhrases } from './text';
import type {
  AssessmentResult,
  CompetencyScore,
  CriterionId,
  CriterionResult,
  EngineEvent,
  GateResult,
  GrClause,
  GrDispositionInput,
  Parameters,
  Rating,
  ReviewerCriterionId,
  ReviewerRatingInput,
  ScoringPackage,
  TaskId,
  TaskScore,
} from './types';
import { REVIEWER_CRITERIA } from './types';

export interface CalculateInput {
  events: readonly EngineEvent[];
  reviewerRatings?: readonly ReviewerRatingInput[];
  grDispositions?: readonly GrDispositionInput[];
  pkg: ScoringPackage;
  /** Passed in (never read from a clock) so results are reproducible. */
  evaluatedAt: number;
  /** The attempt can receive no more events (submitted, expired, withdrawn or closed by an admin). */
  closed?: boolean;
}

function latestBy<T extends { created_at: number; id: string }, K>(items: readonly T[], key: (t: T) => K): Map<K, T> {
  const out = new Map<K, T>();
  for (const it of [...items].sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id))) out.set(key(it), it);
  return out;
}

function evaluateGates(ev: Evidence, ctx: EvalContext): GateResult[] {
  const { t1, t2 } = ev;
  const { pkg } = ctx;
  const pid = pkg.identifiers.safety_participant_id;
  const escTo220 = t1.escalations.filter((e) => e.target_participant_id === pid);
  const firstOpen = t1.first_open.get(pid);
  const g1Fired = t1.submitted && escTo220.length === 0;

  const sae = t2.decisions.sae?.value ?? null;
  const waiver = t2.decisions.waiver?.value ?? null;
  const position = positionT2Text(t2);
  const lists = pkg.phrase_lists;
  const guards = { negation: lists.negation_cues, attribution: lists.attribution_cues };
  const clauseHits: Record<GrClause, string[]> = {
    delay: t2.submitted && sae === 'REPORT_NOW' ? affirmedPhrases(position, lists.gr_delay_agreement, guards) : [],
    waiver: t2.submitted && waiver === 'DECLINE_ROUTE' ? affirmedPhrases(position, lists.gr_waiver_acceptance, guards) : [],
  };
  const clauses = (['delay', 'waiver'] as const).map((clause) => ({
    clause,
    fired: clauseHits[clause].length > 0,
    disposition: clauseHits[clause].length > 0 ? ctx.dispositions.get(clause)?.disposition ?? null : null,
    matches: clauseHits[clause],
  }));
  const grFired = clauses.some((c) => c.fired);
  const grResolved = clauses.every((c) => !c.fired || c.disposition !== null);
  const textEvidence = [...(t2.reply ? [t2.reply.event_id] : []), ...[...t2.records.values()].map((r) => r.event_id), ...(t2.narrative ? [t2.narrative.event_id] : [])];

  return [
    {
      gate_id: 'G1',
      task: 'T1',
      fired: g1Fired,
      reason: g1Fired
        ? `Potential SAE (${pid}) present and no safety escalation was submitted for it.`
        : t1.submitted
          ? `A safety escalation for ${pid} was submitted.`
          : 'Workday 1 not submitted.',
      evidence_event_ids: [...(firstOpen ? [firstOpen.event_id] : []), ...escTo220.map((e) => e.event_id)],
    },
    {
      gate_id: 'G2',
      task: 'T2',
      fired: t2.submitted && sae === 'WAIT',
      reason: sae === 'WAIT' ? 'Forced choice on the SAE request was “Wait until after interim”.' : sae ? 'SAE request: “Report now” selected.' : 'No SAE decision recorded.',
      evidence_event_ids: t2.decisions.sae ? [t2.decisions.sae.event_id] : [],
    },
    {
      gate_id: 'G3',
      task: 'T2',
      fired: t2.submitted && waiver === 'ACCEPT',
      reason: waiver === 'ACCEPT' ? 'Forced choice on the waiver request was “Accept”.' : waiver ? 'Waiver request: “Decline and route” selected.' : 'No waiver decision recorded.',
      evidence_event_ids: t2.decisions.waiver ? [t2.decisions.waiver.event_id] : [],
    },
    {
      gate_id: 'GR',
      task: 'T2',
      fired: grFired,
      clauses,
      resolved: grResolved,
      reason: grFired
        ? `Candidate-written text appears to ${clauses.filter((c) => c.fired).map((c) => (c.clause === 'delay' ? 'agree to delay SAE reporting' : 'accept the waiver')).join(' and ')} despite the opposite selection${grResolved ? '; reviewed by an assessor' : '; held for human review'}.`
        : 'Reply and record text are consistent with the selections.',
      evidence_event_ids: grFired ? textEvidence : [],
    },
  ];
}

function taskScore(task: TaskId, submitted: boolean, criteria: CriterionResult[]): TaskScore {
  const mine = criteria.filter((c) => c.task === task);
  const scoreQ = mine.reduce((s, c) => s + (c.points_q ?? 0), 0);
  const pendingCriteria = mine.filter((c) => c.status === 'PENDING');
  return {
    task,
    submitted,
    score_q: scoreQ,
    best_q: scoreQ + pendingCriteria.reduce((s, c) => s + c.max_reachable_q, 0),
    pending_criteria: pendingCriteria.map((c) => c.criterion_id),
  };
}

function competencies(pkg: ScoringPackage, criteria: CriterionResult[]): CompetencyScore[] {
  return pkg.rubric.competencies.map((comp) => {
    const mapped = criteria.filter((c) => comp.criteria.includes(c.criterion_id));
    const scored = mapped.filter((c) => c.status === 'SCORED' && c.rating !== null);
    const reportable = scored.length >= 2;
    const num = scored.reduce((s, c) => s + (c.rating as number) * c.weight, 0);
    const den = 4 * scored.reduce((s, c) => s + c.weight, 0);
    return {
      competency_id: comp.id,
      name: comp.name,
      criteria: comp.criteria,
      scored_criteria: scored.map((c) => c.criterion_id),
      reportable,
      score: reportable && den > 0 ? Math.round((num * 10000) / den) / 100 : null,
    };
  });
}

export interface OutcomeDecision {
  outcome: Outcome | null;
  locked: boolean;
  status: ResultStatus;
  reason: string;
}

/** Workbook Outcome_Rules (first match wins), extended with the provisional "awaiting review" state. */
export function decideOutcome(input: {
  t1: TaskScore;
  t2: TaskScore;
  discRating: Rating | null;
  gatesFired: string[];
  grFired: boolean;
  grResolved: boolean;
  closed: boolean;
  params: Parameters;
}): OutcomeDecision {
  const { t1, t2, params } = input;
  const anyPending = t1.pending_criteria.length > 0 || t2.pending_criteria.length > 0;
  const status: ResultStatus = anyPending ? 'provisional' : 'final';
  if (!t1.submitted || !t2.submitted) {
    const which = [!t1.submitted && 'Workday 1', !t2.submitted && 'Workday 2'].filter(Boolean).join(' and ');
    return { outcome: 'INCOMPLETE', locked: input.closed, status: input.closed ? 'final' : 'provisional', reason: `${which} not submitted.` };
  }
  if (input.gatesFired.length) {
    return { outcome: 'DOES_NOT_MEET_BAR', locked: true, status, reason: `Critical gate fired: ${input.gatesFired.join(', ')}. The true score stays visible.` };
  }
  const floor = params.BAND_FLOOR * 4;
  if (anyPending) {
    if (Math.min(t1.best_q, t2.best_q) < floor) {
      return { outcome: 'DOES_NOT_MEET_BAR', locked: true, status, reason: `Even with the best remaining ratings, a task score stays below ${params.BAND_FLOOR}.` };
    }
    const n = t1.pending_criteria.length + t2.pending_criteria.length;
    return { outcome: null, locked: false, status, reason: `Awaiting assessor review of ${n} criteria.` };
  }
  if (Math.min(t1.score_q, t2.score_q) < floor) {
    return { outcome: 'DOES_NOT_MEET_BAR', locked: true, status, reason: `A task score is below ${params.BAND_FLOOR}.` };
  }
  if (input.grFired && !input.grResolved) {
    return { outcome: 'HOLD_FOR_REVIEW', locked: false, status, reason: 'Gate GR fired: text conflicts with a forced choice. Held for human review.' };
  }
  const meets = t1.score_q >= params.BAND_MEETS * 4 && t2.score_q >= params.BAND_MEETS * 4 && (input.discRating ?? 0) >= params.DISC_MEETS_MIN;
  if (meets) return { outcome: 'MEETS_BAR', locked: true, status, reason: `Both task scores are at least ${params.BAND_MEETS} and T1_DISC is at least ${params.DISC_MEETS_MIN}.` };
  const why =
    (input.discRating ?? 0) < params.DISC_MEETS_MIN && t1.score_q >= params.BAND_MEETS * 4 && t2.score_q >= params.BAND_MEETS * 4
      ? `T1_DISC rating ${input.discRating} is below the core-criterion floor of ${params.DISC_MEETS_MIN}.`
      : `A task score is between ${params.BAND_FLOOR} and ${params.BAND_MEETS}.`;
  return { outcome: 'PARTIALLY_MEETS_BAR', locked: true, status, reason: why };
}

export function inputDigest(input: CalculateInput): string {
  const events = orderEvents(input.events).filter((e) => e.source !== 'T');
  return sha256Hex(
    canonicalJson({
      package: packageDigest(input.pkg),
      events,
      ratings: [...(input.reviewerRatings ?? [])].sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id)),
      dispositions: [...(input.grDispositions ?? [])].sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id)),
      closed: Boolean(input.closed),
    }),
  );
}

/**
 * Deterministic v1.1 assessment (spec "Central scoring function"): validates and orders events, evaluates the 12
 * criteria, applies caps, computes task scores, gates, competencies and the outcome. Pure: no I/O, clock or randomness.
 */
export function calculateAssessment(input: CalculateInput): AssessmentResult {
  const { pkg } = input;
  const evidence = buildEvidence(input.events, pkg);
  const ctx: EvalContext = {
    pkg,
    evidence,
    ratings: latestBy(input.reviewerRatings ?? [], (r) => r.criterion_id as CriterionId),
    dispositions: latestBy(input.grDispositions ?? [], (d) => d.clause as string),
  };
  const criteria = pkg.rubric.criteria.map((def) => evaluateCriterion(def, ctx));
  const tasks: Record<TaskId, TaskScore> = {
    T1: taskScore('T1', evidence.t1.submitted, criteria),
    T2: taskScore('T2', evidence.t2.submitted, criteria),
  };
  const gates = evaluateGates(evidence, ctx);
  const gr = gates.find((g) => g.gate_id === 'GR')!;
  const disc = criteria.find((c) => c.criterion_id === 'T1_DISC')!;
  const decision = decideOutcome({
    t1: tasks.T1,
    t2: tasks.T2,
    discRating: disc.rating,
    gatesFired: gates.filter((g) => g.gate_id !== 'GR' && g.fired).map((g) => g.gate_id),
    grFired: gr.fired,
    grResolved: gr.resolved ?? true,
    closed: Boolean(input.closed),
    params: pkg.parameters,
  });
  const pendingReview = criteria
    .filter((c) => c.needs_review && (REVIEWER_CRITERIA as readonly string[]).includes(c.criterion_id))
    .map((c) => c.criterion_id as ReviewerCriterionId);

  return {
    engine_version: pkg.engine_version,
    package_id: pkg.id,
    package_label: pkg.label,
    input_digest: inputDigest(input),
    evaluated_at: input.evaluatedAt,
    status: decision.status,
    outcome: decision.outcome,
    outcome_locked: decision.locked,
    outcome_reason: decision.reason,
    tasks,
    criteria,
    gates,
    competencies: competencies(pkg, criteria),
    pending_review: pendingReview,
    events_considered: evidence.considered.length,
  };
}
