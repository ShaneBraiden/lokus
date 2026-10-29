import type { ReactNode } from 'react';
import { SimHeader } from './SimHeader';

/** Narrative screens (overview, welcome, transitions, debrief): an image beside a short serif-headed text. */
export function ScreenFrame({
  image,
  imageAlt = '',
  eyebrow,
  title,
  children,
  actions,
  context,
}: {
  image?: string;
  imageAlt?: string;
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
        <div className={`mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:py-16 ${image ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center' : 'max-w-3xl'}`}>
          {image && (
            <div className="relative hidden overflow-hidden rounded-2xl border border-line bg-subtle shadow-card lg:block">
              <img src={image} alt={imageAlt} className="aspect-[4/5] w-full object-cover" />
            </div>
          )}
          <div className="flex flex-col">
            {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>}
            <h1 className="font-serif text-[34px] leading-tight tracking-tight text-ink sm:text-[40px]">{title}</h1>
            <div className="mt-5 flex flex-col gap-4 text-[15px] leading-relaxed text-ink-2">{children}</div>
            {actions && <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
