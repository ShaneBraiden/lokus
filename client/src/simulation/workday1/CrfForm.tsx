import { FilePen, MessageSquareText, PencilLine, RotateCcw } from 'lucide-react';
import { CRF_HEADER_FIELDS, CRF_VISIT_FIELDS, type FindingVisit, type ParticipantCrfDTO } from '@lokus/shared';
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger, cn } from '@/ui';
import { fieldLabel, visitLabel, type Cell } from './model';

export type CellAction = 'log' | 'edit' | 'correct' | 'restore';

interface CellProps {
  crf: ParticipantCrfDTO;
  visit: FindingVisit;
  field: string;
  value: string;
  onAction: (action: CellAction, cell: Cell, current: string) => void;
  className?: string;
}

/** A value on the form. Every cell offers the same actions; "Restore" appears only after the candidate changed it. */
function CrfCell({ crf, visit, field, value, onAction, className }: CellProps) {
  const edit = crf.edits.find((e) => e.visit === visit && e.field === field);
  const cell: Cell = { participant_id: crf.id, visit, field };
  const where = visit === 'NA' ? fieldLabel(field) : `${fieldLabel(field)}, ${visitLabel(visit)}`;
  return (
    <DropdownMenu modal={false}>
      <DropdownTrigger
        className={cn(
          'group relative flex h-full min-h-10 w-full cursor-pointer items-start rounded-[3px] px-2.5 py-2 text-left text-[13.5px] leading-snug text-ink outline-none transition-colors hover:bg-accent-soft/60 focus-visible:bg-accent-soft/60 focus-visible:ring-2 focus-visible:ring-accent/40 data-[state=open]:bg-accent-soft',
          className,
        )}
        aria-label={`${where}: ${value || 'blank'}${edit ? ' (changed by you)' : ''}`}
      >
        <span className={cn('min-w-0 break-words', !value && 'text-faint')}>{value || '—'}</span>
        {edit && (
          <span className="ml-auto pl-2" title={`Changed by you from “${edit.original || 'blank'}”`}>
            <PencilLine className="size-3.5 text-accent" aria-hidden />
          </span>
        )}
      </DropdownTrigger>
      <DropdownContent align="start" className="w-64">
        <DropdownLabel>
          <span className="block font-semibold text-ink">{fieldLabel(field)}</span>
          {visit !== 'NA' && <span className="block">{visitLabel(visit)}</span>}
          {edit && <span className="mt-1 block text-faint">Original value: {edit.original || 'blank'}</span>}
        </DropdownLabel>
        <DropdownSeparator />
        <DropdownItem onSelect={() => onAction('log', cell, value)}>
          <FilePen /> Log finding
        </DropdownItem>
        <DropdownItem onSelect={() => onAction('edit', cell, value)}>
          <PencilLine /> Edit value
        </DropdownItem>
        <DropdownItem onSelect={() => onAction('correct', cell, value)}>
          <MessageSquareText /> Recommend correction
        </DropdownItem>
        {edit && (
          <>
            <DropdownSeparator />
            <DropdownItem onSelect={() => onAction('restore', cell, value)}>
              <RotateCcw /> Restore original value
            </DropdownItem>
          </>
        )}
      </DropdownContent>
    </DropdownMenu>
  );
}

/** The participant's case report form, laid out like the paper original: header block, then a visit grid. */
export function CrfForm({ crf, total, onAction }: { crf: ParticipantCrfDTO; total: number; onAction: CellProps['onAction'] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-paper-line bg-paper shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-paper-line px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Case report form · AHS-DM-026</p>
          <p className="font-serif text-lg text-ink">Participant visit record</p>
        </div>
        <p className="text-xs font-medium text-muted tabular">
          Page {crf.page} of {total}
        </p>
      </div>

      <dl className="grid border-b border-paper-line sm:grid-cols-2 [&>div:not(:last-child)]:border-b sm:[&>div:nth-child(3)]:border-b-0 sm:[&>div:nth-child(odd)]:border-r">
        {CRF_HEADER_FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col border-paper-line px-2 py-1.5 sm:px-3">
            <dt className="px-2.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{f.label}</dt>
            <dd>
              <CrfCell crf={crf} visit="NA" field={f.key} value={crf.header[f.key] ?? ''} onAction={onAction} className="font-medium" />
            </dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed border-collapse">
          <caption className="sr-only">Visit data for {crf.id}</caption>
          <colgroup>
            <col className="w-[170px]" />
            {crf.visits.map((v) => (
              <col key={v.visit} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-subtle/50">
              <th scope="col" className="border-b border-paper-line px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                Field
              </th>
              {crf.visits.map((v) => (
                <th key={v.visit} scope="col" className="border-b border-l border-paper-line px-4 py-2 text-left">
                  <span className="block text-[13px] font-semibold text-ink">Week {v.week}</span>
                  <span className="block text-[11px] font-medium text-muted">Visit {v.visit_number}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CRF_VISIT_FIELDS.map((f) => (
              <tr key={f.key} className="align-top">
                <th scope="row" className="border-b border-paper-line px-4 py-2.5 text-left text-[13px] font-medium text-ink-2">
                  {f.label}
                </th>
                {crf.visits.map((v) => (
                  <td key={v.visit} className="border-b border-l border-paper-line p-0.5">
                    <CrfCell crf={crf} visit={v.visit as FindingVisit} field={f.key} value={v.values[f.key] ?? ''} onAction={onAction} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[11px] text-muted sm:px-5">This extract covers Visits 1, 4, 6 and 7 of the 7-visit schedule. Select any value to act on it.</p>
    </div>
  );
}
