import type { ReactNode } from 'react';
import { EASE_OUT, m } from '@/ui/motion';
import { SimHeader } from './SimHeader';

/** Narrative screens (overview, welcome, transitions, debrief): an illustrated scene beside a short serif-headed text. */
export function ScreenFrame({
  visual,
  eyebrow,
  title,
  children,
  actions,
  context,
}: {
  visual?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  context?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SimHeader context={context} />
      <main className="flex flex-1 items-center">
        <div className={`mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:py-16 ${visual ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center' : 'max-w-3xl'}`}>
          {visual && (
            <m.div
              aria-hidden
              className="relative hidden aspect-[4/5] overflow-hidden rounded-[28px] border border-line bg-surface shadow-card lg:block"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            >
              <div className="dot-grid absolute inset-0" />
              <div className="absolute -left-20 -top-24 size-80 rounded-full bg-accent-soft blur-3xl animate-drift" />
              <div className="absolute -bottom-24 -right-20 size-80 rounded-full bg-[#efe6da] blur-3xl animate-drift [animation-delay:-8s]" />
              <div className="absolute inset-0">{visual}</div>
            </m.div>
          )}
          <m.div className="flex flex-col" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08, ease: EASE_OUT }}>
            {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>}
            <h1 className="font-serif text-[34px] leading-tight tracking-tight text-ink sm:text-[40px]">{title}</h1>
            <div className="mt-5 flex flex-col gap-4 text-[15px] leading-relaxed text-ink-2">{children}</div>
            {actions && <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>}
          </m.div>
        </div>
      </main>
    </div>
  );
}
