import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/ui/misc';
import { m, EASE_OUT } from '@/ui/motion';

/** Centered card layout for sign-in and account pages. */
export function AuthLayout({ title, subtitle, children, footer }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas px-4">
      <main className="flex flex-1 flex-col items-center justify-center py-12">
        <Logo className="mb-8" />
        <m.div
          className="w-full max-w-[400px] rounded-xl border border-line bg-surface p-8 shadow-[0_1px_2px_rgba(28,36,48,0.04),0_8px_24px_-12px_rgba(28,36,48,0.12)] sm:p-10"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        >
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </m.div>
        {footer && <div className="mt-6 w-full max-w-[400px] text-center text-sm text-muted">{footer}</div>}
      </main>
      <footer className="flex justify-center gap-5 py-6 text-xs text-faint">
        <span>© {new Date().getFullYear()} Lokus</span>
        <Link to="/legal/terms" className="hover:text-ink">Terms</Link>
        <Link to="/legal/privacy" className="hover:text-ink">Privacy</Link>
      </footer>
    </div>
  );
}
