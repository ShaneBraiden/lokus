import { Timer } from 'lucide-react';
import { cn } from '@/ui';
import { SimHeader } from '../layout/SimHeader';
import { usePlayer } from '../PlayerContext';
import { formatElapsed, useServerNow } from '../shared/clock';

const GUIDE_MS = 60 * 60_000;

/** Workday 1 runs on a soft 60-minute guide: elapsed wall-clock time since Workday 1 started, never enforced. */
function ElapsedGuide() {
  const { state, serverOffset } = usePlayer();
  const now = useServerNow(serverOffset);
  if (!state.attempt.started_at) return null;
  const elapsed = now - Date.parse(state.attempt.started_at);
  const past = elapsed > GUIDE_MS;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium tabular', past ? 'border-amber-200 bg-warning-soft text-warning' : 'border-line bg-subtle text-ink-2')} title="Time since you started Workday 1. The 60 minutes are a guide; nothing closes automatically.">
      <Timer className="size-3.5" />
      {formatElapsed(elapsed)}
      <span className="hidden font-normal text-muted lg:inline">{past ? '· past the 60-min guide' : '· guide 60 min'}</span>
    </span>
  );
}

export function W1Header({ section }: { section: string }) {
  return <SimHeader context={<>Workday 1 · {section}</>} right={<ElapsedGuide />} />;
}
