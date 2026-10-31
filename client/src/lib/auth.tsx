import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ConfirmEmail } from '@/layouts/ConfirmEmail';
import { PageLoader } from '@/ui/misc';
import { ApiError, http } from './api';

export interface Me {
  user: {
    id: string;
    email: string;
    name: string;
    kind: 'candidate' | 'employer' | 'staff';
    platform_role: 'admin' | 'assessor' | null;
    email_verified: boolean;
    mfa: { required: boolean; enabled: boolean; verified: boolean };
  };
  org: { id: string; name: string; role: 'owner' | 'recruiter'; status: string } | null;
  /** Testing phase: new accounts get a shared default password and no emails are sent. */
  direct_accounts: boolean;
  home: string;
}

export const ME_KEY = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await http.get<Me>('/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
  });
}

/** Where a signed-in user lands: their dashboard, or the two-step sign-in screen for staff who still need it. */
export function homeFor(me: Me): string {
  if (me.user.kind === 'staff' && me.user.mfa.required && !me.user.mfa.verified) return '/mfa';
  return me.home;
}

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => http.post('/auth/logout'),
    onSettled: () => {
      qc.clear();
      navigate('/login', { replace: true });
    },
  });
}

/**
 * Route guard: signed in, of the right kind (and, for staff, past two-step sign-in when required) with a confirmed
 * email. `allowUnconfirmed` keeps the candidate dashboard reachable so it can prompt for the link itself.
 */
export function RequireRole({ kind, allowUnconfirmed = false, children }: { kind: Me['user']['kind']; allowUnconfirmed?: boolean; children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const location = useLocation();
  const signOut = useSignOut();
  if (isLoading) return <PageLoader />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (me.user.kind !== kind) return <Navigate to={homeFor(me)} replace />;
  if (kind === 'staff' && me.user.mfa.required && !me.user.mfa.verified) return <Navigate to="/mfa" replace />;
  if (!me.user.email_verified && !allowUnconfirmed) return <ConfirmEmail email={me.user.email} onSignOut={() => signOut.mutate()} />;
  return <>{children}</>;
}

/** Public-only pages (sign in, sign up) send signed-in users to their dashboard. */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const location = useLocation();
  if (isLoading) return <PageLoader />;
  if (me) {
    const next = new URLSearchParams(location.search).get('next');
    return <Navigate to={next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(me)} replace />;
  }
  return <>{children}</>;
}
