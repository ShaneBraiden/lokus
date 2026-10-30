import { activeFindings, type Evidence, type FindingState, type ScoringPackage } from '#engine';
import { PARTICIPANTS, getParticipant, type MailMessage, type ParticipantCrf } from '#content';
import {
  ATTEMPT_STATUS_LABELS,
  CRF_HEADER_FIELDS,
  CRF_VISIT_FIELDS,
  LOCKDOWN_STRIKE_LIMIT,
  type AttemptStateDTO,
  type AttemptStatus,
  type ClockDTO,
  type CorrectionDTO,
  type EditedCellDTO,
  type FindingDTO,
  type MailMessageDTO,
  type ParticipantCrfDTO,
  type SentMailDTO,
} from '@lokus/shared';
import type { AttemptRow, StoredEvent } from '../../services/eventStore';
import { phaseOf } from './access';

export const cellKey = (c: { participant_id: string; visit: string; field: string }) => `${c.participant_id}|${c.visit}|${c.field}`;

const HEADER_KEYS = new Set<string>(CRF_HEADER_FIELDS.map((f) => f.key));
const VISIT_KEYS = new Set<string>(CRF_VISIT_FIELDS.map((f) => f.key));

/** The source value of a CRF cell, or null when the cell does not exist (header fields use visit "NA"). */
export function sourceValue(cell: { participant_id: string; visit: string; field: string }): string | null {
  const p = getParticipant(cell.participant_id);
  if (!p) return null;
  if (cell.visit === 'NA') return HEADER_KEYS.has(cell.field) ? String(p[cell.field as keyof ParticipantCrf] ?? '') : null;
  const v = p.visits.find((x) => x.visit === cell.visit);
  if (!v || !VISIT_KEYS.has(cell.field)) return null;
  return String(v[cell.field as keyof typeof v] ?? '');
}

/** Cells whose displayed value currently differs from source because the candidate committed an edit. */
export function editedCells(rows: StoredEvent[]): Map<string, EditedCellDTO> {
  const out = new Map<string, EditedCellDTO>();
  for (const r of rows) {
    if (r.eventType !== 'source_edit_committed' && r.eventType !== 'source_edit_reverted') continue;
    const m = r.metadata as { cell: { participant_id: string; visit: string; field: string }; to: string };
    const key = cellKey(m.cell);
    if (r.eventType === 'source_edit_committed') {
      out.set(key, { ...m.cell, original: sourceValue(m.cell) ?? '', value: m.to });
    } else {
      out.delete(key);
    }
  }
  return out;
}

export function displayedValue(rows: StoredEvent[], cell: { participant_id: string; visit: string; field: string }): string | null {
  return editedCells(rows).get(cellKey(cell))?.value ?? sourceValue(cell);
}

export function findingVersions(rows: StoredEvent[]): Map<string, number> {
  const v = new Map<string, number>();
  for (const r of rows) {
    if ((r.eventType === 'finding_created' || r.eventType === 'finding_modified') && r.objectId) v.set(r.objectId, (v.get(r.objectId) ?? 0) + 1);
  }
  return v;
}

export function findingDTO(f: FindingState, version: number): FindingDTO {
  return {
    id: f.id,
    version,
    target: f.target.type === 'participant' ? { type: 'participant', participant_id: f.target.participant_id as never } : { type: 'document', document_id: f.target.document_id as never, section_id: f.target.section_id },
    visit: f.visit,
    crf_field: f.crf_field,
    finding_type: f.finding_type,
    severity: f.severity,
    reference_codes: f.reference_codes,
    observed_issue: f.observed_issue,
    action: f.action,
    status: f.status,
    query_text: f.query_text,
    created_at: new Date(f.created_ts).toISOString(),
    updated_at: new Date(f.updated_ts).toISOString(),
    withdrawn: f.withdrawn,
  };
}

export function w2Clock(attempt: AttemptRow, pkg: ScoringPackage, now: Date): ClockDTO | null {
  if (!attempt.w2ClockStartedAt) return null;
  const minutes = pkg.parameters.W2_CLOCK;
  const ends = attempt.w2ClockStartedAt.getTime() + minutes * 60_000;
  return {
    started_at: attempt.w2ClockStartedAt.toISOString(),
    ends_at: new Date(ends).toISOString(),
    duration_minutes: minutes,
    remaining_ms: Math.max(0, ends - now.getTime()),
    overtime: now.getTime() > ends,
  };
}

export interface CandidateIdentity {
  name: string;
  email: string;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** Fills the "{candidate}" and "{candidateFirstName}" placeholders: the candidate's name comes from the session (F2). */
export function renderMail(m: MailMessage, who: CandidateIdentity): MailMessageDTO {
  const fill = (s: string) => s.replaceAll('{candidateFirstName}', firstName(who.name)).replaceAll('{candidate}', `${who.name} <${who.email}>`);
  return {
    id: m.id,
    from: m.from,
    to: m.to.map(fill),
    cc: m.cc.map(fill),
    sent_at: m.sentAt,
    subject: m.subject,
    body: m.body.map(fill),
    signature: m.signature,
  };
}

export function crfDTO(p: ParticipantCrf, rows: StoredEvent[]): ParticipantCrfDTO {
  const edits = [...editedCells(rows).values()].filter((e) => e.participant_id === p.participantId);
  const edited = new Map(edits.map((e) => [cellKey(e), e.value]));
  const header: Record<string, string> = {};
  for (const f of CRF_HEADER_FIELDS) header[f.key] = edited.get(cellKey({ participant_id: p.participantId, visit: 'NA', field: f.key })) ?? String(p[f.key as keyof ParticipantCrf]);
  return {
    id: p.participantId,
    page: p.page,
    header,
    visits: p.visits.map((v) => {
      const values: Record<string, string> = {};
      for (const f of CRF_VISIT_FIELDS) values[f.key] = edited.get(cellKey({ participant_id: p.participantId, visit: v.visit, field: f.key })) ?? String(v[f.key as keyof typeof v]);
      return { visit: v.visit, visit_number: v.visitNumber, week: v.week, values };
    }),
    edits,
  };
}

function corrections(rows: StoredEvent[]): CorrectionDTO[] {
  return rows
    .filter((r) => r.eventType === 'correction_recommended')
    .map((r) => {
      const m = r.metadata as { cell: { participant_id: string; visit: string; field: string }; proposed: string; rationale: string };
      return { ...m.cell, proposed: m.proposed, rationale: m.rationale ?? '', at: r.serverTs.toISOString() };
    });
}

/** Lockdown strikes recorded so far (telemetry, never scored). */
export function lockdownStrikes(rows: StoredEvent[]): number {
  return rows.filter((r) => r.eventType === 'lockdown_violation' && (r.metadata as { strike?: boolean }).strike).length;
}

export function buildState(input: {
  attempt: AttemptRow;
  simulationTitle: string;
  orgName: string | null;
  lockdown: boolean;
  candidate: CandidateIdentity;
  progress: { version: number; state: Record<string, unknown> };
  rows: StoredEvent[];
  evidence: Evidence;
  pkg: ScoringPackage;
  now: Date;
}): AttemptStateDTO {
  const { attempt, rows, evidence, pkg } = input;
  const { t1, t2 } = evidence;
  const versions = findingVersions(rows);
  const findings = [...t1.findings.values()].sort((a, b) => a.created_ts - b.created_ts).map((f) => findingDTO(f, versions.get(f.id) ?? 1));
  const active = activeFindings(t1);
  const participants = PARTICIPANTS.map((p) => {
    const ids = active.filter((f) => f.target.type === 'participant' && f.target.participant_id === p.participantId).map((f) => f.id);
    const nd = t1.no_deviation.get(p.participantId)?.recorded ?? false;
    return {
      id: p.participantId,
      page: p.page,
      opened: t1.first_open.has(p.participantId),
      status: ids.length ? ('findings' as const) : nd ? ('no_deviation' as const) : ('unreviewed' as const),
      finding_ids: ids,
    };
  });
  const sent = (e: { event_id: string; ts: number; to: string[]; cc: string[]; subject: string; body: string }): SentMailDTO => ({
    id: e.event_id,
    to: e.to,
    cc: e.cc,
    subject: e.subject,
    body: e.body,
    sent_at: new Date(e.ts).toISOString(),
  });
  const record = (k: string) => {
    const r = t2.records.get(k);
    return r ? { summary: r.summary, status: r.status, owner: r.owner, next_step: r.next_step, date: r.date, saved_at: new Date(r.ts).toISOString() } : null;
  };
  return {
    server_time: input.now.toISOString(),
    attempt: {
      id: attempt.id,
      status: attempt.status as AttemptStatus,
      status_label: ATTEMPT_STATUS_LABELS[attempt.status as AttemptStatus],
      phase: phaseOf(attempt),
      simulation_title: input.simulationTitle,
      org_name: input.orgName,
      deadline_at: attempt.deadlineAt?.toISOString() ?? null,
      started_at: attempt.startedAt?.toISOString() ?? null,
      t1_submitted_at: attempt.t1SubmittedAt?.toISOString() ?? null,
      t2_submitted_at: attempt.t2SubmittedAt?.toISOString() ?? null,
      close_reason: attempt.closeReason,
      lockdown: { required: input.lockdown, strikes: lockdownStrikes(rows), limit: LOCKDOWN_STRIKE_LIMIT },
    },
    candidate: { name: input.candidate.name, first_name: firstName(input.candidate.name), email: input.candidate.email },
    progress: input.progress,
    t1: {
      started: t1.started,
      submitted: t1.submitted,
      participants,
      findings,
      escalations: t1.escalations.map((e) => ({
        id: e.event_id,
        participant_id: e.target_participant_id ?? '',
        to: e.to,
        cc: e.cc,
        visit: e.visit,
        fields: e.fields,
        facts: e.facts,
        requested_action: e.requested_action,
        sent_at: new Date(e.ts).toISOString(),
      })),
      notes: t1.clarifications.map((c) => ({ id: c.event_id, to: c.to, subject: c.subject, text: c.text, sent_at: new Date(c.ts).toISOString() })),
      edited_cells: [...editedCells(rows).values()],
      corrections: corrections(rows),
      unreviewed: participants.filter((p) => p.status === 'unreviewed').map((p) => p.id),
    },
    t2: {
      started: t2.started,
      submitted: t2.submitted,
      sponsor_opened: Boolean(t2.sponsor_first_open),
      clock: w2Clock(attempt, pkg, input.now),
      decisions: { sae: t2.decisions.sae?.value ?? null, waiver: t2.decisions.waiver?.value ?? null },
      decisions_locked: Boolean(t2.reply) || t2.submitted,
      reply: t2.reply ? sent({ event_id: t2.reply.event_id, ts: t2.reply.ts, to: t2.reply.to, cc: t2.reply.cc, subject: t2.reply.subject, body: t2.reply.body_authored }) : null,
      messages: t2.escalations.map(sent),
      record: { sae: record('sae'), waiver: record('waiver'), narrative: t2.narrative?.text ?? '' },
      opened_emails: [...t2.emails_opened.keys()],
    },
  };
}
