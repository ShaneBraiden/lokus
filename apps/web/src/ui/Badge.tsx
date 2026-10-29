import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

const badge = cva('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3.5', {
  variants: {
    tone: {
      neutral: 'border-line bg-subtle text-ink-2',
      accent: 'border-accent-line bg-accent-soft text-accent',
      success: 'border-emerald-200 bg-success-soft text-success',
      warning: 'border-amber-200 bg-warning-soft text-warning',
      danger: 'border-rose-200 bg-danger-soft text-danger',
      info: 'border-blue-200 bg-info-soft text-info',
      violet: 'border-violet-200 bg-violet-soft text-violet',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type BadgeTone = NonNullable<VariantProps<typeof badge>['tone']>;

export function Badge({ className, tone, dot, children, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge> & { dot?: boolean }) {
  return (
    <span className={cn(badge({ tone }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
