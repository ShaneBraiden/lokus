import { PencilLine, RotateCcw, Siren, Trash } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AttemptStateDTO, DocumentSummaryDTO, FindingDTO } from '@lokus/shared';
import { formatTime } from '@/lib/format';
import { Badge, Button } from '@/ui';
import { recipientNames } from '../shared/RecipientPicker';
import { fieldLabel, locationText, SEVERITY_TONE, visitLabel, type Cell } from './model';

export function FindingCard({ finding, docs, onEdit, onWithdraw, showTarget }: { finding: FindingDTO; docs: DocumentSummaryDTO[] | undefined; onEdit: () => void; onWithdraw: () => void; showTarget?: string }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-3.5 shadow-card">
      <div className="flex items-start gap-2">
        <span className="mt-px rounded bg-subtle px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-2">{finding.id}</span>
        <div className="min-w-0 flex-1">
          {showTarget && <p className="text-xs font-semibold text-muted">{showTarget}</p>}
          <p className="text-[13.5px] font-semibold leading-snug text-ink">{finding.finding_type}</p>
          <p className="mt-0.5 text-xs text-muted">{locationText(finding, docs)}</p>
        </div>
      </div>
      {finding.observed_issue && <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-ink-2">{finding.observed_issue}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {finding.severity && <Badge tone={SEVERITY_TONE[finding.severity] ?? 'neutral'}>{finding.severity}</Badge>}
        {finding.status && <Badge>{finding.status}</Badge>}
        {finding.reference_codes.map((c) => (
          <span key={c} className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
            {c}
          </span>
        ))}
        {finding.query_text && <span className="text-[11px] font-medium text-muted">Query drafted</span>}
      </div>
      <div className="-mb-1 mt-2 flex gap-1 border-t border-line pt-1.5">
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onEdit}>
          <PencilLine /> Edit
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted" onClick={onWithdraw}>
          <Trash /> Withdraw
        </Button>
      </div>
    </article>
  );
}

function Section({ title, children, count }: { title: string; children: ReactNode; count?: number }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-subtle px-1.5 text-[11px] text-ink-2">
            <span className="sr-only">(</span>
            {count}
            <span className="sr-only">)</span>
          </span>
        )}
      </h3>
      {children}
    </section>
  );
}

/** What the candidate has recorded on the open record: findings, decision, escalations, corrections and changes. */
export function RecordPanel({
  participantId,
  state,
  docs,
  editedCells,
  onEdit,
  onWithdraw,
  onRestore,
}: {
  participantId: string;
  state: AttemptStateDTO;
  docs: DocumentSummaryDTO[] | undefined;
  editedCells: { visit: string; field: string; original: string; value: string }[];
  onEdit: (f: FindingDTO) => void;
  onWithdraw: (f: FindingDTO) => void;
  onRestore: (cell: Cell) => void;
}) {
  const summary = state.t1.participants.find((p) => p.id === participantId);
  const findings = state.t1.findings.filter((f) => !f.withdrawn && f.target.type === 'participant' && f.target.participant_id === participantId);
  const escalations = state.t1.escalations.filter((e) => e.participant_id === participantId);
  const corrections = state.t1.corrections.filter((c) => c.participant_id === participantId);

  return (
    <div className="flex flex-col gap-6">
      <Section title="Findings" count={findings.length}>
        {findings.length ? (
          findings.map((f) => <FindingCard key={f.id} finding={f} docs={docs} onEdit={() => onEdit(f)} onWithdraw={() => onWithdraw(f)} />)
        ) : (
          <p className="rounded-lg border border-dashed border-line-strong px-3.5 py-3 text-[13px] text-muted">{summary?.status === 'no_deviation' ? 'You recorded no deviation for this participant.' : 'Nothing recorded for this participant yet.'}</p>
        )}
      </Section>

      {escalations.length > 0 && (
        <Section title="Escalations sent" count={escalations.length}>
          {escalations.map((e) => (
            <div key={e.id} className="rounded-lg border border-line bg-surface p-3 text-[13px]">
              <p className="flex items-center gap-1.5 font-semibold text-ink">
                <Siren className="size-3.5 text-muted" /> To {recipientNames(e.to)}
              </p>
              <p className="mt-1 line-clamp-3 text-ink-2">{e.facts}</p>
              <p className="mt-1.5 text-xs text-muted">Sent {formatTime(e.sent_at)}</p>
            </div>
          ))}
        </Section>
      )}

      {corrections.length > 0 && (
        <Section title="Corrections recommended" count={corrections.length}>
          {corrections.map((c, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-3 text-[13px]">
              <p className="font-medium text-ink">
                {fieldLabel(c.field)}
                {c.visit !== 'NA' && <span className="text-muted"> · {visitLabel(c.visit)}</span>}
              </p>
              <p className="mt-0.5 text-ink-2">
                Recommended: <span className="font-medium">{c.proposed}</span>
              </p>
              {c.rationale && <p className="mt-0.5 line-clamp-2 text-muted">{c.rationale}</p>}
            </div>
          ))}
        </Section>
      )}

      {editedCells.length > 0 && (
        <Section title="Values you changed" count={editedCells.length}>
          {editedCells.map((e) => (
            <div key={`${e.visit}|${e.field}`} className="flex items-start justify-between gap-2 rounded-lg border border-line bg-surface p-3 text-[13px]">
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {fieldLabel(e.field)}
                  {e.visit !== 'NA' && <span className="text-muted"> · {visitLabel(e.visit)}</span>}
                </p>
                <p className="mt-0.5 text-ink-2">
                  {e.original || 'blank'} → <span className="font-medium">{e.value || 'blank'}</span>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onRestore({ participant_id: participantId, visit: e.visit as Cell['visit'], field: e.field })}>
                <RotateCcw /> Restore
              </Button>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
