import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { AuthLayout } from '@/layouts/AuthLayout';
import { errorMessage, http } from '@/lib/api';
import { ME_KEY, useMe, useSignOut } from '@/lib/auth';
import { Alert, Button, Field, Input, PageLoader } from '@/ui';

interface Setup {
  secret: string;
  otpauth_url: string;
  qr_data_url: string;
}

/** Two-step sign-in for Lokus staff: set up an authenticator app once, then enter a code at each sign-in. */
export function StaffMfa() {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const [code, setCode] = useState('');
  const setup = useMutation({ mutationFn: () => http.post<Setup>('/auth/mfa/setup') });
  const confirm = useMutation({
    mutationFn: () => http.post(me?.user.mfa.enabled ? '/auth/mfa/verify' : '/auth/mfa/enable', { code }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ME_KEY });
      navigate('/admin', { replace: true });
    },
  });

  if (isLoading) return <PageLoader />;
  if (!me) return <Navigate to="/login" replace />;
  if (me.user.kind !== 'staff') return <Navigate to={me.home} replace />;
  if (me.user.mfa.verified || !me.user.mfa.required) return <Navigate to="/admin" replace />;

  const enabled = me.user.mfa.enabled;
  return (
    <AuthLayout
      title={enabled ? 'Enter your sign-in code' : 'Set up two-step sign-in'}
      subtitle={enabled ? 'Open your authenticator app and enter the 6-digit code for Lokus.' : 'Lokus staff accounts use an authenticator app (such as Google Authenticator or 1Password) as a second step.'}
      footer={
        <button type="button" onClick={() => signOut.mutate()} className="font-semibold text-accent hover:underline">
          Sign out
        </button>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          confirm.mutate();
        }}
      >
        {!enabled && !setup.data && (
          <Button variant="secondary" onClick={() => setup.mutate()} loading={setup.isPending}>
            <KeyRound /> Show setup code
          </Button>
        )}
        {setup.error && <Alert tone="danger">{errorMessage(setup.error)}</Alert>}
        {setup.data && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-4">
            <img src={setup.data.qr_data_url} alt="QR code for your authenticator app" className="size-44" />
            <p className="text-center text-xs text-muted">
              Can&rsquo;t scan? Enter this key: <code className="break-all font-mono text-ink">{setup.data.secret}</code>
            </p>
          </div>
        )}
        {(enabled || setup.data) && (
          <>
            {confirm.error && <Alert tone="danger">{errorMessage(confirm.error)}</Alert>}
            <Field label="6-digit code" htmlFor="code">
              <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="font-mono text-lg tracking-[0.3em]" />
            </Field>
            <Button type="submit" size="lg" loading={confirm.isPending} disabled={code.length !== 6}>
              {enabled ? 'Verify' : 'Turn on two-step sign-in'}
            </Button>
          </>
        )}
      </form>
    </AuthLayout>
  );
}
