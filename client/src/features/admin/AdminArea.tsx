import { Building, ClipboardCheck, Inbox, FileClock, Gauge, GitCompare, Layers, ListChecks, ScrollText, UsersRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { DashboardLayout, type NavItem } from '@/layouts/DashboardLayout';
import { RequireRole, useMe } from '@/lib/auth';

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: <Gauge />, end: true },
  { to: '/admin/review', label: 'Review queue', icon: <ClipboardCheck /> },
  { to: '/admin/attempts', label: 'Attempts', icon: <ListChecks /> },
  { to: '/admin/compare', label: 'Compare', icon: <GitCompare /> },
  { to: '/admin/packages', label: 'Scoring packages', icon: <Layers /> },
  { to: '/admin/content', label: 'Content & SME', icon: <ScrollText /> },
  { to: '/admin/access-requests', label: 'Access requests', icon: <Inbox /> },
  { to: '/admin/orgs', label: 'Organisations', icon: <Building /> },
  { to: '/admin/users', label: 'Users', icon: <UsersRound /> },
  { to: '/admin/audit', label: 'Audit log', icon: <FileClock /> },
];

const ASSESSOR_NAV: NavItem[] = [{ to: '/admin/review', label: 'Review queue', icon: <ClipboardCheck /> }];

/** Assessors only ever see the blind review queue; every other admin page redirects them there. */
function AssessorGuard({ assessor, children }: { assessor: boolean; children: ReactNode }) {
  const { pathname } = useLocation();
  if (assessor && !pathname.startsWith('/admin/review')) return <Navigate to="/admin/review" replace />;
  return <>{children}</>;
}

export function AdminArea() {
  const { data: me } = useMe();
  const assessor = me?.user.platform_role === 'assessor';
  return (
    <RequireRole kind="staff">
      <AssessorGuard assessor={assessor}>
        <DashboardLayout nav={assessor ? ASSESSOR_NAV : ADMIN_NAV} area={assessor ? 'Assessor' : 'Admin'} subtitle={assessor ? 'Lokus assessor' : 'Lokus administrator'} />
      </AssessorGuard>
    </RequireRole>
  );
}

