import { Check, CloudOff, LoaderCircle, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/ui';
import { usePlayer } from '../PlayerContext';

/** NorthrSim mark: a north-pointing needle in a dark tile, distinct from the Lokus "L". */
export function NorthrSimMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--color-ink)" />
      <path d="M16 6.5 21 24l-5-3.2-5 3.2Z" fill="var(--color-copper)" />
      <path d="M16 6.5v14.3L11 24Z" fill="#fff" fillOpacity=".92" />
    </svg>
  );
}

export function Brand() {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <NorthrSimMark />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[15px] font-bold tracking-tight text-ink">NorthrSim</p>
        <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted">Clinical Trial Associate</p>
      </div>
    </div>
  );
}

function SaveIndicator() {
  const { progress } = usePlayer();
  const { status } = progress;
  if (status === 'idle') return null;
  return (
    <span className={cn('hidden items-center gap-1.5 text-xs font-medium sm:inline-flex', status === 'error' ? 'text-warning' : 'text-faint')} role="status">
      {status === 'saving' && <LoaderCircle className="size-3.5 animate-spin" />}
      {status === 'saved' && <Check className="size-3.5" />}
      {status === 'error' && <CloudOff className="size-3.5" />}
      {status === 'saving' ? 'Saving' : status === 'saved' ? 'Saved' : 'Not saved — retrying'}
    </span>
  );
}

/** Top bar of the player: brand, where you are, the timer, save state and a way back to the dashboard. */
export function SimHeader({ context, right }: { context?: ReactNode; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        <Brand />
        {context && (
          <>
            <span className="hidden h-6 w-px bg-line sm:block" aria-hidden />
            <div className="hidden min-w-0 text-sm font-medium text-ink-2 sm:block">{context}</div>
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          {right}
          <SaveIndicator />
          <Link to="/app" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted hover:bg-subtle hover:text-ink" title="Your work is saved. You can come back from your dashboard.">
            <LogOut className="size-4" />
            <span className="hidden md:inline">Save &amp; exit</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
