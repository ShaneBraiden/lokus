import type { EngineEvent, ScoringPackage, TaskId } from './types';

/**
 * Event metadata contracts. The API builds these from validated commands (source C) and from content it serves
 * (source O); the engine only reads them. Telemetry events (source T) are ignored.
 */
export type FindingTarget =
  | { type: 'participant'; participant_id: string }
  | { type: 'document'; document_id: string; section_id: string };

export interface FindingSnapshot {
  id: string;
  target: FindingTarget;
  visit: string | null; // 'W0' | 'W4' | 'W8' | 'W12' | 'NA'
  crf_field: string | null;
  finding_type: string;
  severity: string | null;
  reference_codes: string[];
  observed_issue: string;
  action: string;
  status: string | null;
  query_text: string;
}

export interface FindingState extends FindingSnapshot {
  created_ts: number;
  created_event_id: string;
  updated_ts: number;
  event_ids: string[];
  withdrawn: boolean;
}

export interface T1Escalation {
  event_id: string;
  ts: number;
  target_participant_id: string | null;
  to: string[];
  cc: string[];
  visit: string | null;
  fields: string[];
  facts: string;
  requested_action: string;
}

export interface CellKey {
  participant_id: string;
  visit: string;
  field: string;
}

export interface CellEditHistory {
  cell: CellKey;
  started: number;
  cancelled_changed: number;
  commits: number;
  reverts: number;
  /** Source value currently differs from the original (last commit not reverted). */
  left_changed: boolean;
  event_ids: string[];
}

export interface T1Evidence {
  started: boolean;
  submitted: boolean;
  submitted_ts: number | null;
  submit_event_id: string | null;
  first_open: Map<string, { ts: number; event_id: string }>;
  section_opens: Map<string, { first_ts: number; event_ids: string[] }>;
  instruction_views: { instruction_id: string; ts: number; event_id: string }[];
  clarifications: { event_id: string; ts: number; to: string[]; subject: string; text: string }[];
  findings: Map<string, FindingState>;
  no_deviation: Map<string, { recorded: boolean; event_id: string }>;
  escalations: T1Escalation[];
  cells: Map<string, CellEditHistory>;
  corrections_recommended: { event_id: string; cell: CellKey; proposed: string }[];
}

export interface T2Reply {
  event_id: string;
  ts: number;
  to: string[];
  cc: string[];
  subject: string;
  body_authored: string;
}

export interface T2Escalation {
  event_id: string;
  ts: number;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

export interface RequestRecord {
  event_id: string;
  ts: number;
  request: string;
  summary: string;
  status: string;
  owner: string;
  next_step: string;
  date: string;
}

export interface T2Evidence {
  started: boolean;
  submitted: boolean;
  submitted_ts: number | null;
  submit_event_id: string | null;
  sponsor_first_open: { ts: number; event_id: string } | null;
  emails_opened: Map<string, { ts: number; event_id: string }>;
  decisions: { sae: { value: string; event_id: string; ts: number } | null; waiver: { value: string; event_id: string; ts: number } | null };
  decision_event_ids: string[];
  reply: T2Reply | null;
  escalations: T2Escalation[];
  records: Map<string, RequestRecord>;
  narrative: { text: string; event_id: string; ts: number } | null;
}

export interface Evidence {
  t1: T1Evidence;
  t2: T2Evidence;
  /** Events used for scoring, ordered (telemetry and post-submission events excluded). */
  considered: EngineEvent[];
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function cellKeyString(c: CellKey): string {
  return `${c.participant_id}|${c.visit}|${c.field}`;
}

function readCell(meta: Record<string, unknown>): CellKey | null {
  const c = meta.cell as Record<string, unknown> | undefined;
  if (!c) return null;
  const participant_id = str(c.participant_id);
  const visit = str(c.visit);
  const field = str(c.field);
  return participant_id && field ? { participant_id, visit, field } : null;
}

function readSnapshot(meta: Record<string, unknown>, id: string): FindingSnapshot | null {
  const f = meta.finding as Record<string, unknown> | undefined;
  if (!f) return null;
  const t = f.target as Record<string, unknown> | undefined;
  let target: FindingTarget | null = null;
  if (t?.type === 'participant' && str(t.participant_id)) target = { type: 'participant', participant_id: str(t.participant_id) };
  if (t?.type === 'document' && str(t.document_id)) target = { type: 'document', document_id: str(t.document_id), section_id: str(t.section_id) };
  if (!target) return null;
  return {
    id,
    target,
    visit: strOrNull(f.visit),
    crf_field: strOrNull(f.crf_field),
    finding_type: str(f.finding_type),
    severity: strOrNull(f.severity),
    reference_codes: strArray(f.reference_codes).map((c) => c.trim().toUpperCase()).filter(Boolean),
    observed_issue: str(f.observed_issue),
    action: str(f.action),
    status: strOrNull(f.status),
    query_text: str(f.query_text),
  };
}

function emptyT1(): T1Evidence {
  return {
    started: false,
    submitted: false,
    submitted_ts: null,
    submit_event_id: null,
    first_open: new Map(),
    section_opens: new Map(),
    instruction_views: [],
    clarifications: [],
    findings: new Map(),
    no_deviation: new Map(),
    escalations: [],
    cells: new Map(),
    corrections_recommended: [],
  };
}

function emptyT2(): T2Evidence {
  return {
    started: false,
    submitted: false,
    submitted_ts: null,
    submit_event_id: null,
    sponsor_first_open: null,
    emails_opened: new Map(),
    decisions: { sae: null, waiver: null },
    decision_event_ids: [],
    reply: null,
    escalations: [],
    records: new Map(),
    narrative: null,
  };
}

/** Orders events deterministically: server time, then per-attempt sequence, then id. */
export function orderEvents(events: readonly EngineEvent[]): EngineEvent[] {
  return [...events].sort((a, b) => a.seq - b.seq || a.server_ts - b.server_ts || a.event_id.localeCompare(b.event_id));
}

function applyT1(ev: EngineEvent, e: T1Evidence) {
  const meta = ev.metadata ?? {};
  switch (ev.event_type) {
    case 'task_started':
      e.started = true;
      break;
    case 'record_opened': {
      const pid = ev.object_id ?? str(meta.participant_id);
      if (pid && !e.first_open.has(pid)) e.first_open.set(pid, { ts: ev.server_ts, event_id: ev.event_id });
      break;
    }
    case 'document_opened': {
      const key = `${str(meta.document_id)}:${str(meta.section_id)}`;
      const cur = e.section_opens.get(key);
      if (cur) cur.event_ids.push(ev.event_id);
      else e.section_opens.set(key, { first_ts: ev.server_ts, event_ids: [ev.event_id] });
      break;
    }
    case 'instruction_viewed':
      e.instruction_views.push({ instruction_id: ev.object_id ?? str(meta.instruction_id), ts: ev.server_ts, event_id: ev.event_id });
      break;
    case 'clarification_created':
      e.clarifications.push({ event_id: ev.event_id, ts: ev.server_ts, to: strArray(meta.to), subject: str(meta.subject), text: str(meta.text) });
      break;
    case 'finding_created': {
      const id = ev.object_id ?? '';
      const snap = readSnapshot(meta, id);
      if (!id || !snap || e.findings.has(id)) break;
      e.findings.set(id, { ...snap, created_ts: ev.server_ts, created_event_id: ev.event_id, updated_ts: ev.server_ts, event_ids: [ev.event_id], withdrawn: false });
      break;
    }
    case 'finding_modified': {
      const id = ev.object_id ?? '';
      const prev = e.findings.get(id);
      const snap = readSnapshot(meta, id);
      if (!prev || !snap) break;
      e.findings.set(id, { ...snap, created_ts: prev.created_ts, created_event_id: prev.created_event_id, updated_ts: ev.server_ts, event_ids: [...prev.event_ids, ev.event_id], withdrawn: prev.withdrawn });
      break;
    }
    case 'finding_withdrawn': {
      const prev = e.findings.get(ev.object_id ?? '');
      if (prev) {
        prev.withdrawn = true;
        prev.event_ids.push(ev.event_id);
        prev.updated_ts = ev.server_ts;
      }
      break;
    }
    case 'no_deviation_recorded':
    case 'no_deviation_retracted': {
      const pid = ev.object_id ?? str(meta.participant_id);
      if (pid) e.no_deviation.set(pid, { recorded: ev.event_type === 'no_deviation_recorded', event_id: ev.event_id });
      break;
    }
    case 'escalation_completed':
      e.escalations.push({
        event_id: ev.event_id,
        ts: ev.server_ts,
        target_participant_id: strOrNull(meta.target_participant_id),
        to: strArray(meta.to),
        cc: strArray(meta.cc),
        visit: strOrNull(meta.visit),
        fields: strArray(meta.fields),
        facts: str(meta.facts),
        requested_action: str(meta.requested_action),
      });
      break;
    case 'source_edit_started':
    case 'source_edit_cancelled':
    case 'source_edit_committed':
    case 'source_edit_reverted': {
      const cell = readCell(meta);
      if (!cell) break;
      const key = cellKeyString(cell);
      const h = e.cells.get(key) ?? { cell, started: 0, cancelled_changed: 0, commits: 0, reverts: 0, left_changed: false, event_ids: [] };
      h.event_ids.push(ev.event_id);
      if (ev.event_type === 'source_edit_started') h.started++;
      if (ev.event_type === 'source_edit_cancelled' && meta.draft_changed === true) h.cancelled_changed++;
      if (ev.event_type === 'source_edit_committed') {
        h.commits++;
        h.left_changed = true;
      }
      if (ev.event_type === 'source_edit_reverted') {
        h.reverts++;
        h.left_changed = false;
      }
      e.cells.set(key, h);
      break;
    }
    case 'correction_recommended': {
      const cell = readCell(meta);
      if (cell) e.corrections_recommended.push({ event_id: ev.event_id, cell, proposed: str(meta.proposed) });
      break;
    }
    case 'task_completed':
      e.submitted = true;
      e.submitted_ts = ev.server_ts;
      e.submit_event_id = ev.event_id;
      break;
    default:
      break;
  }
}

function applyT2(ev: EngineEvent, e: T2Evidence, pkg: ScoringPackage) {
  const meta = ev.metadata ?? {};
  switch (ev.event_type) {
    case 'task_started':
      e.started = true;
      break;
    case 'email_opened': {
      const id = ev.object_id ?? str(meta.email_id);
      if (!id) break;
      if (!e.emails_opened.has(id)) e.emails_opened.set(id, { ts: ev.server_ts, event_id: ev.event_id });
      if (id === pkg.identifiers.sponsor_email_id && !e.sponsor_first_open) e.sponsor_first_open = { ts: ev.server_ts, event_id: ev.event_id };
      break;
    }
    case 'decision_selected': {
      const which = str(meta.decision) || (ev.object_id ?? '');
      const value = str(meta.value);
      // Choices lock once the reply is sent; later selections (none are accepted by the API) are ignored.
      if (e.reply) break;
      if (which === 'sae') e.decisions.sae = { value, event_id: ev.event_id, ts: ev.server_ts };
      if (which === 'waiver') e.decisions.waiver = { value, event_id: ev.event_id, ts: ev.server_ts };
      e.decision_event_ids.push(ev.event_id);
      break;
    }
    case 'reply_submitted':
      if (!e.reply) {
        e.reply = { event_id: ev.event_id, ts: ev.server_ts, to: strArray(meta.to), cc: strArray(meta.cc), subject: str(meta.subject), body_authored: str(meta.body_authored) };
      }
      break;
    case 'escalation_completed':
      e.escalations.push({ event_id: ev.event_id, ts: ev.server_ts, to: strArray(meta.to), cc: strArray(meta.cc), subject: str(meta.subject), body: str(meta.body) });
      break;
    case 'status_updated': {
      const request = str(meta.request) || (ev.object_id ?? '');
      if (request) {
        e.records.set(request, {
          event_id: ev.event_id,
          ts: ev.server_ts,
          request,
          summary: str(meta.summary),
          status: str(meta.status),
          owner: str(meta.owner),
          next_step: str(meta.next_step),
          date: str(meta.date),
        });
      }
      break;
    }
    case 'summary_created':
      e.narrative = { text: str(meta.narrative), event_id: ev.event_id, ts: ev.server_ts };
      break;
    case 'task_completed':
      e.submitted = true;
      e.submitted_ts = ev.server_ts;
      e.submit_event_id = ev.event_id;
      break;
    default:
      break;
  }
}

/** Reduces the event log to the evidence state each criterion evaluates (stops at each task's submission). */
export function buildEvidence(events: readonly EngineEvent[], pkg: ScoringPackage): Evidence {
  const t1 = emptyT1();
  const t2 = emptyT2();
  const considered: EngineEvent[] = [];
  for (const ev of orderEvents(events)) {
    if (ev.source === 'T') continue;
    const task: TaskId | 'SYS' = ev.task_id;
    if (task === 'T1') {
      if (t1.submitted) continue;
      applyT1(ev, t1);
      considered.push(ev);
    } else if (task === 'T2') {
      if (t2.submitted) continue;
      applyT2(ev, t2, pkg);
      considered.push(ev);
    } else {
      considered.push(ev);
    }
  }
  return { t1, t2, considered };
}

/** Active (not withdrawn) findings, in creation order. */
export function activeFindings(t1: T1Evidence): FindingState[] {
  return [...t1.findings.values()].filter((f) => !f.withdrawn).sort((a, b) => a.created_ts - b.created_ts || a.created_event_id.localeCompare(b.created_event_id));
}

/**
 * Candidate-authored Workday 2 text: the reply body without the quoted thread, the record fields and the narrative.
 * The reply subject is excluded because it is prefilled ("RE: …") and would otherwise satisfy mention checks.
 */
export function authoredT2Text(t2: T2Evidence): string {
  const parts: string[] = [];
  if (t2.reply) parts.push(t2.reply.body_authored);
  for (const r of t2.records.values()) parts.push(r.summary, r.next_step);
  if (t2.narrative) parts.push(t2.narrative.text);
  return parts.filter(Boolean).join('\n');
}

/**
 * Text scanned by Gate GR: the candidate's own position (reply body, next steps, narrative). The record's request
 * summary is excluded because it describes what the sponsor asked for rather than what the candidate agreed to.
 */
export function positionT2Text(t2: T2Evidence): string {
  const parts: string[] = [];
  if (t2.reply) parts.push(t2.reply.body_authored);
  for (const r of t2.records.values()) parts.push(r.next_step);
  if (t2.narrative) parts.push(t2.narrative.text);
  return parts.filter(Boolean).join('\n');
}
