import { Building, ClipboardCheck, LayoutDashboard } from 'lucide-react';
import { Route, Routes } from 'react-router';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { RequireRole, useMe } from '@/lib/auth';
import { Card, EmptyState, PageHeader } from '@/ui';

/** Temporary shells for the Employer (Phase 7) and Admin (Phase 6) dashboards so sign-in lands somewhere real. */
function ComingSoon({ title, children }: { title: string; children: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <Card>
        <EmptyState icon={<LayoutDashboard />} title="This dashboard is being built">
          {children}
        </EmptyState>
      </Card>
    </div>
  );
}

export function EmployerArea() {
  const { data: me } = useMe();
  return (
    <RequireRole kind="employer">
      <Routes>
        <Route element={<DashboardLayout area="Employer" subtitle={me?.org?.name ?? 'Employer'} nav={[{ to: '/org', label: 'Overview', icon: <Building />, end: true }]} />}>
          <Route path="*" element={<ComingSoon title={me?.org?.name ?? 'Employer'}>Invitations, candidate results and the talent pool arrive in the employer phase.</ComingSoon>} />
        </Route>
      </Routes>
    </RequireRole>
  );
}

export function AdminArea() {
  const { data: me } = useMe();
  return (
    <RequireRole kind="staff">
      <Routes>
        <Route element={<DashboardLayout area={me?.user.platform_role === 'assessor' ? 'Assessor' : 'Admin'} subtitle="Lokus staff" nav={[{ to: '/admin', label: 'Overview', icon: <ClipboardCheck />, end: true }]} />}>
          <Route path="*" element={<ComingSoon title="Lokus admin">The assessor review queue, attempts explorer and scoring packages arrive in the admin phase.</ComingSoon>} />
        </Route>
      </Routes>
    </RequireRole>
  );
}
