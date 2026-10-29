import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, CircleCheck, FilePen, ListChecks, Mail, MessageSquare, Siren } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PARTICIPANT_IDS, type FindingDTO } from '@lokus/shared';
import { errorMessage, http } from '@/lib/api';
import { Alert, Button, Sheet, Skeleton, Spinner, useToast } from '@/ui';
import { base, useBriefing, useCrf, useDocuments } from '../api';
import { useDraft, usePlayer, useRememberScreen, useSeenFlag } from '../PlayerContext';
import { DocumentViewer, type DocLocation } from '../shared/DocumentViewer';
import { MailView } from '../shared/MailView';
import { screenPath } from '../SimulationShell';
import { CrfForm, type CellAction } from './CrfForm';
import { applyCellValue, CorrectionDialog, EditValueDialog, EscalationDialog, NoteDialog, WithdrawDialog } from './Dialogs';
import { FindingForm, NEW_FINDING_DRAFT } from './FindingForm';
import { FindingsLog } from './FindingsLog';
import { type Cell, type Modal } from './model';
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
      Select any value on the form to log a finding, edit the value or recommend a correction. Record-level actions sit above the form, and the study documents open from the toolbar. You can submit once every participant has a finding or &ldquo;No deviation&rdquo; recorded.
    </Alert>
  );
}

/** Workday 1 review workspace: participant list, the paper CRF, and what has been recorded on the open record. */
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
  const [restoreDraft, setRestoreDraft] = useState(false);
  const [docLocation, setDocLocation] = useState<DocLocation | null>(null);
  const findingDraft = useDraft<unknown>(NEW_FINDING_DRAFT);
  const [, forceRender] = useState(0);

  const summary = state.t1.participants.find((p) => p.id === selected);
  const index = PARTICIPANT_IDS.indexOf(selected as (typeof PARTICIPANT_IDS)[number]);
  const reviewed = state.t1.participants.filter((p) => p.status !== 'unreviewed').length;
  const activeFindings = state.t1.findings.filter((f) => !f.withdrawn);
  const hasFindings = (summary?.finding_ids.length ?? 0) > 0;
  const noDeviation = summary?.status === 'no_deviation';
  const pendingDraft = !modal && Boolean(progress.get().drafts?.[NEW_FINDING_DRAFT]);

  const select = (id: string) => setParams({ record: id }, { replace: true });

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
    if (action === 'log') setModal({ kind: 'finding-create', preset: { target: { type: 'participant', participant_id: cell.participant_id as never }, visit: cell.visit, crf_field: cell.field } });
    if (action === 'edit') setModal({ kind: 'edit-value', cell });
    if (action === 'correct') setModal({ kind: 'correction', cell, current });
    if (action === 'restore') restore.mutate(cell);
  };

  const openCreate = (preset: Extract<Modal, { kind: 'finding-create' }>['preset']) => {
    setRestoreDraft(false);
    setModal({ kind: 'finding-create', preset });
  };
  const closeModal = () => setModal(null);
  const editFinding = (f: FindingDTO) => setModal({ kind: 'finding-edit', finding: f });
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

      <div className="grid flex-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside className="lg:sticky lg:top-[7.75rem] lg:max-h-[calc(100dvh-8.5rem)] lg:self-start lg:overflow-y-auto">
          <p className="mb-2 hidden px-3 text-xs font-semibold uppercase tracking-wider text-muted lg:block">Participants</p>
          <ParticipantList participants={state.t1.participants} selected={selected} onSelect={select} />
        </aside>

        <main className="flex min-w-0 flex-col gap-4">
          <HelpStrip />
          {pendingDraft && (
            <Alert
              tone="info"
              title="You have an unsaved finding"
              action={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      findingDraft.clear();
                      forceRender((n) => n + 1);
                    }}
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRestoreDraft(true);
                      setModal({ kind: 'finding-create', preset: null });
                    }}
                  >
                    Continue editing
                  </Button>
                </div>
              }
            />
          )}

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
              <Button variant="secondary" size="sm" onClick={() => openCreate({ target: { type: 'participant', participant_id: selected as never } })}>
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

          {crf.isLoading && <Skeleton className="h-[560px] rounded-lg" />}
          {crf.error && <Alert tone="danger">{errorMessage(crf.error)}</Alert>}
          {crf.data && crf.data.id === selected && <CrfForm crf={crf.data} total={PARTICIPANT_IDS.length} onAction={onCell} />}

          <div className="xl:hidden">
            <RecordPanel participantId={selected} state={state} docs={docs.data} editedCells={crf.data?.id === selected ? crf.data.edits : []} onEdit={editFinding} onWithdraw={withdrawFinding} onRestore={(c) => restore.mutate(c)} />
          </div>
        </main>

        <aside className="hidden xl:sticky xl:top-[7.75rem] xl:block xl:max-h-[calc(100dvh-8.5rem)] xl:self-start xl:overflow-y-auto">
          <RecordPanel participantId={selected} state={state} docs={docs.data} editedCells={crf.data?.id === selected ? crf.data.edits : []} onEdit={editFinding} onWithdraw={withdrawFinding} onRestore={(c) => restore.mutate(c)} />
        </aside>
      </div>

      {modal?.kind === 'finding-create' && <FindingForm open mode="create" preset={modal.preset} restoreDraft={restoreDraft} onClose={closeModal} />}
      {modal?.kind === 'finding-edit' && <FindingForm open mode="edit" finding={modal.finding} onClose={closeModal} />}
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
        onLogFinding={({ documentId, sectionId }) => openCreate({ target: { type: 'document', document_id: documentId as never, section_id: sectionId } })}
      />
      <FindingsLog open={modal?.kind === 'log'} onOpenChange={(o) => !o && closeModal()} docs={docs.data} onEdit={editFinding} onWithdraw={withdrawFinding} onOpenRecord={(id) => { select(id); closeModal(); }} />
    </div>
  );
}
