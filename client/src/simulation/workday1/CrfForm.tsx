import { FilePen, MessageSquareText, PencilLine, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { CRF_VISIT_FIELDS, type FindingVisit, type ParticipantCrfDTO } from '@lokus/shared';
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger, cn } from '@/ui';
import { fieldLabel, visitLabel, type Cell } from './model';

export type CellAction = 'log' | 'edit' | 'correct' | 'restore';

/** `${visit}|${field}` → ids of the active findings logged on that value. */
export type MarkedCells = Map<string, string[]>;

/** What the reviewer has pencilled in for this record so far (shown in the sign-off box at the foot of the page). */
export interface ReviewMark {
  status: 'unreviewed' | 'findings' | 'no_deviation';
  findingIds: string[];
}

interface CellProps {
  crf: ParticipantCrfDTO;
  visit: FindingVisit;
  field: string;
  value: string;
  marked?: string[];
  onAction: (action: CellAction, cell: Cell, current: string) => void;
  className?: string;
}

/**
 * A printed value on the sheet. Every value offers the same actions. A value the candidate changed shows the printed
 * original struck through with the new value in pen; a value carrying a finding is run over with a highlighter.
 */
function CrfCell({ crf, visit, field, value, marked, onAction, className }: CellProps) {
  const edit = crf.edits.find((e) => e.visit === visit && e.field === field);
  const cell: Cell = { participant_id: crf.id, visit, field };
  const where = visit === 'NA' ? fieldLabel(field) : `${fieldLabel(field)}, ${visitLabel(visit)}`;
  const flagged = Boolean(marked?.length);
  return (
    <DropdownMenu modal={false}>
      <DropdownTrigger
        className={cn(
          'group relative flex h-full min-h-10 w-full cursor-pointer flex-col items-center justify-center rounded-[2px] px-2 py-2 text-center font-print text-[13px] leading-snug text-toner outline-none transition-colors hover:bg-accent-soft/70 focus-visible:bg-accent-soft/70 focus-visible:ring-2 focus-visible:ring-accent/40 data-[state=open]:bg-accent-soft',
          className,
        )}
        aria-label={`${where}: ${value || 'blank'}${edit ? ' (changed by you)' : ''}${flagged ? ` (finding ${marked!.join(', ')})` : ''}`}
      >
        {edit ? (
          <>
            <span className="text-toner/55 line-through decoration-pen/70 decoration-[1.5px]">{edit.original || '—'}</span>
            <span className="-mt-0.5 -rotate-2 font-hand text-[19px] font-semibold leading-none text-pen">{value || 'blank'}</span>
          </>
        ) : (
          <span className={cn('min-w-0 break-words', !value && 'text-toner/40')}>
            <span className={cn(flagged && 'box-decoration-clone rounded-[3px] bg-[linear-gradient(100deg,transparent_2%,var(--color-marker)_6%,var(--color-marker)_94%,transparent_98%)] px-1 py-px')}>{value || '—'}</span>
          </span>
        )}
        {flagged && (
          <span className="absolute right-1 top-0.5 font-hand text-[13px] font-semibold leading-none text-pen" aria-hidden>
            {marked![0]}
            {marked!.length > 1 && `+${marked!.length - 1}`}
          </span>
        )}
      </DropdownTrigger>
      <DropdownContent align="start" className="w-64">
        <DropdownLabel>
          <span className="block font-semibold text-ink">{fieldLabel(field)}</span>
          {visit !== 'NA' && <span className="block">{visitLabel(visit)}</span>}
          {edit && <span className="mt-1 block text-faint">Original value: {edit.original || 'blank'}</span>}
          {flagged && <span className="mt-1 block text-faint">Findings here: {marked!.join(', ')}</span>}
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

/** A decorative barcode derived from the record id, like the batch label a print run puts in the footer. */
function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    const out: { x: number; w: number }[] = [];
    let x = 0;
    for (const ch of `*${seed}*`) {
      const c = ch.charCodeAt(0);
      for (let i = 0; i < 4; i++) {
        const w = ((c >> i) & 1) + 1;
        if (i % 2 === 0) out.push({ x, w });
        x += w + 1;
      }
    }
    return { out, width: x };
  }, [seed]);
  return (
    <svg viewBox={`0 0 ${bars.width} 20`} className="h-7 w-44" preserveAspectRatio="none" aria-hidden>
      {bars.out.map((b, i) => (
        <rect key={i} x={b.x} width={b.w} height="20" className="fill-toner" />
      ))}
    </svg>
  );
}

const HOLES = ['top-[14%]', 'top-1/2', 'bottom-[14%]'];

/**
 * The participant's case report form as the printed sheet lying on the reviewer's desk: punched for the study binder,
 * a copper header band like the site's source extract, printed values, and the reviewer's pen marks.
 */
export function CrfForm({
  crf,
  total,
  onAction,
  marked,
  review,
}: {
  crf: ParticipantCrfDTO;
  total: number;
  onAction: CellProps['onAction'];
  marked: MarkedCells;
  review: ReviewMark;
}) {
  const mark = (visit: string, field: string) => marked.get(`${visit}|${field}`);
  const meta = [
    { key: 'siteId', label: 'Site ID' },
    { key: 'treatment', label: 'Treatment received' },
    { key: 'consentDate', label: 'Consent date' },
  ];

  return (
    <div className="relative mx-auto w-full max-w-[1000px] pb-3 pr-2">
      {/* The rest of the stack underneath. */}
      <div aria-hidden className="absolute inset-x-3 bottom-0 top-3 rotate-[0.7deg] rounded-[2px] bg-[#f7f3ea] shadow-[0_1px_2px_rgb(0_0_0/0.12),0_8px_18px_-8px_rgb(60_45_30/0.35)]" />
      <div aria-hidden className="absolute inset-x-1 bottom-1.5 top-1.5 -rotate-[0.45deg] rounded-[2px] bg-[#fbf8f1] shadow-[0_1px_2px_rgb(0_0_0/0.1)]" />

      <article
        aria-label={`Case report form, ${crf.id}, page ${crf.page} of ${total}`}
        className="paper-grain relative overflow-hidden rounded-[2px] bg-paper py-7 pl-10 pr-5 shadow-[0_1px_1px_rgb(0_0_0/0.08),0_2px_4px_rgb(60_45_30/0.1),0_18px_36px_-12px_rgb(60_45_30/0.4)] sm:pl-14 sm:pr-9"
      >
        {/* Light falling across the sheet, and the binder punch holes down the margin. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(115deg,rgb(255_255_255/0.12)_0%,transparent_25%,transparent_75%,rgb(120_95_60/0.05)_100%)]" />
        {HOLES.map((pos) => (
          <span key={pos} aria-hidden className={cn('absolute left-3 size-4 -translate-y-1/2 rounded-full bg-desk shadow-[inset_0_1.5px_2px_rgb(60_45_30/0.45)] sm:left-5', pos)} />
        ))}

        {/* Print-run header line. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-dashed border-toner/25 pb-2 font-print text-[10.5px] uppercase tracking-[0.12em] text-toner/60">
          <span>NorthrSim CRO · Clinical Data Management</span>
          <span>Study AHS-DM-026 · CRF source extract</span>
        </div>

        {/* Ink stamp. */}
        <div aria-hidden className="pointer-events-none absolute right-12 top-[80px] z-10 hidden rotate-[-7deg] rounded-[6px] border-[2.5px] border-copper/70 px-3 py-1.5 text-center font-print-label text-copper/75 mix-blend-multiply sm:block">
          <span className="block text-[15px] font-bold uppercase leading-none tracking-[0.22em]">CRF Extract</span>
          <span className="mt-1 block border-t border-copper/50 pt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.3em]">Data review copy</span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[680px]">
            {/* Title block, printed like the site extract: id, then the header line. */}
            <div className="border-[1.5px] border-b-0 border-toner bg-[#f3e4da]">
              <div className="flex justify-center border-b border-toner/70 py-1.5">
                <div className="w-auto min-w-64">
                  <CrfCell crf={crf} visit="NA" field="participantId" value={crf.header.participantId ?? ''} marked={mark('NA', 'participantId')} onAction={onAction} className="font-print-label text-[26px] font-bold tracking-wide text-toner" />
                </div>
              </div>
              <dl className="grid grid-cols-3 divide-x divide-toner/25">
                {meta.map((f) => (
                  <div key={f.key} className="flex flex-col items-center px-2 pt-1.5">
                    <dt className="font-print-label text-[10.5px] font-semibold uppercase tracking-[0.14em] text-toner/60">{f.label}</dt>
                    <dd className="w-full">
                      <CrfCell crf={crf} visit="NA" field={f.key} value={crf.header[f.key] ?? ''} marked={mark('NA', f.key)} onAction={onAction} className="min-h-9 py-1.5" />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <table className="w-full table-fixed border-collapse border-[1.5px] border-toner">
              <caption className="sr-only">Visit data for {crf.id}</caption>
              <colgroup>
                <col className="w-[190px]" />
                {crf.visits.map((v) => (
                  <col key={v.visit} />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-copper text-white">
                  <th scope="col" className="border border-toner px-3 py-2 font-print-label text-[15px] font-bold">
                    Field
                  </th>
                  {crf.visits.map((v) => (
                    <th key={v.visit} scope="col" className="border border-toner px-3 py-1.5 font-print-label">
                      <span className="block text-[15px] font-bold leading-tight">Week {v.week}</span>
                      <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/80">Visit {v.visit_number}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CRF_VISIT_FIELDS.map((f) => (
                  <tr key={f.key} className="align-middle">
                    <th scope="row" className="border border-toner/80 px-3 py-2 text-center font-print-label text-[14px] font-semibold text-toner">
                      {f.label}
                    </th>
                    {crf.visits.map((v) => (
                      <td key={v.visit} className="border border-toner/80 p-0.5">
                        <CrfCell crf={crf} visit={v.visit as FindingVisit} field={f.key} value={v.values[f.key] ?? ''} marked={mark(v.visit, f.key)} onAction={onAction} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Foot of the page: the reviewer's sign-off box (filled in pen as they decide) and the print-run label. */}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-64 max-w-sm flex-1">
            <p className="font-print-label text-[10.5px] font-semibold uppercase tracking-[0.16em] text-toner/60">Monitor review</p>
            <div className="mt-1.5 grid grid-cols-[auto_1fr] items-end gap-x-3 gap-y-2.5 font-print text-[11.5px] text-toner/70">
              <span>Outcome</span>
              <span className="relative h-6 border-b border-toner/40">
                <span className="absolute -top-1 left-1 -rotate-1 font-hand text-[22px] font-semibold leading-none text-pen">
                  {review.status === 'no_deviation' ? 'No deviation ✓' : review.status === 'findings' ? `${review.findingIds.length} finding${review.findingIds.length === 1 ? '' : 's'} logged` : ''}
                </span>
              </span>
              <span>Ref.</span>
              <span className="relative h-6 border-b border-toner/40">
                <span className="absolute -top-1 left-1 rotate-[0.5deg] font-hand text-[20px] font-semibold leading-none text-pen">{review.findingIds.join(', ')}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 font-print text-[10.5px] text-toner/60">
            <Barcode seed={crf.id} />
            <span className="tracking-[0.18em]">{crf.id}</span>
            <span>
              AHS-007_CRFs.pdf · Page <span className="font-semibold text-toner">{crf.page}</span> of {total}
            </span>
          </div>
        </div>
        <p className="mt-4 border-t border-dashed border-toner/25 pt-2 font-print text-[10.5px] text-toner/55">
          Extract covers Visits 1, 4, 6 and 7 of the 7-visit schedule. Tap any printed value to act on it.
        </p>
      </article>
    </div>
  );
}
