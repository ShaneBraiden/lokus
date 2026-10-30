import { CRF_FIELD_LABELS, CRF_HEADER_FIELDS, VISIT_LABELS, type CrfFieldKey, type DocumentSummaryDTO, type FindingDTO, type FindingTargetInput, type FindingVisit } from '@lokus/shared';

export interface Cell {
  participant_id: string;
  visit: FindingVisit;
  field: string;
}

export interface FindingPreset {
  target: FindingTargetInput;
  visit?: FindingVisit | null;
  crf_field?: string | null;
}

/** Everything that can be open over the workspace (one at a time). */
export type Modal =
  | { kind: 'finding-create'; preset: FindingPreset | null }
  | { kind: 'finding-edit'; finding: FindingDTO }
  | { kind: 'withdraw'; finding: FindingDTO }
  | { kind: 'edit-value'; cell: Cell }
  | { kind: 'correction'; cell: Cell; current: string }
  | { kind: 'escalate'; participantId: string }
  | { kind: 'note' }
  | { kind: 'documents' }
  | { kind: 'briefing' }
  | { kind: 'log' };

const HEADER_KEYS = new Set<string>(CRF_HEADER_FIELDS.map((f) => f.key));
export const isHeaderField = (field: string | null | undefined) => Boolean(field && HEADER_KEYS.has(field));

/** "AHS-007-DM-206" → "DM-206". */
export const shortId = (pid: string) => pid.replace(/^AHS-\d{3}-/, '');

export const fieldLabel = (field: string | null | undefined) => (field ? (CRF_FIELD_LABELS[field as CrfFieldKey] ?? field) : '');
export const visitLabel = (visit: string | null | undefined) => (visit ? (VISIT_LABELS[visit as FindingVisit] ?? visit) : '');

export function targetLabel(target: FindingTargetInput, docs: DocumentSummaryDTO[] | undefined): string {
  if (target.type === 'participant') return target.participant_id;
  const doc = docs?.find((d) => d.id === target.document_id);
  const section = doc?.sections.find((s) => s.id === target.section_id);
  return `${doc?.short_title ?? target.document_id} · ${section ? (section.number ? `${section.number} ${section.title}` : section.title) : target.section_id}`;
}

export function locationText(f: Pick<FindingDTO, 'target' | 'visit' | 'crf_field'>, docs: DocumentSummaryDTO[] | undefined): string {
  if (f.target.type === 'document') return targetLabel(f.target, docs);
  return [f.visit && f.visit !== 'NA' ? visitLabel(f.visit) : null, f.crf_field ? fieldLabel(f.crf_field) : null].filter(Boolean).join(' · ') || 'Whole record';
}

export const SEVERITY_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  Low: 'neutral',
  Medium: 'info',
  High: 'warning',
  'Critical (Safety / Regulatory)': 'danger',
};
