import { ev, type EventDraft } from './events';
import type { CellKey, FindingSnapshot, FindingTarget } from './evidence';
import type { EngineEvent, GrClause, GrDispositionInput, Rating, ReviewerCriterionId, ReviewerRatingInput, TaskId } from './types';

const MINUTE = 60_000;
const ACTION_MS = 5_000;

export interface FindingInput {
  participant_id?: string;
  document?: { document_id: string; section_id: string };
  visit?: string | null;
  crf_field?: string | null;
  finding_type: string;
  severity?: string | null;
  reference_codes?: string[];
  observed_issue?: string;
  action?: string;
  status?: string | null;
  query_text?: string;
}

/** A replayable step: personas are lists of these, so the API tests can drive the same steps over HTTP. */
export type ScenarioAction =
  | { kind: 'task_start'; task: TaskId }
  | { kind: 'view_briefing'; instruction_ids: string[] }
  | { kind: 'open_record'; participant_id: string }
  | { kind: 'open_section'; task: TaskId; document_id: string; section_id: string }
  | { kind: 'create_finding'; ref: string; finding: FindingSnapshot }
  | { kind: 'modify_finding'; ref: string; finding: FindingSnapshot; version: number }
  | { kind: 'withdraw_finding'; ref: string }
  | { kind: 'no_deviation'; participant_id: string; recorded: boolean }
  | { kind: 'escalate_t1'; ref: string; target_participant_id: string; to: string[]; cc: string[]; visit: string | null; fields: string[]; facts: string; requested_action: string }
  | { kind: 'clarification'; ref: string; to: string[]; subject: string; text: string }
  | { kind: 'edit_start'; cell: CellKey; original: string }
  | { kind: 'edit_cancel'; cell: CellKey; changed: boolean }
  | { kind: 'edit_commit'; cell: CellKey; from: string; to: string }
  | { kind: 'edit_revert'; cell: CellKey; from: string; to: string }
  | { kind: 'recommend_correction'; cell: CellKey; proposed: string; rationale: string }
  | { kind: 'task_submit'; task: TaskId }
  | { kind: 'open_email'; email_id: string }
  | { kind: 'decide'; decision: 'sae' | 'waiver'; value: string }
  | { kind: 'reply'; ref: string; to: string[]; cc: string[]; subject: string; body: string }
  | { kind: 'escalate_t2'; ref: string; to: string[]; cc: string[]; subject: string; body: string }
  | { kind: 'record'; request: 'sae' | 'waiver'; summary: string; status: string; owner: string; next_step: string; date: string }
  | { kind: 'narrative'; text: string };

export interface TimedAction {
  at: number;
  action: ScenarioAction;
}

export interface ScenarioResult {
  actions: TimedAction[];
  events: EngineEvent[];
  ratings: ReviewerRatingInput[];
  dispositions: GrDispositionInput[];
}

/** Scripts a candidate's behaviour as timed actions and converts it to engine events via the shared factories. */
export class ScenarioBuilder {
  private offset = 0;
  private readonly timed: TimedAction[] = [];
  private readonly findings = new Map<string, { snapshot: FindingSnapshot; version: number }>();
  private counters = { finding: 0, esc: 0, note: 0, reply: 0 };
  private decisions: Record<string, string | null> = { sae: null, waiver: null };
  readonly ratings: ReviewerRatingInput[] = [];
  readonly dispositions: GrDispositionInput[] = [];

  constructor(private readonly start = Date.UTC(2026, 9, 20, 3, 0)) {}

  /** Current scenario time in epoch ms. */
  now(): number {
    return this.start + this.offset;
  }

  wait(minutes: number): this {
    this.offset += Math.round(minutes * MINUTE);
    return this;
  }

  /** Jump to a later day (Workday 2), keeping actions ordered. */
  nextDay(): this {
    this.offset += 24 * 60 * MINUTE;
    return this;
  }

  private push(action: ScenarioAction): this {
    this.timed.push({ at: this.now(), action });
    this.offset += ACTION_MS;
    return this;
  }

  startTask(task: TaskId) {
    return this.push({ kind: 'task_start', task });
  }

  viewBriefing(instructionIds = ['skip_s4']) {
    return this.push({ kind: 'view_briefing', instruction_ids: instructionIds });
  }

  openRecord(participantId: string) {
    return this.push({ kind: 'open_record', participant_id: participantId });
  }

  openSection(documentId: string, sectionId: string, task: TaskId = 'T1') {
    return this.push({ kind: 'open_section', task, document_id: documentId, section_id: sectionId });
  }

  finding(input: FindingInput): string {
    const ref = `F-${String(++this.counters.finding).padStart(3, '0')}`;
    const target: FindingTarget = input.document
      ? { type: 'document', document_id: input.document.document_id, section_id: input.document.section_id }
      : { type: 'participant', participant_id: input.participant_id ?? '' };
    const snapshot: FindingSnapshot = {
      id: ref,
      target,
      visit: input.visit ?? null,
      crf_field: input.crf_field ?? null,
      finding_type: input.finding_type,
      severity: input.severity ?? null,
      reference_codes: input.reference_codes ?? [],
      observed_issue: input.observed_issue ?? '',
      action: input.action ?? '',
      status: input.status ?? null,
      query_text: input.query_text ?? '',
    };
    this.findings.set(ref, { snapshot, version: 1 });
    this.push({ kind: 'create_finding', ref, finding: snapshot });
    return ref;
  }

  modifyFinding(ref: string, changes: Partial<Omit<FindingSnapshot, 'id' | 'target'>>) {
    const cur = this.findings.get(ref);
    if (!cur) throw new Error(`unknown finding ${ref}`);
    const snapshot = { ...cur.snapshot, ...changes };
    const version = cur.version + 1;
    this.findings.set(ref, { snapshot, version });
    return this.push({ kind: 'modify_finding', ref, finding: snapshot, version });
  }

  withdrawFinding(ref: string) {
    return this.push({ kind: 'withdraw_finding', ref });
  }

  noDeviation(participantId: string, recorded = true) {
    return this.push({ kind: 'no_deviation', participant_id: participantId, recorded });
  }

  escalateT1(e: { participant_id: string; to?: string[]; cc?: string[]; visit?: string | null; fields?: string[]; facts: string; requested_action?: string }) {
    const ref = `E-${String(++this.counters.esc).padStart(3, '0')}`;
    return this.push({
      kind: 'escalate_t1',
      ref,
      target_participant_id: e.participant_id,
      to: e.to ?? ['medical-monitor'],
      cc: e.cc ?? [],
      visit: e.visit ?? null,
      fields: e.fields ?? [],
      facts: e.facts,
      requested_action: e.requested_action ?? '',
    });
  }

  clarify(text: string, subject = 'Note on the QC review', to = ['anjali']) {
    const ref = `N-${String(++this.counters.note).padStart(3, '0')}`;
    return this.push({ kind: 'clarification', ref, to, subject, text });
  }

  editStart(cell: CellKey, original: string) {
    return this.push({ kind: 'edit_start', cell, original });
  }

  editCancel(cell: CellKey, changed: boolean) {
    return this.push({ kind: 'edit_cancel', cell, changed });
  }

  editCommit(cell: CellKey, from: string, to: string) {
    return this.push({ kind: 'edit_commit', cell, from, to });
  }

  editRevert(cell: CellKey, from: string, to: string) {
    return this.push({ kind: 'edit_revert', cell, from, to });
  }

  recommendCorrection(cell: CellKey, proposed: string, rationale: string) {
    return this.push({ kind: 'recommend_correction', cell, proposed, rationale });
  }

  submitTask(task: TaskId) {
    return this.push({ kind: 'task_submit', task });
  }

  openEmail(emailId: string) {
    return this.push({ kind: 'open_email', email_id: emailId });
  }

  decide(decision: 'sae' | 'waiver', value: string) {
    this.decisions[decision] = value;
    return this.push({ kind: 'decide', decision, value });
  }

  reply(r: { to?: string[]; cc?: string[]; subject?: string; body: string }) {
    const ref = `R-${String(++this.counters.reply).padStart(3, '0')}`;
    return this.push({ kind: 'reply', ref, to: r.to ?? ['sponsor'], cc: r.cc ?? [], subject: r.subject ?? 'RE: Urgent — Site 02 screening exception and interim timeline (AHS-DM-026)', body: r.body });
  }

  escalateT2(e: { to?: string[]; cc?: string[]; subject: string; body: string }) {
    const ref = `M-${String(++this.counters.esc).padStart(3, '0')}`;
    return this.push({ kind: 'escalate_t2', ref, to: e.to ?? ['anjali'], cc: e.cc ?? [], subject: e.subject, body: e.body });
  }

  record(request: 'sae' | 'waiver', r: { summary: string; status: string; owner: string; next_step: string; date?: string }) {
    return this.push({ kind: 'record', request, summary: r.summary, status: r.status, owner: r.owner, next_step: r.next_step, date: r.date ?? '21-10-2026' });
  }

  narrative(text: string) {
    return this.push({ kind: 'narrative', text });
  }

  rate(criterion: ReviewerCriterionId, raw: Rating, rationale = 'Scripted assessor rating') {
    this.ratings.push({ id: `RT-${this.ratings.length + 1}`, criterion_id: criterion, raw_rating: raw, rationale, assessor_id: 'assessor-script', created_at: this.now() + this.ratings.length });
    return this;
  }

  rateAll(ratings: Partial<Record<ReviewerCriterionId, Rating>>) {
    for (const [k, v] of Object.entries(ratings)) if (v !== undefined) this.rate(k as ReviewerCriterionId, v);
    return this;
  }

  dispose(clause: GrClause, disposition: 'cleared' | 'confirmed', note = 'Scripted disposition') {
    this.dispositions.push({ id: `GD-${this.dispositions.length + 1}`, clause, disposition, note, assessor_id: 'assessor-script', created_at: this.now() + this.dispositions.length });
    return this;
  }

  get actions(): TimedAction[] {
    return [...this.timed];
  }

  build(): ScenarioResult {
    const events: EngineEvent[] = [];
    let seq = 0;
    for (const { at, action } of this.timed) {
      for (const d of actionToDrafts(action)) {
        seq += 1;
        events.push({ ...d, event_id: `ev-${String(seq).padStart(4, '0')}`, seq, server_ts: at });
      }
    }
    return { actions: this.actions, events, ratings: [...this.ratings], dispositions: [...this.dispositions] };
  }
}

/** Maps one action to the event drafts the API emits for it. */
export function actionToDrafts(a: ScenarioAction): EventDraft[] {
  switch (a.kind) {
    case 'task_start':
      return [ev.taskStarted(a.task)];
    case 'view_briefing':
      return a.instruction_ids.map((id) => ev.instructionViewed(id));
    case 'open_record':
      return [ev.recordOpened(a.participant_id)];
    case 'open_section':
      return [ev.documentOpened(a.task, a.document_id, a.section_id)];
    case 'create_finding':
      return [ev.findingCreated(a.finding)];
    case 'modify_finding':
      return [ev.findingModified(a.finding, a.version)];
    case 'withdraw_finding':
      return [ev.findingWithdrawn(a.ref)];
    case 'no_deviation':
      return [ev.noDeviation(a.participant_id, a.recorded)];
    case 'escalate_t1':
      return [
        ev.escalationT1({
          id: a.ref,
          target_participant_id: a.target_participant_id,
          to: a.to,
          cc: a.cc,
          visit: a.visit,
          fields: a.fields,
          facts: a.facts,
          requested_action: a.requested_action,
        }),
      ];
    case 'clarification':
      return [ev.clarificationCreated({ id: a.ref, to: a.to, subject: a.subject, text: a.text })];
    case 'edit_start':
      return [ev.sourceEditStarted(a.cell, a.original)];
    case 'edit_cancel':
      return [ev.sourceEditCancelled(a.cell, a.changed)];
    case 'edit_commit':
      return [ev.sourceEditCommitted(a.cell, a.from, a.to)];
    case 'edit_revert':
      return [ev.sourceEditReverted(a.cell, a.from, a.to)];
    case 'recommend_correction':
      return [ev.correctionRecommended(a.cell, a.proposed, a.rationale)];
    case 'task_submit':
      return [ev.taskCompleted(a.task)];
    case 'open_email':
      return [ev.emailOpened(a.email_id)];
    case 'decide':
      return [ev.decisionSelected(a.decision, a.value)];
    case 'reply':
      return [ev.replySubmitted({ id: a.ref, to: a.to, cc: a.cc, subject: a.subject, body_authored: a.body, decisions: {} })];
    case 'escalate_t2':
      return [ev.escalationT2({ id: a.ref, to: a.to, cc: a.cc, subject: a.subject, body: a.body })];
    case 'record':
      return [ev.statusUpdated({ request: a.request, summary: a.summary, status: a.status, owner: a.owner, next_step: a.next_step, date: a.date })];
    case 'narrative':
      return [ev.summaryCreated(a.text)];
  }
}
