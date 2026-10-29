import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from './cn';

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-muted', className)}>
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-subtle', className)} aria-hidden />;
}

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-subtle text-muted [&_svg]:size-5">{icon}</div>}
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions, className }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Lokus wordmark: a copper "L" tile and the name. */
export function Logo({ className, to = '/', inverted }: { className?: string; to?: string; inverted?: boolean }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2 rounded-md focus-visible:outline-offset-4', className)} aria-label="Lokus home">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
        <path d="M11 8v16h11" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={cn('text-[17px] font-bold tracking-tight', inverted ? 'text-white' : 'text-ink')}>Lokus</span>
    </Link>
  );
}

export function Avatar({ name, src, size = 'md', className }: { name: string; src?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  const dims = { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-sm' }[size];
  return src ? (
    <img src={src} alt="" className={cn('shrink-0 rounded-full object-cover', dims, className)} />
  ) : (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent', dims, className)}>
      {initials}
    </span>
  );
}

/** Mutually exclusive options shown as neutral cards. Used for the Workday 2 forced choices: nothing is preselected. */
export function RadioCards<T extends string>({
  name,
  value,
  options,
  onChange,
  disabled,
  legend,
}: {
  name: string;
  value: T | null;
  options: readonly { value: T; label: string; description?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  legend: ReactNode;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-2 text-[13px] font-semibold text-ink">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border bg-surface px-3.5 py-3 text-sm transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-accent/20',
                checked ? 'border-ink' : 'border-line-strong hover:border-ink/40',
                disabled && 'cursor-not-allowed opacity-70',
              )}
            >
              <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="mt-0.5 size-4 shrink-0 accent-ink" />
              <span>
                <span className="font-medium text-ink">{o.label}</span>
                {o.description && <span className="mt-0.5 block text-[13px] text-muted">{o.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function KeyValue({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2', className)}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs font-medium text-muted">{it.label}</dt>
          <dd className="mt-0.5 font-medium text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
