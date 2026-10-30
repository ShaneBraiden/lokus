import type { ParticipantSummaryDTO } from '@lokus/shared';
import { Select, cn } from '@/ui';
import { shortId } from './model';

function statusText(p: ParticipantSummaryDTO) {
  if (p.status === 'findings') return `${p.finding_ids.length} finding${p.finding_ids.length === 1 ? '' : 's'}`;
  if (p.status === 'no_deviation') return 'No deviation';
  return 'Not reviewed';
}

/**
 * The 12 records in CRF page order with the candidate's own progress on each, as the index tabs of the study binder
 * (a select on small screens). Styling is neutral: the dot only says whether the candidate has decided yet.
 */
export function ParticipantList({ participants, selected, onSelect }: { participants: ParticipantSummaryDTO[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <>
      <div className="md:hidden">
        <label htmlFor="record-select" className="sr-only">
          Participant record
        </label>
        <Select id="record-select" value={selected ?? ''} onChange={(e) => onSelect(e.target.value)}>
          <option value="" disabled>
            Choose a participant record
          </option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.page}. {p.id} — {statusText(p)}
            </option>
          ))}
        </Select>
      </div>
      <nav aria-label="Participant records" className="hidden md:block">
        <ol className="flex items-end gap-1 overflow-x-auto px-3 pt-2 [scrollbar-width:thin]">
          {participants.map((p) => {
            const active = p.id === selected;
            return (
              <li key={p.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  aria-current={active ? 'true' : undefined}
                  title={`${p.id} — ${statusText(p)}`}
                  className={cn(
                    'flex items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 text-left transition-all',
                    active ? 'desk-surface relative z-10 -mb-px border-[#d3cbbf] pb-2.5 pt-2' : 'border-transparent bg-[#efeae2] pb-1.5 pt-1.5 hover:bg-[#e9e3da] hover:pb-2',
                  )}
                >
                  <span className="font-print text-[10.5px] text-faint tabular">{String(p.page).padStart(2, '0')}</span>
                  <span className={cn('font-print-label text-[13px]', active ? 'font-bold text-ink' : 'font-semibold text-ink-2')}>{shortId(p.id)}</span>
                  <span className={cn('size-1.5 shrink-0 rounded-full', p.status === 'unreviewed' ? 'border border-faint' : 'bg-ink')} aria-hidden />
                  <span className="sr-only">, {statusText(p)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
