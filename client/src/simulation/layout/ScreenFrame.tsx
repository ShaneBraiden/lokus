import type { ReactNode } from 'react';
import { EASE_OUT, m } from '@/ui/motion';
import { HeroPhoto, SceneBackdrop, type ScenePhoto } from './Backdrop';
import { SimHeader } from './SimHeader';

/**
 * Narrative screens (overview, welcome, transitions, debrief). With `hero`, the copy sits directly on a copper-washed
 * office photograph; without it, the content is centred on a frosted panel over the blurred office.
 */
export function ScreenFrame({
  hero,
  backdrop = 'office',
  eyebrow,
  title,
  children,
  actions,
  context,
}: {
  hero?: ScenePhoto;
  backdrop?: ScenePhoto;
  eyebrow?: ReactNode;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  context?: ReactNode;
}) {
  if (hero) {
    return (
      <div className="flex min-h-dvh flex-col">
        <SimHeader context={context} />
        <main className="relative isolate flex flex-1 items-center">
          <HeroPhoto photo={hero} />
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-20">
            <m.div className="on-photo flex max-w-2xl flex-col" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15, ease: EASE_OUT }}>
              {eyebrow && <p className="mb-3.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#f4cfc1] drop-shadow-sm">{eyebrow}</p>}
              <h1 className="font-serif text-[38px] leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_12px_rgb(0_0_0/0.35)] sm:text-[52px]">{title}</h1>
              <div className="mt-6 flex flex-col gap-4 text-[16px] leading-relaxed text-ink-2 drop-shadow-[0_1px_6px_rgb(0_0_0/0.2)] sm:text-[17px]">{children}</div>
              {actions && <div className="mt-9 flex flex-wrap items-center gap-3">{actions}</div>}
            </m.div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <SceneBackdrop photo={backdrop} />
      <SimHeader context={context} />
      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-16">
          <m.div
            className="flex flex-col rounded-[28px] border border-white/70 bg-surface/85 p-6 shadow-pop backdrop-blur-xl sm:p-10"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: EASE_OUT }}
          >
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
