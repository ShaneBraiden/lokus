/** Response shapes shared by the API and the web app. Candidate-facing DTOs never carry scores, caps or ratings. */
import type { FindingTargetInput } from './commands';
import type { AttemptStatus } from './roles';

export type ContentBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'note'; text: string }
  | { type: 'clause'; code: string; title: string; blocks: ContentBlock[] }
  | { type: 'signature'; lines: string[] };

export type AttemptPhase = 'intro' | 'workday1' | 'between' | 'workday2' | 'done' | 'closed';

export interface FindingDTO {
  id: string;
  version: number;
  target: FindingTargetInput;
  visit: string | null;
  crf_field: string | null;
  finding_type: string;
  severity: string | null;
  reference_codes: string[];
  observed_issue: string;
  action: string;
  status: string | null;
  query_text: string;
  created_at: string;
  updated_at: string;
  withdrawn: boolean;
}

export interface SafetyEscalationDTO {
  id: string;
  participant_id: string;
  to: string[];
  cc: string[];
  visit: string | null;
  fields: string[];
  facts: string;
  requested_action: string;
  sent_at: string;
}

export interface NoteDTO {
  id: string;
  to: string[];
  subject: string;
  text: string;
  sent_at: string;
}

export interface EditedCellDTO {
  participant_id: string;
  visit: string;
  field: string;
  original: string;
  value: string;
}

export interface CorrectionDTO {
  participant_id: string;
  visit: string;
  field: string;
  proposed: string;
  rationale: string;
  at: string;
}

export interface ParticipantSummaryDTO {
  id: string;
  page: number;
  opened: boolean;
  status: 'unreviewed' | 'no_deviation' | 'findings';
  finding_ids: string[];
}

export interface ClockDTO {
  started_at: string;
  ends_at: string;
  duration_minutes: number;
  remaining_ms: number;
  overtime: boolean;
}

export interface SentMailDTO {
  id: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  sent_at: string;
}

export interface RequestRecordDTO {
  summary: string;
  status: string;
  owner: string;
  next_step: string;
  date: string;
  saved_at: string;
}

export interface AttemptStateDTO {
  server_time: string;
  attempt: {
    id: string;
    status: AttemptStatus;
    status_label: string;
    phase: AttemptPhase;
    simulation_title: string;
    org_name: string | null;
    deadline_at: string | null;
    started_at: string | null;
    t1_submitted_at: string | null;
    t2_submitted_at: string | null;
    close_reason: string | null;
    lockdown: { required: boolean; strikes: number; limit: number };
  };
  candidate: { name: string; first_name: string; email: string };
  progress: { version: number; state: Record<string, unknown> };
  t1: {
    started: boolean;
    submitted: boolean;
    participants: ParticipantSummaryDTO[];
    findings: FindingDTO[];
    escalations: SafetyEscalationDTO[];
    notes: NoteDTO[];
    edited_cells: EditedCellDTO[];
    corrections: CorrectionDTO[];
    unreviewed: string[];
  };
  t2: {
    started: boolean;
    submitted: boolean;
    sponsor_opened: boolean;
    clock: ClockDTO | null;
    decisions: { sae: string | null; waiver: string | null };
    decisions_locked: boolean;
    reply: SentMailDTO | null;
    messages: SentMailDTO[];
    record: { sae: RequestRecordDTO | null; waiver: RequestRecordDTO | null; narrative: string };
    opened_emails: string[];
  };
}

export interface CrfVisitDTO {
  visit: string;
  visit_number: number;
  week: number;
  values: Record<string, string>;
}

export interface ParticipantCrfDTO {
  id: string;
  page: number;
  header: Record<string, string>;
  visits: CrfVisitDTO[];
  edits: EditedCellDTO[];
}

export interface DocumentSummaryDTO {
  id: string;
  title: string;
  short_title: string;
  subtitle: string;
  version: string;
  status: string;
  owner: string;
  header: { label: string; value: string }[];
  footer?: string;
  sections: { id: string; number?: string; title: string }[];
}

export interface DocumentSectionDTO {
  document_id: string;
  id: string;
  number?: string;
  title: string;
  blocks: ContentBlock[];
}

export interface ReferenceCodeDTO {
  code: string;
  title: string;
  document_id: string;
  section_id: string;
}

export interface MailSummaryDTO {
  id: string;
  from_name: string;
  from_role: string;
  from_organisation: string;
  subject: string;
  preview: string;
  sent_at: string;
  opened: boolean;
}

export interface MailMessageDTO {
  id: string;
  from: { name: string; role: string; organisation: string; email: string };
  to: string[];
  cc: string[];
  sent_at: string;
  subject: string;
  body: string[];
  signature: string[];
}
