import type { ParticipantSummaryDTO } from '@lokus/shared';
import { Select, cn } from '@/ui';
import { shortId } from './model';

function statusText(p: ParticipantSummaryDTO) {
  if (p.status === 'findings') return `${p.finding_ids.length} finding${p.finding_ids.length === 1 ? '' : 's'}`;
  if (p.status === 'no_deviation') return 'No deviation';
  return 'Not reviewed';
}

/** The 12 records in CRF page order with the candidate's own progress on each. Styling is neutral. */
export function ParticipantList({ participants, selected, onSelect }: { participants: ParticipantSummaryDTO[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <>
      <div className="lg:hidden">
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
      <nav aria-label="Participant records" className="hidden lg:block">
        <ol className="flex flex-col gap-0.5">
          {participants.map((p) => {
            const active = p.id === selected;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  aria-current={active ? 'true' : undefined}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors', active ? 'bg-surface shadow-card ring-1 ring-line' : 'hover:bg-surface/70')}
                >
                  <span className="w-5 shrink-0 text-right text-xs font-medium text-faint tabular">{p.page}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm', active ? 'font-semibold text-ink' : 'font-medium text-ink-2')}>{shortId(p.id)}</span>
                    <span className="block truncate text-xs text-muted">{statusText(p)}</span>
                  </span>
                  <span className={cn('size-2 shrink-0 rounded-full', p.status === 'unreviewed' ? 'border border-line-strong' : 'bg-ink')} aria-hidden />
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
