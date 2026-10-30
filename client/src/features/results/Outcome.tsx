import { CircleCheck, CircleDashed, CirclePause, CircleX, Hourglass, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from '@/ui';

/** Outcome display. "AWAITING_REVIEW" stands for a provisional result (assessor ratings still pending). */
export type OutcomeKey = 'MEETS_BAR' | 'PARTIALLY_MEETS_BAR' | 'HOLD_FOR_REVIEW' | 'DOES_NOT_MEET_BAR' | 'AWAITING_REVIEW' | 'INCOMPLETE';

/** Order validated for colour-vision separation (adjacent status colours stay distinct); also the legend order. */
export const OUTCOME_ORDER: OutcomeKey[] = ['MEETS_BAR', 'PARTIALLY_MEETS_BAR', 'HOLD_FOR_REVIEW', 'DOES_NOT_MEET_BAR', 'AWAITING_REVIEW', 'INCOMPLETE'];

export const OUTCOME_META: Record<OutcomeKey, { label: string; tone: BadgeTone; color: string; icon: ReactNode; meaning: string }> = {
  MEETS_BAR: { label: 'Meets bar', tone: 'success', color: 'var(--color-success)', icon: <CircleCheck />, meaning: 'Both workdays at or above the bar with no critical flags.' },
  PARTIALLY_MEETS_BAR: { label: 'Partially meets bar', tone: 'warning', color: 'var(--color-warning)', icon: <TriangleAlert />, meaning: 'Solid in parts, below the bar in at least one workday.' },
  HOLD_FOR_REVIEW: { label: 'Hold for review', tone: 'violet', color: 'var(--color-violet)', icon: <CirclePause />, meaning: 'Written work conflicts with a decision; an assessor is checking it.' },
  DOES_NOT_MEET_BAR: { label: 'Does not meet bar', tone: 'danger', color: 'var(--color-danger)', icon: <CircleX />, meaning: 'A critical flag fired, or a workday is well below the bar.' },
  AWAITING_REVIEW: { label: 'Awaiting review', tone: 'info', color: 'var(--color-info)', icon: <Hourglass />, meaning: 'Submitted; trained assessors are rating the written work.' },
  INCOMPLETE: { label: 'Incomplete', tone: 'neutral', color: 'var(--color-faint)', icon: <CircleDashed />, meaning: 'The candidate did not finish both workdays.' },
};

export function outcomeKey(r: { status: string; outcome: string | null } | null | undefined): OutcomeKey | null {
  if (!r) return null;
  if (r.status !== 'final' || !r.outcome) return 'AWAITING_REVIEW';
  return (r.outcome as OutcomeKey) in OUTCOME_META ? (r.outcome as OutcomeKey) : null;
}

export function OutcomeBadge({ outcome, className }: { outcome: OutcomeKey | null; className?: string }) {
  if (!outcome) return <span className="text-sm text-faint">—</span>;
  const meta = OUTCOME_META[outcome];
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.icon}
      {meta.label}
    </Badge>
  );
}

/** Large outcome banner for result pages. */
export function OutcomeBanner({ outcome, reason, children }: { outcome: OutcomeKey; reason?: string; children?: ReactNode }) {
  const meta = OUTCOME_META[outcome];
  const ring: Record<BadgeTone, string> = {
    success: 'border-emerald-200 bg-success-soft',
    warning: 'border-amber-200 bg-warning-soft',
    violet: 'border-violet-200 bg-violet-soft',
    danger: 'border-rose-200 bg-danger-soft',
    info: 'border-blue-200 bg-info-soft',
    neutral: 'border-line bg-subtle',
    accent: 'border-accent-line bg-accent-soft',
  };
  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-start ${ring[meta.tone]}`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface shadow-card [&_svg]:size-5" style={{ color: meta.color }}>
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold text-ink">{meta.label}</p>
        <p className="mt-0.5 text-sm text-ink-2">{reason ?? meta.meaning}</p>
        {children}
      </div>
    </div>
  );
}
