import type { CompetencyId, GateId, Outcome, ResultStatus } from '@lokus/shared';

export type TaskId = 'T1' | 'T2';
export type Rating = 0 | 1 | 2 | 3 | 4;

/** O = server-observed, C = validated command, S = system, T = telemetry (never scored). */
export type EventSource = 'O' | 'C' | 'S' | 'T';

/** Immutable assessment event as stored by the API (spec "Immutable event model" plus ordering fields). */
export interface EngineEvent {
  event_id: string;
  seq: number;
  task_id: TaskId | 'SYS';
  event_type: string;
  object_id?: string | null;
  metadata: Record<string, unknown>;
  /** Authoritative server time, epoch milliseconds. */
  server_ts: number;
  source: EventSource;
}

export const T1_CRITERIA = ['T1_DISC', 'T1_SEC4', 'T1_SAFE', 'T1_QUERY', 'T1_RESTR', 'T1_SEV', 'T1_DOC'] as const;
export const T2_CRITERIA = ['T2_REFUSE', 'T2_WAIV', 'T2_ESC', 'T2_REC', 'T2_TONE'] as const;
export const CRITERIA = [...T1_CRITERIA, ...T2_CRITERIA] as const;
export type CriterionId = (typeof CRITERIA)[number];

export const REVIEWER_CRITERIA = ['T1_SEC4', 'T1_QUERY', 'T2_REFUSE', 'T2_WAIV', 'T2_REC', 'T2_TONE'] as const;
export type ReviewerCriterionId = (typeof REVIEWER_CRITERIA)[number];

export interface ReviewerRatingInput {
  id: string;
  criterion_id: ReviewerCriterionId;
  raw_rating: Rating;
  rationale: string;
  assessor_id: string;
  created_at: number;
}

export type GrClause = 'delay' | 'waiver';
export interface GrDispositionInput {
  id: string;
  clause: GrClause;
  disposition: 'cleared' | 'confirmed';
  note: string;
  assessor_id: string;
  created_at: number;
}

export interface CriterionDefinition {
  id: CriterionId;
  task: TaskId;
  name: string;
  weight: number;
  method: 'Auto' | 'Reviewer';
  competency: CompetencyId;
  what_to_observe: string;
  anchors: Record<Rating, string>;
  notes: string;
}

export interface GateDefinition {
  id: GateId;
  task: TaskId;
  trigger: string;
  effect: string;
  severity: 'Critical' | 'High';
}

export interface CompetencyDefinition {
  id: CompetencyId;
  name: string;
  definition: string;
  criteria: CriterionId[];
}

export interface RubricConfig {
  version: string;
  criteria: CriterionDefinition[];
  gates: GateDefinition[];
  competencies: CompetencyDefinition[];
}

export interface Parameters {
  BAND_MEETS: number;
  BAND_FLOOR: number;
  DISC_MEETS_MIN: number;
  DISC_R4: number;
  DISC_R3: number;
  DISC_R2: number;
  DISC_R1: number;
  SAFE_FAST: number;
  SAFE_LATE: number;
  W2_CLOCK: number;
  ESC_FAST: number;
  ESC_LATE: number;
  QUERY_LEAD_CAP: number;
  WAIV_NOREC_CAP: number;
  REC_NOSTATUS_CAP: number;
  REC_FALSE_CAP: number;
  /** SME draft: whether T1_DISC evidence tokens also match the finding's selected visit/field labels. */
  TOKEN_SCOPE: 'issue_text' | 'issue_text_and_location';
}

export interface AnswerKeyRow {
  participant_id: string;
  class: 'CLEAN' | 'FINDING';
  category: string;
  crf_page: number;
  crf_visit: string;
  crf_field: string;
  value_as_shown: string;
  expected_reference: string | null;
  accepted_types: string[];
  accepted_severities: string[];
  evidence_tokens: string[];
  points: number;
  why_correct: string;
  tolerated_observation: string | null;
}

/** SME-draft phrase and token lists. Matching is case-insensitive on NFKC-normalised text. */
export interface PhraseLists {
  leading_phrases: string[];
  correction_directives: string[];
  gr_delay_agreement: string[];
  gr_waiver_acceptance: string[];
  negation_cues: string[];
  /** Reported-speech cues ("asked", "requested") before a GR phrase mean the text describes the request. */
  attribution_cues: string[];
  safe_symptom_tokens: string[];
  safe_location_tokens: string[];
  esc_sae_tokens: string[];
  esc_waiver_tokens: string[];
  esc_decision_tokens: string[];
  waiver_mention_tokens: string[];
}

export interface ScoringPackage {
  id: string;
  label: string;
  engine_version: string;
  rubric: RubricConfig;
  parameters: Parameters;
  phrase_lists: PhraseLists;
  answer_key: AnswerKeyRow[];
  /** Identifiers that must stay stable between content and scoring. */
  identifiers: {
    safety_participant_id: string;
    sponsor_email_id: string;
    manager_directory_id: string;
    icf_document_id: string;
    icf_challenge_section_id: string;
    safety_finding_type: string;
  };
}

export type CriterionStatus = 'SCORED' | 'PENDING';

export interface CriterionResult {
  criterion_id: CriterionId;
  task: TaskId;
  name: string;
  weight: number;
  method: 'Auto' | 'Reviewer';
  competency: CompetencyId;
  status: CriterionStatus;
  /** Effective rating after caps; null while PENDING. */
  rating: Rating | null;
  /** Rating before caps (auto rule result or the assessor's raw rating). */
  raw_rating: Rating | null;
  cap: number | null;
  cap_reasons: string[];
  rule_id: string;
  /** rating × weight, i.e. points in quarter-points (points = points_q / 4). */
  points_q: number | null;
  /** Best points still reachable (cap or 4 for pending criteria). */
  max_reachable_q: number;
  source: 'auto' | 'auto_rule' | 'reviewer' | 'none';
  needs_review: boolean;
  explanation: string;
  evidence_event_ids: string[];
}

export interface GateResult {
  gate_id: GateId;
  task: TaskId;
  fired: boolean;
  /** GR only: clauses that fired and whether every fired clause has an assessor disposition. */
  clauses?: { clause: GrClause; fired: boolean; disposition: 'cleared' | 'confirmed' | null; matches: string[] }[];
  resolved?: boolean;
  reason: string;
  evidence_event_ids: string[];
}

export interface TaskScore {
  task: TaskId;
  submitted: boolean;
  /** Sum of scored points in quarter-points (0–400). */
  score_q: number;
  /** Best reachable score in quarter-points if every pending criterion reached its maximum. */
  best_q: number;
  pending_criteria: CriterionId[];
}

export interface CompetencyScore {
  competency_id: CompetencyId;
  name: string;
  criteria: CriterionId[];
  scored_criteria: CriterionId[];
  reportable: boolean;
  /** 0–100, two decimals; null when not reportable. */
  score: number | null;
}

export interface AssessmentResult {
  engine_version: string;
  package_id: string;
  package_label: string;
  input_digest: string;
  evaluated_at: number;
  status: ResultStatus;
  /** null while the outcome still depends on pending reviewer ratings. */
  outcome: Outcome | null;
  /** true when the outcome can no longer change, even if ratings are still pending. */
  outcome_locked: boolean;
  outcome_reason: string;
  tasks: Record<TaskId, TaskScore>;
  criteria: CriterionResult[];
  gates: GateResult[];
  competencies: CompetencyScore[];
  pending_review: ReviewerCriterionId[];
  events_considered: number;
}
