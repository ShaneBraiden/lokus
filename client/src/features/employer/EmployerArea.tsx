import { GitCompare, LayoutDashboard, Mail, Search, Settings, UsersRound } from 'lucide-react';
import { DashboardLayout, type NavItem } from '@/layouts/DashboardLayout';
import { RequireRole, useMe } from '@/lib/auth';

const NAV: NavItem[] = [
  { to: '/org', label: 'Overview', icon: <LayoutDashboard />, end: true },
  { to: '/org/candidates', label: 'Candidate pipeline', icon: <UsersRound /> },
  { to: '/org/invites', label: 'Invitations', icon: <Mail /> },
  { to: '/org/compare', label: 'Compare', icon: <GitCompare /> },
  { to: '/org/talent-pool', label: 'Talent pool', icon: <Search /> },
  { to: '/org/settings', label: 'Team & settings', icon: <Settings /> },
];

export function EmployerArea() {
  const { data: me } = useMe();
  return (
    <RequireRole kind="employer">
      <DashboardLayout nav={NAV} area="Employer" subtitle={me?.org ? `${me.org.name} · ${me.org.role === 'owner' ? 'Owner' : 'Recruiter'}` : 'Employer'} />
    </RequireRole>
  );
}
