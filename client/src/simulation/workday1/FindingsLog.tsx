import { FileText } from 'lucide-react';
import type { DocumentSummaryDTO, FindingDTO } from '@lokus/shared';
import { formatTime } from '@/lib/format';
import { EmptyState, Sheet } from '@/ui';
import { usePlayer } from '../PlayerContext';
import { recipientNames } from '../shared/RecipientPicker';
import { shortId, targetLabel } from './model';
import { FindingCard } from './RecordPanel';

/** Everything the candidate has logged so far, grouped by record, plus the messages they sent. */
export function FindingsLog({
  open,
  onOpenChange,
  docs,
  onEdit,
  onWithdraw,
  onOpenRecord,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  docs: DocumentSummaryDTO[] | undefined;
  onEdit: (f: FindingDTO) => void;
  onWithdraw: (f: FindingDTO) => void;
  onOpenRecord: (participantId: string) => void;
}) {
  const { state } = usePlayer();
  const active = state.t1.findings.filter((f) => !f.withdrawn);
  const byRecord = state.t1.participants.map((p) => ({ p, findings: active.filter((f) => f.target.type === 'participant' && f.target.participant_id === p.id) })).filter((g) => g.findings.length);
  const documentFindings = active.filter((f) => f.target.type === 'document');
  const withdrawn = state.t1.findings.length - active.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Findings log" description={`${active.length} active finding${active.length === 1 ? '' : 's'}${withdrawn ? ` · ${withdrawn} withdrawn` : ''}`} width="max-w-xl">
      {active.length === 0 && state.t1.notes.length === 0 ? (
        <EmptyState icon={<FileText />} title="Nothing logged yet">
          Findings you log on records or documents appear here.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {byRecord.map(({ p, findings }) => (
            <section key={p.id} className="flex flex-col gap-2">
              <button type="button" onClick={() => onOpenRecord(p.id)} className="w-fit text-left text-xs font-semibold uppercase tracking-wider text-muted hover:text-accent">
                {p.page}. {shortId(p.id)} · open record
              </button>
              {findings.map((f) => (
                <FindingCard key={f.id} finding={f} docs={docs} onEdit={() => onEdit(f)} onWithdraw={() => onWithdraw(f)} />
              ))}
            </section>
          ))}
          {documentFindings.length > 0 && (
            <section className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Study documents</p>
              {documentFindings.map((f) => (
                <FindingCard key={f.id} finding={f} docs={docs} showTarget={targetLabel(f.target, docs)} onEdit={() => onEdit(f)} onWithdraw={() => onWithdraw(f)} />
              ))}
            </section>
          )}
          {state.t1.notes.length > 0 && (
            <section className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Messages sent</p>
              {state.t1.notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-line bg-surface p-3 text-[13px]">
                  <p className="font-semibold text-ink">{n.subject}</p>
                  <p className="text-xs text-muted">
                    To {recipientNames(n.to)} · {formatTime(n.sent_at)}
                  </p>
                  <p className="mt-1.5 line-clamp-3 text-ink-2">{n.text}</p>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}
