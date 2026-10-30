import { Check, Plus, X } from 'lucide-react';
import { DIRECTORY, DIRECTORY_BY_ID } from '@lokus/shared';
import { Popover, PopoverContent, PopoverTrigger, cn } from '@/ui';

/** Address-book picker over the fictional study directory. Nothing is preselected unless the caller says so. */
export function RecipientPicker({
  id,
  value,
  onChange,
  exclude = [],
  invalid,
  disabled,
}: {
  id: string;
  value: string[];
  onChange: (ids: string[]) => void;
  exclude?: string[];
  invalid?: boolean;
  disabled?: boolean;
}) {
  const toggle = (rid: string) => onChange(value.includes(rid) ? value.filter((v) => v !== rid) : [...value, rid]);
  const options = DIRECTORY.filter((d) => !exclude.includes(d.id));
  return (
    <div
      className={cn(
        'flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border bg-surface px-2 py-1.5',
        invalid ? 'border-danger' : 'border-line-strong',
        disabled && 'bg-subtle',
      )}
    >
      {value.map((rid) => {
        const d = DIRECTORY_BY_ID[rid];
        return (
          <span key={rid} className="inline-flex items-center gap-1 rounded-md border border-line bg-subtle py-0.5 pl-2 pr-1 text-[13px] text-ink">
            {d?.name ?? rid}
            {!disabled && (
              <button type="button" onClick={() => toggle(rid)} className="rounded p-0.5 text-muted hover:bg-line hover:text-ink" aria-label={`Remove ${d?.name ?? rid}`}>
                <X className="size-3" />
              </button>
            )}
          </span>
        );
      })}
      {!disabled && (
        <Popover>
          <PopoverTrigger asChild>
            <button id={id} type="button" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] font-medium text-accent hover:bg-accent-soft" aria-invalid={invalid || undefined}>
              <Plus className="size-3.5" /> {value.length ? 'Add' : 'Choose recipients'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-1">
            <ul role="listbox" aria-multiselectable className="max-h-72 overflow-y-auto">
              {options.map((d) => {
                const selected = value.includes(d.id);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => toggle(d.id)}
                      className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-subtle"
                    >
                      <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border', selected ? 'border-ink bg-ink text-white' : 'border-line-strong')}>
                        {selected && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{d.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {d.role} · {d.organisation}
                        </span>
                        <span className="block truncate text-xs text-faint">{d.email}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function recipientNames(ids: string[]): string {
  return ids.map((id) => DIRECTORY_BY_ID[id]?.name ?? id).join(', ');
}
