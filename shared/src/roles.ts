/** Platform roles (Lokus staff). Employer roles live on organisation memberships. */
export const PLATFORM_ROLES = ['admin', 'assessor'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ORG_ROLES = ['owner', 'recruiter'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Workbook Outcome_Rules labels (first match wins, in this order). */
export const OUTCOMES = ['INCOMPLETE', 'DOES_NOT_MEET_BAR', 'HOLD_FOR_REVIEW', 'MEETS_BAR', 'PARTIALLY_MEETS_BAR'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABELS: Record<Outcome, string> = {
  INCOMPLETE: 'Incomplete',
  DOES_NOT_MEET_BAR: 'Does not meet bar',
  HOLD_FOR_REVIEW: 'Hold for review',
  MEETS_BAR: 'Meets bar',
  PARTIALLY_MEETS_BAR: 'Partially meets bar',
};

/** A result is provisional while any criterion is PENDING (shown as "Awaiting review"). */
export type ResultStatus = 'provisional' | 'final';

export const ATTEMPT_STATUSES = [
  'not_started',
  'w1_in_progress',
  'w1_submitted',
  'w2_in_progress',
  'submitted',
  'closed',
  'void',
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

/** Candidate-facing labels: status only, never scores. */
export const ATTEMPT_STATUS_LABELS: Record<AttemptStatus, string> = {
  not_started: 'Not started',
  w1_in_progress: 'Workday 1 in progress',
  w1_submitted: 'Workday 1 submitted',
  w2_in_progress: 'Workday 2 in progress',
  submitted: 'Submitted',
  closed: 'Closed',
  void: 'Withdrawn',
};

export const GATE_IDS = ['G1', 'G2', 'G3', 'GR'] as const;
export type GateId = (typeof GATE_IDS)[number];

export const COMPETENCY_IDS = ['C1', 'C2', 'C3', 'C4'] as const;
export type CompetencyId = (typeof COMPETENCY_IDS)[number];

export const COMPETENCY_NAMES: Record<CompetencyId, string> = {
  C1: 'Safety recognition and escalation',
  C2: 'Integrity under pressure',
  C3: 'Data QC and compliance',
  C4: 'Professional communication',
};

export const COMPETENCY_DEFINITIONS: Record<CompetencyId, string> = {
  C1: 'Recognises safety signals and escalates through the correct pathway.',
  C2: 'Keeps safety, compliance and truthful status when instructions or stakeholders push the other way.',
  C3: 'Separates genuine discrepancies from valid entries, prioritises, documents and never alters source.',
  C4: 'Communicates neutrally, clearly and professionally, including when challenging.',
};

export const GATE_LABELS: Record<GateId, string> = {
  G1: 'Safety signal not escalated',
  G2: 'Agreed to delay SAE reporting',
  G3: 'Accepted an informal eligibility waiver',
  GR: 'Text conflicts with selection (held for review)',
};
