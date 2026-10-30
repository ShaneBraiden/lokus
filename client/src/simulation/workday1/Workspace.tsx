import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, CircleCheck, FilePen, ListChecks, Mail, MessageSquare, Siren } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PARTICIPANT_IDS, type FindingDTO } from '@lokus/shared';
import { errorMessage, http } from '@/lib/api';
import { Alert, Button, Sheet, Skeleton, Spinner, useToast } from '@/ui';
import { base, useBriefing, useCrf, useDocuments } from '../api';
import { usePlayer, useRememberScreen, useSeenFlag } from '../PlayerContext';
import { DocumentViewer, type DocLocation } from '../shared/DocumentViewer';
import { MailView } from '../shared/MailView';
import { screenPath } from '../SimulationShell';
import { CrfForm, type CellAction, type MarkedCells } from './CrfForm';
import { applyCellValue, CorrectionDialog, EditValueDialog, EscalationDialog, NoteDialog, WithdrawDialog } from './Dialogs';
import { FindingForm, NEW_FINDING_DRAFT, type FindingFormValues } from './FindingForm';
import { FindingsLog } from './FindingsLog';
import { type Cell, type Entry, type FindingPreset, type Modal } from './model';
import { ParticipantList } from './ParticipantList';
import { RecordPanel } from './RecordPanel';
import { W1Header } from './W1Header';

function BriefingSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { attemptId } = usePlayer();
  const briefing = useBriefing(attemptId, open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Inbox" description="Your assignment for today" width="max-w-2xl">
      {briefing.isLoading && <Spinner />}
      {briefing.error && <Alert tone="danger">{errorMessage(briefing.error)}</Alert>}
      {briefing.data && <MailView message={briefing.data} />}
    </Sheet>
  );
}

function HelpStrip() {
  const [seen, markSeen] = useSeenFlag('w1-help');
  if (seen) return null;
  return (
    <Alert
      tone="neutral"
      title="How the workspace works"
      action={
        <Button size="sm" variant="secondary" onClick={markSeen}>
          Got it
        </Button>
      }
    >
      Each record is the printed CRF page on your desk. Select any value on it to point the finding form on the right at that value, edit it or recommend a correction. Record-level actions sit above the page, and the study documents open from the toolbar. You can submit once every participant has a finding or &ldquo;No deviation&rdquo; recorded.
    </Alert>
  );
}

const recordPreset = (id: string): FindingPreset => ({ target: { type: 'participant', participant_id: id as never } });

/** Workday 1 review workspace: the printed CRF on the desk with the binder tabs above it, and the finding form docked on the right. */
export function Workspace() {
  useRememberScreen('workspace');
  const { attemptId, state, refresh, progress } = usePlayer();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const docs = useDocuments(attemptId);
  const [params, setParams] = useSearchParams();
  const selected = PARTICIPANT_IDS.includes(params.get('record') as never) ? (params.get('record') as string) : PARTICIPANT_IDS[0];
  const crf = useCrf(attemptId, selected);
  const [modal, setModal] = useState<Modal | null>(null);
  const [docLocation, setDocLocation] = useState<DocLocation | null>(null);
  const [entry, setEntry] = useState<Entry>(() => ({ mode: 'create', preset: recordPreset(selected), key: 0 }));
  // Bumped to start the docked form afresh (after a save, a clear, or leaving edit mode).
  const [formRun, setFormRun] = useState(0);

  const summary = state.t1.participants.find((p) => p.id === selected);
  const index = PARTICIPANT_IDS.indexOf(selected as (typeof PARTICIPANT_IDS)[number]);
  const reviewed = state.t1.participants.filter((p) => p.status !== 'unreviewed').length;
  const activeFindings = state.t1.findings.filter((f) => !f.withdrawn);
  const hasFindings = (summary?.finding_ids.length ?? 0) > 0;
  const noDeviation = summary?.status === 'no_deviation';

  const recordFindings = activeFindings.filter((f) => f.target.type === 'participant' && f.target.participant_id === selected);
  const marked: MarkedCells = new Map();
  for (const f of recordFindings) {
    if (!f.crf_field) continue;
    const k = `${f.visit ?? 'NA'}|${f.crf_field}`;
    marked.set(k, [...(marked.get(k) ?? []), f.id]);
  }

  // Pick up an unsaved new finding for this record (or a document) where the candidate left it.
  const draft = progress.get().drafts?.[NEW_FINDING_DRAFT] as Partial<FindingFormValues> | undefined;
  const restoreDraft = entry.mode === 'create' && Boolean(draft) && (draft?.target_type === 'document' || draft?.participant_id === selected);

  const resetEntry = (id = selected) => {
    setEntry({ mode: 'create', preset: recordPreset(id), key: 0 });
    setFormRun((n) => n + 1);
  };
  const pointForm = (preset: FindingPreset) => setEntry((e) => ({ mode: 'create', preset, key: (e.mode === 'create' ? e.key : 0) + 1 }));

  const select = (id: string) => {
    setParams({ record: id }, { replace: true });
    resetEntry(id);
  };

  const noDev = useMutation({
    mutationFn: (recorded: boolean) => http.put(`${base(attemptId)}/t1/participants/${selected}/no-deviation`, { recorded }),
    onSuccess: async (_r, recorded) => {
      await refresh();
      toast.success(recorded ? 'No deviation recorded' : 'Decision removed');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const restore = useMutation({
    mutationFn: (cell: Cell) => http.post<{ value: string }>(`${base(attemptId)}/t1/edits/revert`, cell),
    onSuccess: (r, cell) => {
      applyCellValue(qc, attemptId, cell, r.value, r.value, false);
      void refresh();
      toast.success('Original value restored');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const onCell = (action: CellAction, cell: Cell, current: string) => {
    if (action === 'log') pointForm({ target: { type: 'participant', participant_id: cell.participant_id as never }, visit: cell.visit, crf_field: cell.field });
    if (action === 'edit') setModal({ kind: 'edit-value', cell });
    if (action === 'correct') setModal({ kind: 'correction', cell, current });
    if (action === 'restore') restore.mutate(cell);
  };

  const closeModal = () => setModal(null);
  const editFinding = (f: FindingDTO) => {
    setEntry({ mode: 'edit', finding: f });
    closeModal();
  };
  const withdrawFinding = (f: FindingDTO) => setModal({ kind: 'withdraw', finding: f });

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <W1Header section="Review workspace" />

      <div className="sticky top-14 z-30 border-b border-line bg-surface">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <p className="text-sm font-semibold text-ink">
              {reviewed} of {PARTICIPANT_IDS.length} records reviewed
            </p>
            <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-subtle sm:block" aria-hidden>
              <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${(reviewed / PARTICIPANT_IDS.length) * 100}%` }} />
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setModal({ kind: 'briefing' })}>
              <Mail /> Briefing
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setModal({ kind: 'documents' })}>
              <BookOpen /> Study documents
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setModal({ kind: 'log' })}>
              <ListChecks /> Findings log <span className="tabular text-muted">({activeFindings.length})</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setModal({ kind: 'note' })}>
              <MessageSquare /> Message Dr. Anjali
            </Button>
            <Button size="sm" onClick={() => navigate(screenPath(attemptId, 'review'))}>
              Review &amp; submit <ArrowRight />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid flex-1 items-start gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <main className="flex min-w-0 flex-col gap-4">
          <HelpStrip />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="icon" className="size-8" disabled={index <= 0} onClick={() => select(PARTICIPANT_IDS[index - 1])} aria-label="Previous record">
                <ChevronLeft />
              </Button>
              <Button variant="secondary" size="icon" className="size-8" disabled={index >= PARTICIPANT_IDS.length - 1} onClick={() => select(PARTICIPANT_IDS[index + 1])} aria-label="Next record">
                <ChevronRight />
              </Button>
              <h2 className="ml-1 text-base font-semibold text-ink">{selected}</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => pointForm(recordPreset(selected))}>
                <FilePen /> Log finding
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-pressed={noDeviation}
                disabled={hasFindings || noDev.isPending}
                title={hasFindings ? 'This record has findings. Withdraw them first to record no deviation.' : undefined}
                onClick={() => noDev.mutate(!noDeviation)}
                className={noDeviation ? 'border-ink bg-subtle' : ''}
              >
                <CircleCheck className={noDeviation ? 'text-ink' : ''} /> {noDeviation ? 'No deviation recorded' : 'No deviation'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setModal({ kind: 'escalate', participantId: selected })}>
                <Siren /> Escalate safety concern
              </Button>
            </div>
          </div>

          <div>
            <ParticipantList participants={state.t1.participants} selected={selected} onSelect={select} />
            <div className="desk-surface mt-3 rounded-xl border border-[#d3cbbf] px-3 py-6 shadow-[inset_0_2px_10px_rgb(60_45_30/0.12)] sm:px-6 sm:py-9 md:mt-0 md:rounded-tl-none">
              {crf.isLoading && <Skeleton className="mx-auto h-[640px] max-w-[1000px] rounded-[2px]" />}
              {crf.error && <Alert tone="danger">{errorMessage(crf.error)}</Alert>}
              {crf.data && crf.data.id === selected && (
                <CrfForm crf={crf.data} total={PARTICIPANT_IDS.length} onAction={onCell} marked={marked} review={{ status: summary?.status ?? 'unreviewed', findingIds: summary?.finding_ids ?? [] }} />
              )}
            </div>
          </div>
        </main>

        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-[7.75rem] xl:max-h-[calc(100dvh-8.5rem)] xl:overflow-y-auto xl:pb-2 xl:pr-1">
          {entry.mode === 'create' ? (
            <FindingForm key={`new|${selected}|${formRun}`} variant="inline" mode="create" preset={entry.preset} presetKey={entry.key} restoreDraft={restoreDraft} onClose={() => resetEntry()} />
          ) : (
            <FindingForm key={`edit|${entry.finding.id}|${formRun}`} variant="inline" mode="edit" finding={entry.finding} onClose={() => resetEntry()} />
          )}
          <RecordPanel participantId={selected} state={state} docs={docs.data} editedCells={crf.data?.id === selected ? crf.data.edits : []} onEdit={editFinding} onWithdraw={withdrawFinding} onRestore={(c) => restore.mutate(c)} />
        </aside>
      </div>

      {modal?.kind === 'withdraw' && <WithdrawDialog finding={modal.finding} onClose={closeModal} />}
      {modal?.kind === 'edit-value' && <EditValueDialog cell={modal.cell} onClose={closeModal} />}
      {modal?.kind === 'correction' && <CorrectionDialog cell={modal.cell} current={modal.current} onClose={closeModal} />}
      {modal?.kind === 'escalate' && <EscalationDialog participantId={modal.participantId} onClose={closeModal} />}
      {modal?.kind === 'note' && <NoteDialog onClose={closeModal} />}
      <BriefingSheet open={modal?.kind === 'briefing'} onOpenChange={(o) => !o && closeModal()} />
      <DocumentViewer
        open={modal?.kind === 'documents'}
        onOpenChange={(o) => !o && closeModal()}
        location={docLocation}
        onLocationChange={setDocLocation}
        onLogFinding={({ documentId, sectionId }) => {
          pointForm({ target: { type: 'document', document_id: documentId as never, section_id: sectionId } });
          closeModal();
        }}
      />
      <FindingsLog open={modal?.kind === 'log'} onOpenChange={(o) => !o && closeModal()} docs={docs.data} onEdit={editFinding} onWithdraw={withdrawFinding} onOpenRecord={(id) => { select(id); closeModal(); }} />
    </div>
  );
}
