import { Link, Outlet } from 'react-router';
import { useMe, homeFor } from '@/lib/auth';
import { Button } from '@/ui/Button';
import { Logo } from '@/ui/misc';
import { PageTransition } from '@/ui/motion';

export function PublicHeader() {
  const { data: me } = useMe();
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          <a href="/#employers" className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink sm:inline-block">
            For employers
          </a>
          <a href="/#candidates" className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink sm:inline-block">
            For candidates
          </a>
          {me ? (
            <Button asChild size="sm">
              <Link to={homeFor(me)}>Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/signup">Create account</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span>Work-simulation assessments</span>
        </div>
        <nav className="flex gap-5" aria-label="Legal">
          <Link to="/legal/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link to="/legal/terms" className="hover:text-ink">
            Terms
          </Link>
          <a href="mailto:hello@lokus.example" className="hover:text-ink">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="flex-1">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <PublicFooter />
    </div>
  );
}
