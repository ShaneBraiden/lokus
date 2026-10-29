import type { ReactNode } from 'react';
import quietDesk from '@/assets/images/quiet-desk.webp';
import { Logo } from '@/ui';

/** Split layout for sign-in and account pages: form on the left, a calm image panel on larger screens. */
export function AuthLayout({ title, subtitle, children, footer }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-sm text-muted">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden lg:block">
        <img src={quietDesk} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="max-w-md font-serif text-[28px] leading-snug">Judge the work, not the interview.</p>
          <p className="mt-3 max-w-md text-sm text-white/80">Realistic clinical-research workdays, scored against a published rubric and reviewed by trained assessors.</p>
        </div>
      </div>
    </div>
  );
}
