import { activeFindings, type Evidence, type FindingState, type ScoringPackage } from '#engine';
import { DOCUMENTS, WORKDAY1_BRIEFING, WORKDAY2_INBOX, getSection } from '#content';
import { CRF_FIELD_LABELS, DIRECTORY_BY_ID, VISIT_LABELS, W2_DECISIONS, type CrfFieldKey, type EvidenceView, type FindingView, type FindingVisit, type TimelineEntry } from '@lokus/shared';
import type { StoredEvent } from './eventStore';

/**
 * Human-readable evidence built from the immutable event log, shared by the assessor review packet, the admin
 * attempt explorer and the employer report. It never contains answer-key judgements (what was "right"); callers
 * decide which parts each audience sees.
 */

export type { EvidenceView, FindingView, TimelineEntry };

export interface Redactor {
  (text: string): string;
}

/** Replaces the candidate's own name and email in free text so blind reviewers cannot identify them. */
export function nameRedactor(name: string, email: string): Redactor {
  const parts = [...new Set([name, ...name.split(/\s+/)].map((p) => p.trim()).filter((p) => p.length >= 2))].sort((a, b) => b.length - a.length);
  const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const nameRe = escaped.length ? new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi') : null;
  const emailRe = new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return (text) => {
    let t = text.replace(emailRe, '[candidate email]');
    if (nameRe) t = t.replace(nameRe, '[candidate]');
    return t;
  };
}

const keep: Redactor = (t) => t;

const names = (ids: string[]) => ids.map((id) => DIRECTORY_BY_ID[id]?.name ?? id);
const fieldLabel = (f: string | null) => (f ? (CRF_FIELD_LABELS[f as CrfFieldKey] ?? f) : null);
const visitLabel = (v: string | null) => (v ? (VISIT_LABELS[v as FindingVisit] ?? v) : null);

function sectionLabel(documentId: string, sectionId: string): string {
  const doc = (DOCUMENTS as Record<string, { shortTitle: string }>)[documentId];
  const section = getSection(documentId, sectionId);
  return `${doc?.shortTitle ?? documentId} · ${section ? `${section.number ? `${section.number} ` : ''}${section.title}` : sectionId}`;
}

const emailSubject = (id: string) => (id === WORKDAY1_BRIEFING.id ? WORKDAY1_BRIEFING.subject : WORKDAY2_INBOX.find((m) => m.id === id)?.subject ?? id);

function decisionLabel(decision: 'sae' | 'waiver', value: string | null | undefined): string | null {
  if (!value) return null;
  return (W2_DECISIONS[decision].options as readonly { value: string; label: string }[]).find((o) => o.value === value)?.label ?? value;
}

/** Minutes (one decimal) between two epoch-ms timestamps. */
const minutesBetween = (from: number | null, to: number | null) => (from === null || to === null ? null : Math.round(((to - from) / 60_000) * 10) / 10);

function findingTarget(f: FindingState): string {
  return f.target.type === 'participant' ? f.target.participant_id : sectionLabel(f.target.document_id, f.target.section_id);
}

function eventLabel(r: StoredEvent): string | null {
  const m = (r.metadata ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof m[k] === 'string' ? (m[k] as string) : '');
  switch (r.eventType) {
    case 'task_started':
      return `Started ${r.taskId === 'T1' ? 'Workday 1' : 'Workday 2'}`;
    case 'task_completed':
      return `Submitted ${r.taskId === 'T1' ? 'Workday 1' : 'Workday 2'}`;
    case 'instruction_viewed':
      return 'Read the Workday 1 briefing';
    case 'record_opened':
      return `Opened record ${s('participant_id')}`;
    case 'document_opened':
      return `Opened ${sectionLabel(s('document_id'), s('section_id'))}`;
    case 'finding_created':
    case 'finding_modified': {
      const f = m.finding as FindingState | undefined;
      return `${r.eventType === 'finding_created' ? 'Logged' : 'Edited'} ${r.objectId}${f ? ` on ${findingTarget(f as FindingState)} (${f.finding_type})` : ''}`;
    }
    case 'finding_withdrawn':
      return `Withdrew ${r.objectId}`;
    case 'no_deviation_recorded':
      return `Recorded no deviation for ${s('participant_id')}`;
    case 'no_deviation_retracted':
      return `Removed no deviation for ${s('participant_id')}`;
    case 'escalation_completed':
      return r.taskId === 'T1' ? `Escalated a safety concern on ${s('target_participant_id')} to ${names((m.to as string[]) ?? []).join(', ')}` : `Sent a message to ${names((m.to as string[]) ?? []).join(', ')}`;
    case 'clarification_created':
      return `Messaged ${names((m.to as string[]) ?? []).join(', ')}`;
    case 'source_edit_started':
      return 'Opened the value editor';
    case 'source_edit_cancelled':
      return m.draft_changed ? 'Cancelled a changed value' : 'Closed the value editor';
    case 'source_edit_committed':
      return 'Changed a CRF value';
    case 'source_edit_reverted':
      return 'Restored a CRF value';
    case 'correction_recommended':
      return 'Recommended a correction';
    case 'email_opened':
      return `Opened email: ${emailSubject(s('email_id'))}`;
    case 'decision_selected':
      return `Decision on the ${s('decision') === 'sae' ? 'SAE request' : 'waiver request'}: ${decisionLabel(s('decision') as 'sae' | 'waiver', s('value'))}`;
    case 'reply_submitted':
      return 'Replied to the sponsor';
    case 'status_updated':
      return `Updated the issue record (${s('request') === 'sae' ? 'SAE request' : 'waiver request'})`;
    case 'summary_created':
      return 'Updated the record narrative';
    default:
      return null;
  }
}

export function buildEvidenceView(rows: readonly StoredEvent[], evidence: Evidence, pkg: ScoringPackage, redact: Redactor = keep): EvidenceView {
  const { t1, t2 } = evidence;
  const t1Start = rows.find((r) => r.eventType === 'task_started' && r.taskId === 'T1')?.serverTs.getTime() ?? null;
  const t2Start = rows.find((r) => r.eventType === 'task_started' && r.taskId === 'T2')?.serverTs.getTime() ?? null;
  const iso = (ms: number) => new Date(ms).toISOString();
  const rel1 = (ms: number) => minutesBetween(t1Start, ms);
  const rel2 = (ms: number) => minutesBetween(t2Start, ms);

  const findings: FindingView[] = [...t1.findings.values()]
    .sort((a, b) => a.created_ts - b.created_ts)
    .map((f) => ({
      id: f.id,
      target: findingTarget(f),
      participant_id: f.target.type === 'participant' ? f.target.participant_id : null,
      document: f.target.type === 'document' ? { id: f.target.document_id, section_id: f.target.section_id } : null,
      location: f.target.type === 'participant' ? [visitLabel(f.visit), fieldLabel(f.crf_field)].filter(Boolean).join(' · ') || null : null,
      finding_type: f.finding_type,
      severity: f.severity,
      reference_codes: f.reference_codes,
      observed_issue: redact(f.observed_issue),
      action: redact(f.action),
      status: f.status,
      query_text: redact(f.query_text),
      at: iso(f.created_ts),
      at_min: rel1(f.created_ts),
      withdrawn: f.withdrawn,
    }));

  const safetyId = pkg.identifiers.safety_participant_id;
  const safetyOpen = t1.first_open.get(safetyId);
  const safetyEscalations = t1.escalations.filter((e) => e.target_participant_id === safetyId);
  const firstSafetyEscalation = safetyEscalations[0] ?? null;

  const challengeKey = `${pkg.identifiers.icf_document_id}:${pkg.identifiers.icf_challenge_section_id}`;
  const challengeOpen = t1.section_opens.get(challengeKey);
  const active = activeFindings(t1);

  const documentsOpened = [...t1.section_opens.entries()]
    .map(([key, v]) => {
      const [documentId, sectionId] = key.split(':');
      return { document_id: documentId, section_id: sectionId, label: sectionLabel(documentId, sectionId), first_at_min: rel1(v.first_ts), count: v.event_ids.length };
    })
    .sort((a, b) => (a.first_at_min ?? 0) - (b.first_at_min ?? 0));

  const record = (k: 'sae' | 'waiver') => {
    const r = t2.records.get(k);
    return r ? { summary: redact(r.summary), status: r.status, owner: redact(r.owner), next_step: redact(r.next_step), date: r.date, at_min: rel2(r.ts) } : null;
  };
  const decision = (k: 'sae' | 'waiver') => {
    const d = t2.decisions[k];
    return d ? { value: d.value, label: decisionLabel(k, d.value), at_min: rel2(d.ts) } : null;
  };

  const timeline: TimelineEntry[] = rows
    .filter((r) => r.source !== 'T')
    .map((r) => ({ r, label: eventLabel(r) }))
    .filter((x): x is { r: StoredEvent; label: string } => x.label !== null)
    .map(({ r, label }) => ({ seq: r.seq, at: r.serverTs.toISOString(), task: r.taskId, source: r.source, type: r.eventType, label: redact(label), event_id: r.eventId }));

  return {
    t1: {
      started_at: t1Start === null ? null : iso(t1Start),
      submitted_at: t1.submitted_ts === null ? null : iso(t1.submitted_ts),
      duration_min: t1.submitted_ts === null ? null : minutesBetween(t1Start, t1.submitted_ts),
      briefing_read_min: t1.instruction_views[0] ? rel1(t1.instruction_views[0].ts) : null,
      findings,
      no_deviation: [...t1.no_deviation.entries()].filter(([, v]) => v.recorded).map(([p]) => p),
      escalations: t1.escalations.map((e, i) => ({
        id: `E-${String(i + 1).padStart(3, '0')}`,
        participant_id: e.target_participant_id,
        to: names(e.to),
        cc: names(e.cc),
        visit: visitLabel(e.visit),
        fields: e.fields.map((f) => fieldLabel(f) ?? f),
        facts: redact(e.facts),
        requested_action: redact(e.requested_action),
        at: iso(e.ts),
        at_min: rel1(e.ts),
        event_id: e.event_id,
      })),
      notes: t1.clarifications.map((c, i) => ({ id: `N-${String(i + 1).padStart(3, '0')}`, to: names(c.to), subject: redact(c.subject), text: redact(c.text), at: iso(c.ts), at_min: rel1(c.ts), event_id: c.event_id })),
      records_opened: [...t1.first_open.entries()].map(([participantId, v]) => ({ participant_id: participantId, first_at_min: rel1(v.ts) })).sort((a, b) => (a.first_at_min ?? 0) - (b.first_at_min ?? 0)),
      documents_opened: documentsOpened,
      safety_signal: {
        participant_id: safetyId,
        first_open_min: safetyOpen ? rel1(safetyOpen.ts) : null,
        first_escalation_min: firstSafetyEscalation ? rel1(firstSafetyEscalation.ts) : null,
        minutes_to_escalation: safetyOpen && firstSafetyEscalation ? minutesBetween(safetyOpen.ts, firstSafetyEscalation.ts) : null,
        escalated_to: firstSafetyEscalation ? names(firstSafetyEscalation.to) : [],
      },
      challenge_section: {
        label: sectionLabel(pkg.identifiers.icf_document_id, pkg.identifiers.icf_challenge_section_id),
        opened_at_min: challengeOpen ? rel1(challengeOpen.first_ts) : null,
        opens: challengeOpen?.event_ids.length ?? 0,
        findings: active.filter((f) => f.target.type === 'document' && f.target.document_id === pkg.identifiers.icf_document_id && f.target.section_id === pkg.identifiers.icf_challenge_section_id).map((f) => f.id),
        notes: t1.clarifications.length,
      },
      source_edits: [...t1.cells.values()]
        .filter((c) => c.commits > 0 || c.cancelled_changed > 0)
        .map((c) => ({ participant_id: c.cell.participant_id, visit: visitLabel(c.cell.visit), field: fieldLabel(c.cell.field), commits: c.commits, reverts: c.reverts, left_changed: c.left_changed })),
      corrections: t1.corrections_recommended.map((c) => ({ participant_id: c.cell.participant_id, visit: visitLabel(c.cell.visit), field: fieldLabel(c.cell.field), proposed: redact(c.proposed) })),
    },
    t2: {
      started_at: t2Start === null ? null : iso(t2Start),
      submitted_at: t2.submitted_ts === null ? null : iso(t2.submitted_ts),
      sponsor_opened_at: t2.sponsor_first_open ? iso(t2.sponsor_first_open.ts) : null,
      decisions: { sae: decision('sae'), waiver: decision('waiver') },
      reply: t2.reply ? { to: names(t2.reply.to), cc: names(t2.reply.cc), subject: redact(t2.reply.subject), body: redact(t2.reply.body_authored), at: iso(t2.reply.ts), at_min: rel2(t2.reply.ts), event_id: t2.reply.event_id } : null,
      messages: t2.escalations.map((e, i) => ({ id: `M-${String(i + 1).padStart(3, '0')}`, to: names(e.to), cc: names(e.cc), subject: redact(e.subject), body: redact(e.body), at: iso(e.ts), at_min: rel2(e.ts), event_id: e.event_id })),
      record: { sae: record('sae'), waiver: record('waiver'), narrative: redact(t2.narrative?.text ?? '') },
    },
    timeline,
  };
}
