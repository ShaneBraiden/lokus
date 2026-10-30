import { CircleCheck, CircleX, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { GATE_LABELS, type GateId } from '@lokus/shared';
import { Tooltip, cn } from '@/ui';
import { EASE_OUT, m } from '@/ui/motion';

export interface BarDatum {
  key: string;
  label: ReactNode;
  /** Plain-text label for screen readers and the tooltip. */
  text: string;
  value: number | null;
  display: string;
  color?: string;
  note?: string;
}

/**
 * Horizontal bar list: one thin bar per row (square at the baseline, 4px rounded data end), the value at the tip,
 * and a hover/focus tooltip that repeats the row. Every value is visible without hovering.
 */
export function BarList({ data, max, label, className }: { data: BarDatum[]; max: number; label: string; className?: string }) {
  return (
    <ul aria-label={label} className={cn('flex flex-col gap-3.5', className)}>
      {data.map((d, i) => {
        const pct = d.value === null || max <= 0 ? 0 : Math.max(0, Math.min(100, (d.value / max) * 100));
        return (
          <li key={d.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
            <div className="min-w-0 text-[13px] text-ink-2">{d.label}</div>
            <div className="text-right text-[13px] font-semibold text-ink tabular">{d.display}</div>
            <Tooltip
              content={
                <span>
                  <span className="font-semibold">{d.display}</span> <span className="text-muted">· {d.text}</span>
                  {d.note && <span className="mt-0.5 block text-muted">{d.note}</span>}
                </span>
              }
            >
              <div tabIndex={0} role="img" aria-label={`${d.text}: ${d.display}`} className="col-span-2 h-2.5 rounded-r-[4px] bg-subtle outline-none ring-accent/30 hover:brightness-[0.97] focus-visible:ring-2">
                <m.div className="h-full rounded-r-[4px]" style={{ backgroundColor: d.color ?? 'var(--color-accent)' }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.05 * i, ease: EASE_OUT }} />
              </div>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

export interface CompetencyLike {
  competency_id?: string;
  id?: string;
  name: string;
  reportable: boolean;
  score: number | null;
}

export function CompetencyBars({ competencies }: { competencies: CompetencyLike[] }) {
  return (
    <BarList
      label="Competency scores out of 100"
      max={100}
      data={competencies.map((c) => {
        const id = c.competency_id ?? c.id ?? c.name;
        return {
          key: id,
          text: `${id} ${c.name}`,
          label: (
            <span>
              <span className="mr-1.5 font-mono text-[11px] text-faint">{id}</span>
              {c.name}
            </span>
          ),
          value: c.reportable ? c.score : null,
          display: c.reportable && c.score !== null ? `${Math.round(c.score)}` : 'Not reportable',
          note: c.reportable ? undefined : 'Fewer than two scored criteria carry evidence for this competency.',
        };
      })}
    />
  );
}

export interface GateLike {
  gate_id: string;
  fired: boolean;
  resolved?: boolean | null;
  reason?: string;
}

/** Critical flags: each with its own icon and label, so state never depends on colour alone. */
export function GateFlags({ gates, showReasons, onEvidence }: { gates: GateLike[]; showReasons?: boolean; onEvidence?: (gateId: string) => void }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {gates.map((g) => {
        const held = g.gate_id === 'GR' && g.fired && !g.resolved;
        const state = !g.fired ? 'Not triggered' : held ? 'Held for review' : g.gate_id === 'GR' ? 'Reviewed' : 'Triggered';
        return (
          <li key={g.gate_id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5', !g.fired ? 'bg-success-soft text-success' : held ? 'bg-violet-soft text-violet' : 'bg-danger-soft text-danger')}>
              {!g.fired ? <CircleCheck /> : held ? <ShieldAlert /> : <CircleX />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                <span className="mr-2 font-mono text-xs text-faint">{g.gate_id}</span>
                {GATE_LABELS[g.gate_id as GateId] ?? g.gate_id}
              </p>
              <p className="text-xs text-muted">{state}</p>
              {showReasons && g.reason && <p className="mt-1 text-xs text-ink-2">{g.reason}</p>}
            </div>
            {onEvidence && g.fired && (
              <button type="button" onClick={() => onEvidence(g.gate_id)} className="shrink-0 text-xs font-semibold text-accent hover:underline">
                See evidence
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Workday score tile: the true score out of 100 with a thin meter on a same-hue track. */
export function ScoreMeter({ label, score, pending, hint }: { label: string; score: number | null; pending?: boolean; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight text-ink">
        {score === null ? '—' : Number.isInteger(score) ? score : score.toFixed(2)}
        <span className="ml-1 text-sm font-medium text-faint">/ 100</span>
      </p>
      <div className="mt-3 h-2 rounded-r-[4px] bg-accent-soft" role="img" aria-label={`${label}: ${score ?? 'not available'} out of 100`}>
        <m.div className="h-full rounded-r-[4px] bg-accent" initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }} transition={{ duration: 0.9, ease: EASE_OUT }} />
      </div>
      {(hint || pending) && <p className="mt-2 text-xs text-muted">{pending ? 'Provisional — written work is being reviewed.' : hint}</p>}
    </div>
  );
}
