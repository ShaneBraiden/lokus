import { LogOut, Menu, UserRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useMe, useSignOut } from '@/lib/auth';
import { Avatar, Button, DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger, Logo, Sheet, cn } from '@/ui';
import { PageTransition } from '@/ui/motion';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Dashboard">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
              isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-subtle hover:text-ink',
            )
          }
        >
          {it.icon}
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserMenu({ subtitle, profileTo }: { subtitle: string; profileTo?: string }) {
  const { data: me } = useMe();
  const signOut = useSignOut();
  const navigate = useNavigate();
  if (!me) return null;
  return (
    <DropdownMenu>
      <DropdownTrigger className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left hover:bg-subtle">
        <Avatar name={me.user.name} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{me.user.name}</span>
          <span className="block truncate text-xs text-muted">{subtitle}</span>
        </span>
      </DropdownTrigger>
      <DropdownContent align="start" className="w-56">
        <DropdownLabel>{me.user.email}</DropdownLabel>
        {profileTo && (
          <DropdownItem onSelect={() => navigate(profileTo)}>
            <UserRound /> Profile
          </DropdownItem>
        )}
        <DropdownSeparator />
        <DropdownItem onSelect={() => signOut.mutate()}>
          <LogOut /> Sign out
        </DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  );
}

/** Shared shell for the Candidate, Employer and Admin dashboards: sidebar navigation, user menu, page outlet. */
export function DashboardLayout({ nav, area, subtitle, profileTo }: { nav: NavItem[]; area: string; subtitle: string; profileTo?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-line px-5">
          <Logo />
          <span className="ml-1 rounded-md bg-subtle px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{area}</span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavList items={nav} />
        </div>
        <div className="border-t border-line p-3">
          <UserMenu subtitle={subtitle} profileTo={profileTo} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="rounded-md bg-subtle px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{area}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
        </header>
        <Sheet open={open} onOpenChange={setOpen} title="Menu" width="max-w-xs">
          <div className="flex h-full flex-col gap-6">
            <NavList items={nav} onNavigate={() => setOpen(false)} />
            <div className="mt-auto border-t border-line pt-3">
              <UserMenu subtitle={subtitle} profileTo={profileTo} />
            </div>
          </div>
        </Sheet>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
