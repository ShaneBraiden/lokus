import { ClipboardList, ShieldCheck, UserRound } from 'lucide-react';
import { DashboardLayout, type NavItem } from '@/layouts/DashboardLayout';
import { RequireRole } from '@/lib/auth';

const NAV: NavItem[] = [
  { to: '/app', label: 'Assessments', icon: <ClipboardList />, end: true },
  { to: '/app/privacy', label: 'Privacy & sharing', icon: <ShieldCheck /> },
  { to: '/app/profile', label: 'Profile', icon: <UserRound /> },
];

export function CandidateArea() {
  return (
    <RequireRole kind="candidate" allowUnconfirmed>
      <DashboardLayout nav={NAV} area="Candidate" subtitle="Candidate" profileTo="/app/profile" />
    </RequireRole>
  );
}
