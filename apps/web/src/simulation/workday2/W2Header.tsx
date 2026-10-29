import { Timer } from 'lucide-react';
import { formatClock } from '@/lib/format';
import { cn } from '@/ui';
import { SimHeader } from '../layout/SimHeader';
import { usePlayer } from '../PlayerContext';
import { useServerNow } from '../shared/clock';

/** Remaining time on the Workday 2 server clock (soft limit). Null before the clock starts. */
export function useW2Remaining(): { remaining: number; overtime: boolean } | null {
  const { state, serverOffset } = usePlayer();
  const now = useServerNow(serverOffset);
  const clock = state.t2.clock;
  if (!clock) return null;
  const remaining = Date.parse(clock.ends_at) - now;
  return { remaining, overtime: remaining <= 0 };
}

function W2Clock() {
  const r = useW2Remaining();
  if (!r) return null;
  const low = !r.overtime && r.remaining <= 5 * 60_000;
  return (
    <span
      role="timer"
      aria-live="off"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold tabular',
        r.overtime ? 'border-rose-200 bg-danger-soft text-danger' : low ? 'border-amber-200 bg-warning-soft text-warning' : 'border-line bg-subtle text-ink-2',
      )}
      title="Workday 2 time. It is a guide: nothing is sent or submitted automatically."
    >
      <Timer className="size-3.5" />
      {r.overtime ? `Time’s up · +${formatClock(-r.remaining)}` : `${formatClock(r.remaining)} left`}
    </span>
  );
}

export function W2Header() {
  return <SimHeader context="Workday 2 · Inbox" right={<W2Clock />} />;
}
