/**
 * Report shapes shared by the server and the client: the human-readable evidence view built from the event log
 * (assessor packets, the admin explorer and employer reports) and the public parts of a scored result. These are
 * shapes only; nothing here is scoring content.
 */

export interface FindingView {
  id: string;
  target: string;
  participant_id: string | null;
  document: { id: string; section_id: string } | null;
  location: string | null;
  finding_type: string;
  severity: string | null;
  reference_codes: string[];
  observed_issue: string;
  action: string;
  status: string | null;
  query_text: string;
  at: string;
  at_min: number | null;
  withdrawn: boolean;
}

export interface TimelineEntry {
  seq: number;
  at: string;
  task: string;
  source: string;
  type: string;
  label: string;
  event_id: string;
}

export interface EvidenceView {
  t1: {
    started_at: string | null;
    submitted_at: string | null;
    duration_min: number | null;
    briefing_read_min: number | null;
    findings: FindingView[];
    no_deviation: string[];
    escalations: { id: string; participant_id: string | null; to: string[]; cc: string[]; visit: string | null; fields: string[]; facts: string; requested_action: string; at: string; at_min: number | null; event_id: string }[];
    notes: { id: string; to: string[]; subject: string; text: string; at: string; at_min: number | null; event_id: string }[];
    records_opened: { participant_id: string; first_at_min: number | null }[];
    documents_opened: { document_id: string; section_id: string; label: string; first_at_min: number | null; count: number }[];
    safety_signal: { participant_id: string; first_open_min: number | null; first_escalation_min: number | null; minutes_to_escalation: number | null; escalated_to: string[] } | null;
    challenge_section: { label: string; opened_at_min: number | null; opens: number; findings: string[]; notes: number } | null;
    source_edits: { participant_id: string; visit: string | null; field: string | null; commits: number; reverts: number; left_changed: boolean }[];
    corrections: { participant_id: string; visit: string | null; field: string | null; proposed: string }[];
  };
  t2: {
    started_at: string | null;
    submitted_at: string | null;
    sponsor_opened_at: string | null;
    decisions: { sae: { value: string; label: string | null; at_min: number | null } | null; waiver: { value: string; label: string | null; at_min: number | null } | null };
    reply: { to: string[]; cc: string[]; subject: string; body: string; at: string; at_min: number | null; event_id: string } | null;
    messages: { id: string; to: string[]; cc: string[]; subject: string; body: string; at: string; at_min: number | null; event_id: string }[];
    record: Record<'sae' | 'waiver', { summary: string; status: string; owner: string; next_step: string; date: string; at_min: number | null } | null> & { narrative: string };
  };
  timeline: TimelineEntry[];
}

export interface ResultCriterionView {
  criterion_id: string;
  task: 'T1' | 'T2';
  name: string;
  weight: number;
  method: 'Auto' | 'Reviewer';
  competency: string;
  status: 'SCORED' | 'PENDING';
  rating: number | null;
  raw_rating: number | null;
  cap: number | null;
  cap_reasons: string[];
  rule_id: string;
  points_q: number | null;
  max_reachable_q: number;
  source: 'auto' | 'auto_rule' | 'reviewer' | 'none';
  needs_review: boolean;
  explanation: string;
  evidence_event_ids: string[];
}

export interface ResultGateView {
  gate_id: 'G1' | 'G2' | 'G3' | 'GR';
  task: 'T1' | 'T2';
  fired: boolean;
  clauses?: { clause: 'delay' | 'waiver'; fired: boolean; disposition: 'cleared' | 'confirmed' | null; matches: string[] }[];
  resolved?: boolean;
  reason: string;
  evidence_event_ids: string[];
}

export interface ResultCompetencyView {
  competency_id: string;
  name: string;
  criteria: string[];
  scored_criteria: string[];
  reportable: boolean;
  score: number | null;
}

export interface ResultTaskView {
  task: 'T1' | 'T2';
  submitted: boolean;
  score_q: number;
  best_q: number;
  pending_criteria: string[];
}

/** The scored result as stored (staff views). Employers get a reduced report built from it. */
export interface ResultView {
  engine_version: string;
  package_id: string;
  package_label: string;
  input_digest: string;
  status: 'provisional' | 'final';
  outcome: string | null;
  outcome_locked: boolean;
  outcome_reason: string;
  tasks: Record<'T1' | 'T2', ResultTaskView>;
  criteria: ResultCriterionView[];
  gates: ResultGateView[];
  competencies: ResultCompetencyView[];
  pending_review: string[];
}
