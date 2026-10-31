import { useMutation } from '@tanstack/react-query';
import { LogOut, MailCheck } from 'lucide-react';
import { errorMessage, http } from '@/lib/api';
import { Alert, Button } from '@/ui';
import { AuthLayout } from './AuthLayout';

/** Shown instead of a dashboard or the player until the signed-in account has confirmed its email address. */
export function ConfirmEmail({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const resend = useMutation({ mutationFn: () => http.post('/auth/resend-verification') });
  return (
    <AuthLayout title="Confirm your email" subtitle={`We sent a confirmation link to ${email}. Open it to continue.`}>
      <div className="flex flex-col gap-4">
        {resend.error && <Alert tone="danger">{errorMessage(resend.error)}</Alert>}
        {resend.isSuccess && <Alert tone="success">A new link is on its way. Check your inbox and spam folder.</Alert>}
        <Button size="lg" variant="secondary" loading={resend.isPending} disabled={resend.isSuccess} onClick={() => resend.mutate()}>
          <MailCheck /> {resend.isSuccess ? 'New link sent' : 'Send a new link'}
        </Button>
        <Button variant="ghost" onClick={onSignOut}>
          <LogOut /> Sign out
        </Button>
      </div>
    </AuthLayout>
  );
}
