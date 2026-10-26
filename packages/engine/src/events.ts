import type { CellKey, FindingSnapshot } from './evidence';
import type { EngineEvent, EventSource, TaskId } from './types';

/**
 * Event factories: the single place where an observed action becomes an event draft. The API uses these when it
 * accepts a command or serves content, and the regression personas use the same factories, so scripted candidates
 * and real candidates produce identical evidence. The API assigns event_id, seq and server_ts when appending.
 */
export type EventDraft = Omit<EngineEvent, 'event_id' | 'seq' | 'server_ts'>;

function draft(task_id: TaskId | 'SYS', event_type: string, source: EventSource, object_id: string | null, metadata: Record<string, unknown> = {}): EventDraft {
  return { task_id, event_type, source, object_id, metadata };
}

export const ev = {
  taskStarted: (task: TaskId) => draft(task, 'task_started', 'C', task, { task }),
  taskResumed: (task: TaskId, gapMs: number) => draft(task, 'task_resumed', 'O', task, { task, gap_ms: gapMs }),
  taskCompleted: (task: TaskId, counts: Record<string, number> = {}) => draft(task, 'task_completed', 'C', task, { task, ...counts }),

  instructionViewed: (instructionId: string) => draft('T1', 'instruction_viewed', 'O', instructionId, { instruction_id: instructionId }),
  recordOpened: (participantId: string) => draft('T1', 'record_opened', 'O', participantId, { participant_id: participantId }),
  documentOpened: (task: TaskId, documentId: string, sectionId: string) =>
    draft(task, 'document_opened', 'O', `${documentId}:${sectionId}`, { document_id: documentId, section_id: sectionId }),

  findingCreated: (finding: FindingSnapshot) => draft('T1', 'finding_created', 'C', finding.id, { finding }),
  findingModified: (finding: FindingSnapshot, version: number) => draft('T1', 'finding_modified', 'C', finding.id, { finding, version }),
  findingWithdrawn: (findingId: string) => draft('T1', 'finding_withdrawn', 'C', findingId, {}),
  noDeviation: (participantId: string, recorded: boolean) =>
    draft('T1', recorded ? 'no_deviation_recorded' : 'no_deviation_retracted', 'C', participantId, { participant_id: participantId }),

  escalationT1: (e: { id: string; target_participant_id: string; to: string[]; cc: string[]; visit: string | null; fields: string[]; facts: string; requested_action: string }) =>
    draft('T1', 'escalation_completed', 'C', e.id, { ...e }),
  clarificationCreated: (c: { id: string; to: string[]; subject: string; text: string; instruction_id?: string }) => draft('T1', 'clarification_created', 'C', c.id, { ...c }),

  sourceEditStarted: (cell: CellKey, original: string) => draft('T1', 'source_edit_started', 'C', `${cell.participant_id}|${cell.visit}|${cell.field}`, { cell, original }),
  sourceEditCancelled: (cell: CellKey, draftChanged: boolean) => draft('T1', 'source_edit_cancelled', 'C', `${cell.participant_id}|${cell.visit}|${cell.field}`, { cell, draft_changed: draftChanged }),
  sourceEditCommitted: (cell: CellKey, from: string, to: string) => draft('T1', 'source_edit_committed', 'C', `${cell.participant_id}|${cell.visit}|${cell.field}`, { cell, from, to }),
  sourceEditReverted: (cell: CellKey, from: string, to: string) => draft('T1', 'source_edit_reverted', 'C', `${cell.participant_id}|${cell.visit}|${cell.field}`, { cell, from, to }),
  correctionRecommended: (cell: CellKey, proposed: string, rationale: string) =>
    draft('T1', 'correction_recommended', 'C', `${cell.participant_id}|${cell.visit}|${cell.field}`, { cell, proposed, rationale }),

  emailOpened: (emailId: string) => draft('T2', 'email_opened', 'O', emailId, { email_id: emailId }),
  decisionSelected: (decision: 'sae' | 'waiver', value: string) => draft('T2', 'decision_selected', 'C', decision, { decision, value }),
  replySubmitted: (r: { id: string; to: string[]; cc: string[]; subject: string; body_authored: string; decisions: Record<string, string | null> }) =>
    draft('T2', 'reply_submitted', 'C', r.id, { ...r }),
  escalationT2: (e: { id: string; to: string[]; cc: string[]; subject: string; body: string }) => draft('T2', 'escalation_completed', 'C', e.id, { ...e }),
  statusUpdated: (r: { request: string; summary: string; status: string; owner: string; next_step: string; date: string }) =>
    draft('T2', 'status_updated', 'C', r.request, { ...r }),
  summaryCreated: (narrative: string) => draft('T2', 'summary_created', 'C', 'record', { narrative }),

  telemetry: (task: TaskId | 'SYS', type: string, metadata: Record<string, unknown> = {}) => draft(task, type, 'T', null, metadata),
};
