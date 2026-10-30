import type { ReactNode } from 'react';
import { cn } from './cn';

/** KPI tile: sentence-case label, a proportional-figure value, an optional hint line. */
export function StatTile({ label, value, hint, icon, className }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface p-4 shadow-card', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {icon && <span className="text-faint [&_svg]:size-4">{icon}</span>}
      </div>
      <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
