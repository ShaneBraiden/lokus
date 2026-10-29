import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

const tones = {
  info: { box: 'border-blue-200 bg-info-soft', icon: <Info className="text-info" /> },
  success: { box: 'border-emerald-200 bg-success-soft', icon: <CircleCheck className="text-success" /> },
  warning: { box: 'border-amber-200 bg-warning-soft', icon: <TriangleAlert className="text-warning" /> },
  danger: { box: 'border-rose-200 bg-danger-soft', icon: <CircleAlert className="text-danger" /> },
  neutral: { box: 'border-line bg-subtle', icon: <Info className="text-muted" /> },
};

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm text-ink [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0', t.box, className)}>
      {t.icon}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn('text-ink-2', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
