import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, ClipboardPen, Inbox as InboxIcon, Mail, PencilLine, Reply, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { DIRECTORY, DIRECTORY_BY_ID, type MailSummaryDTO, type SentMailDTO } from '@lokus/shared';
import { ApiError, errorMessage, http } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { Alert, Button, Card, Dialog, EmptyState, Skeleton, cn } from '@/ui';
import { base, simKeys, useEmail, useInbox } from '../api';
import { usePlayer, useRememberScreen } from '../PlayerContext';
import { DocumentViewer, type DocLocation } from '../shared/DocumentViewer';
import { MailView } from '../shared/MailView';
import { recipientNames } from '../shared/RecipientPicker';
import { screenPath } from '../SimulationShell';
import { Composer, type ComposeMode } from './Composer';
import { DecisionPanel } from './DecisionPanel';
import { IssueRecord, useUnsavedRecord } from './IssueRecord';
import { useW2Remaining, W2Header } from './W2Header';

const SPONSOR_EMAIL = DIRECTORY_BY_ID.sponsor.email;
const directoryIdFor = (email: string) => DIRECTORY.find((d) => d.email === email)?.id ?? null;

/** Today's mail shows its time; older mail shows its day, like a mail client ("Tue 20 Oct"). */
function sentLabel(sentAt: string, today: string | undefined) {
  const [day, time] = sentAt.split(', ');
  return day === today || !time ? (time ?? day) : day.split(' ').slice(0, 3).join(' ');
}

function InboxItem({ m, today, active, onOpen }: { m: MailSummaryDTO; today: string | undefined; active: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-current={active ? 'true' : undefined} className={cn('flex w-full flex-col gap-0.5 border-b border-line px-4 py-3 text-left transition-colors', active ? 'bg-accent-soft/60' : 'hover:bg-subtle')}>
      <span className="flex items-center gap-2">
        {!m.opened && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
        <span className={cn('min-w-0 flex-1 truncate text-sm', m.opened ? 'font-medium text-ink-2' : 'font-semibold text-ink')}>{m.from_name}</span>
        <span className="shrink-0 text-xs text-muted">{sentLabel(m.sent_at, today)}</span>
      </span>
      <span className={cn('truncate text-[13px]', m.opened ? 'text-ink-2' : 'font-semibold text-ink')}>{m.subject}</span>
      <span className="line-clamp-2 text-xs text-muted">{m.preview}</span>
    </button>
  );
}

function SentItem({ m, active, onOpen }: { m: SentMailDTO; active: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-current={active ? 'true' : undefined} className={cn('flex w-full flex-col gap-0.5 border-b border-line px-4 py-3 text-left transition-colors', active ? 'bg-accent-soft/60' : 'hover:bg-subtle')}>
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-2">To {recipientNames(m.to)}</span>
        <span className="shrink-0 text-xs text-muted">{formatTime(m.sent_at)}</span>
      </span>
      <span className="truncate text-[13px] text-ink-2">{m.subject}</span>
      <span className="line-clamp-2 text-xs text-muted">{m.body}</span>
    </button>
  );
}

function SentView({ m }: { m: SentMailDTO }) {
  return (
    <article>
      <h2 className="text-xl font-semibold leading-snug tracking-tight text-ink">{m.subject}</h2>
      <div className="mt-3 border-b border-line pb-3 text-[13px] text-muted">
        <p>
          <span className="font-medium text-ink-2">To</span> {recipientNames(m.to)}
          {m.cc.length > 0 && (
            <>
              <span className="ml-3 font-medium text-ink-2">Cc</span> {recipientNames(m.cc)}
            </>
          )}
        </p>
        <p className="mt-0.5">Sent {formatTime(m.sent_at)}</p>
      </div>
      <p className="whitespace-pre-wrap py-5 text-[15px] leading-relaxed text-ink">{m.body}</p>
    </article>
  );
}

function FinishDialog({ open, onOpenChange, onGoToRecord }: { open: boolean; onOpenChange: (o: boolean) => void; onGoToRecord: () => void }) {
  const { attemptId, state, refresh } = usePlayer();
  const navigate = useNavigate();
  const unsaved = useUnsavedRecord();
  const decisionsReady = Boolean(state.t2.decisions.sae && state.t2.decisions.waiver);
  const finish = useMutation({
    mutationFn: () => http.post(`${base(attemptId)}/tasks/T2/submit`),
    onSuccess: async () => {
      await refresh();
      navigate(screenPath(attemptId, 'debrief'), { replace: true });
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Finish Workday 2?"
      description="After finishing you can’t send messages, change your decisions or update the record."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep working
          </Button>
          <Button loading={finish.isPending} disabled={!decisionsReady} onClick={() => finish.mutate()}>
            Finish Workday 2
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {finish.error && <Alert tone="danger">{finish.error instanceof ApiError ? finish.error.message : errorMessage(finish.error)}</Alert>}
        {!decisionsReady && <Alert tone="info">Record your decision on both sponsor requests before finishing.</Alert>}
        {unsaved && (
          <Alert
            tone="warning"
            title="The issue record has unsaved changes"
            action={
              <Button size="sm" variant="secondary" onClick={onGoToRecord}>
                Open record
              </Button>
            }
          >
            Text you have not saved is not part of the record.
          </Alert>
        )}
        {decisionsReady && !unsaved && <p className="text-sm text-muted">Your work from Workday 2 will be saved as it is now.</p>}
      </div>
    </Dialog>
  );
}

/** Workday 2: a mail client (inbox, sent), the decisions on the sponsor's email, composing, and the issue record. */
export function MailWorkspace() {
  useRememberScreen('inbox');
  const { attemptId, state, refresh } = usePlayer();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const inbox = useInbox(attemptId);
  const folder = params.get('f') === 'sent' ? 'sent' : 'inbox';
  const recordView = params.get('v') === 'record';
  const emailId = !recordView && folder === 'inbox' ? params.get('m') : null;
  const sentId = !recordView && folder === 'sent' ? params.get('s') : null;
  const email = useEmail(attemptId, emailId);
  const [compose, setCompose] = useState<ComposeMode | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [docLocation, setDocLocation] = useState<DocLocation | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const remaining = useW2Remaining();

  // Opening a message is recorded by the server; refresh unread flags and the clock afterwards.
  useEffect(() => {
    if (!email.dataUpdatedAt) return;
    void qc.invalidateQueries({ queryKey: simKeys.inbox(attemptId) });
    void refresh();
  }, [email.dataUpdatedAt, attemptId, qc, refresh]);

  const sent: SentMailDTO[] = [...(state.t2.reply ? [state.t2.reply] : []), ...state.t2.messages].sort((a, b) => a.sent_at.localeCompare(b.sent_at));
  const sentItem = sent.find((m) => m.id === sentId) ?? null;
  const unread = (inbox.data ?? []).filter((m) => !m.opened).length;
  const showingDetail = recordView || Boolean(emailId) || Boolean(sentItem);

  const go = (next: Record<string, string>) => setParams(next, { replace: false });
  const message = email.data?.message;
  const fromSponsor = message?.from.email === SPONSOR_EMAIL;
  const replyTo = message && !fromSponsor ? directoryIdFor(message.from.email) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <W2Header />

      <div className="sticky top-14 z-30 border-b border-line bg-surface">
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 sm:px-6">
          <Button size="sm" variant="secondary" onClick={() => setCompose({ kind: 'new' })}>
            <PencilLine /> New message
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDocsOpen(true)}>
            <BookOpen /> Study documents
          </Button>
          <Button size="sm" variant={recordView ? 'secondary' : 'ghost'} onClick={() => go({ v: 'record' })}>
            <ClipboardPen /> Issue record
          </Button>
          <Button size="sm" className="ml-auto" onClick={() => setFinishOpen(true)}>
            Finish Workday 2
          </Button>
        </div>
      </div>

      {remaining?.overtime && (
        <div className="px-4 pt-4 sm:px-6">
          <Alert tone="danger" title="Your 30 minutes are up">
            Please wrap up and finish Workday 2 when you are ready. Nothing is submitted automatically.
          </Alert>
        </div>
      )}

      <div className="grid flex-1 gap-4 p-4 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className={cn('flex min-h-0 flex-col overflow-hidden lg:sticky lg:top-[7.5rem] lg:max-h-[calc(100dvh-8.5rem)] lg:self-start', showingDetail && 'hidden lg:flex')}>
          <div className="flex border-b border-line p-1.5" role="tablist" aria-label="Folders">
            {(['inbox', 'sent'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={folder === f && !recordView}
                onClick={() => go({ f })}
                className={cn('flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium', folder === f && !recordView ? 'bg-subtle text-ink' : 'text-muted hover:text-ink')}
              >
                {f === 'inbox' ? <InboxIcon className="size-4" /> : <Send className="size-4" />}
                {f === 'inbox' ? 'Inbox' : 'Sent'}
                <span className="text-xs tabular text-muted">{f === 'inbox' ? (unread ? `${unread} new` : '') : sent.length || ''}</span>
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {folder === 'inbox' ? (
              inbox.isLoading ? (
                <div className="flex flex-col gap-2 p-4">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              ) : (
                (inbox.data ?? []).map((m) => <InboxItem key={m.id} m={m} today={inbox.data?.[0]?.sent_at.split(', ')[0]} active={m.id === emailId} onOpen={() => go({ m: m.id })} />)
              )
            ) : sent.length ? (
              sent.map((m) => <SentItem key={m.id} m={m} active={m.id === sentId} onOpen={() => go({ f: 'sent', s: m.id })} />)
            ) : (
              <EmptyState icon={<Send />} title="Nothing sent yet" />
            )}
          </div>
        </Card>

        <section className={cn('min-w-0', !showingDetail && 'hidden lg:block')} aria-label="Reading pane">
          {showingDetail && (
            <button type="button" onClick={() => go(folder === 'sent' ? { f: 'sent' } : {})} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink lg:hidden">
              <ArrowLeft className="size-4" /> {folder === 'sent' ? 'Sent' : 'Inbox'}
            </button>
          )}
          {recordView ? (
            <IssueRecord />
          ) : sentItem ? (
            <Card className="px-5 py-6 sm:px-8">
              <SentView m={sentItem} />
            </Card>
          ) : emailId ? (
            <div className="flex flex-col gap-4">
              <Card className="px-5 py-6 sm:px-8">
                {email.isLoading && (
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-7 w-2/3" />
                    <Skeleton className="h-12" />
                    <Skeleton className="h-48" />
                  </div>
                )}
                {email.error && <Alert tone="danger">{errorMessage(email.error)}</Alert>}
                {message && (
                  <MailView
                    message={message}
                    footer={
                      fromSponsor ? (
                        state.t2.reply ? (
                          <p className="border-t border-line pt-4 text-sm text-muted">
                            You replied at {formatTime(state.t2.reply.sent_at)}.{' '}
                            <button type="button" className="font-semibold text-accent hover:underline" onClick={() => go({ f: 'sent', s: state.t2.reply!.id })}>
                              View your reply
                            </button>
                          </p>
                        ) : (
                          <div className="border-t border-line pt-4">
                            <Button variant="secondary" onClick={() => setCompose({ kind: 'reply-sponsor', original: message })}>
                              <Reply /> Reply
                            </Button>
                          </div>
                        )
                      ) : replyTo ? (
                        <div className="border-t border-line pt-4">
                          <Button variant="secondary" onClick={() => setCompose({ kind: 'reply', original: message, to: replyTo })}>
                            <Reply /> Reply
                          </Button>
                        </div>
                      ) : undefined
                    }
                  />
                )}
              </Card>
              {message && fromSponsor && <DecisionPanel />}
            </div>
          ) : (
            <Card>
              <EmptyState icon={<Mail />} title="Select a message">
                Choose a message from your inbox to read it.
              </EmptyState>
            </Card>
          )}
        </section>
      </div>

      {compose && <Composer mode={compose} onClose={() => setCompose(null)} />}
      <DocumentViewer open={docsOpen} onOpenChange={setDocsOpen} location={docLocation} onLocationChange={setDocLocation} />
      <FinishDialog
        open={finishOpen}
        onOpenChange={setFinishOpen}
        onGoToRecord={() => {
          setFinishOpen(false);
          go({ v: 'record' });
        }}
      />
    </div>
  );
}
