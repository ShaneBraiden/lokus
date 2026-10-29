import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Building } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { AuthLayout } from '@/layouts/AuthLayout';
import { errorMessage, http } from '@/lib/api';
import { ME_KEY, useMe } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { Alert, Button, Checkbox, Field, Input, PageLoader } from '@/ui';

interface InvitePreview {
  org_name: string;
  simulation_title: string;
  email: string;
  name: string;
  deadline_at: string | null;
  account_exists: boolean;
  signed_in_as_invitee: boolean;
}

interface AcceptResult {
  attempt_id: string;
  share_request_id: string | null;
  shared: boolean;
  org_name: string;
}

export function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const preview = useQuery({
    queryKey: ['invite-preview', token, me?.user.id ?? null],
    queryFn: () => http.post<InvitePreview>('/invites/preview', { token }),
    enabled: Boolean(token),
    retry: false,
  });
  const schema = z.object({
    name: z.string().trim().max(120).optional(),
    password: z.string().max(200).optional(),
    consent: z.literal(true, { error: 'Please confirm to continue.' }),
  });
  const form = useForm<z.input<typeof schema>>({ resolver: zodResolver(schema) });
  const accept = useMutation({
    mutationFn: (v: z.input<typeof schema>) => http.post<AcceptResult>('/invites/accept', { token, ...v, name: v.name || undefined, password: v.password || undefined }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ME_KEY });
      navigate(r.share_request_id ? '/app' : `/app/assessments/${r.attempt_id}`, { replace: true, state: { welcome: r.org_name } });
    },
  });

  if (!token) return <AuthLayout title="Invitation">{<Alert tone="danger">This invitation link is incomplete.</Alert>}</AuthLayout>;
  if (preview.isLoading) return <PageLoader />;
  if (preview.error) {
    return (
      <AuthLayout title="Invitation" footer={<Link to="/login" className="font-semibold text-accent hover:underline">Go to sign in</Link>}>
        <Alert tone="danger">{errorMessage(preview.error)}</Alert>
      </AuthLayout>
    );
  }
  const p = preview.data!;
  const needsSignIn = p.account_exists && !p.signed_in_as_invitee;
  const newAccount = !p.account_exists;
  const { errors } = form.formState;

  return (
    <AuthLayout title={`${p.org_name} has invited you`} subtitle={`to complete ${p.simulation_title}.`}>
      <div className="mb-6 flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-sm">
        <p className="flex items-center gap-2 text-ink-2">
          <Building className="size-4 text-muted" /> Invited as <span className="font-semibold text-ink">{p.email}</span>
        </p>
        {p.deadline_at && (
          <p className="flex items-center gap-2 text-ink-2">
            <CalendarClock className="size-4 text-muted" /> Complete by <span className="font-semibold text-ink">{formatDate(p.deadline_at)}</span>
          </p>
        )}
      </div>

      {needsSignIn ? (
        <div className="flex flex-col gap-4">
          <Alert tone="info">You already have a Lokus account for {p.email}. Sign in with it to accept.</Alert>
          {me && <p className="text-sm text-muted">You are signed in as {me.user.email}. Sign out first, then sign in as {p.email}.</p>}
          <Button asChild size="lg">
            <Link to={`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`}>Sign in to accept</Link>
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => accept.mutate(v))} noValidate>
          {accept.error && <Alert tone="danger">{errorMessage(accept.error)}</Alert>}
          {newAccount && (
            <>
              <Field label="Full name" htmlFor="name" error={errors.name?.message}>
                <Input id="name" autoComplete="name" defaultValue={p.name} {...form.register('name', { required: 'Enter your name.' })} />
              </Field>
              <Field label="Choose a password" htmlFor="password" hint="At least 10 characters." error={errors.password?.message}>
                <Input id="password" type="password" autoComplete="new-password" {...form.register('password', { minLength: { value: 10, message: 'Use at least 10 characters.' } })} />
              </Field>
            </>
          )}
          <div>
            <Checkbox
              label={`I agree that ${p.org_name} will receive my results for this assessment.`}
              description={
                <>
                  Your actions in the simulation are recorded to assess your work. See the{' '}
                  <Link to="/legal/privacy" target="_blank" className="text-accent underline">
                    privacy notice
                  </Link>
                  {newAccount ? (
                    <>
                      {' '}and{' '}
                      <Link to="/legal/terms" target="_blank" className="text-accent underline">
                        terms
                      </Link>
                    </>
                  ) : null}
                  .
                </>
              }
              {...form.register('consent')}
            />
            {errors.consent && <p className="mt-1.5 text-xs font-medium text-danger">{errors.consent.message}</p>}
          </div>
          <Button type="submit" size="lg" loading={accept.isPending}>
            {newAccount ? 'Create account and accept' : 'Accept invitation'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

interface TeamPreview {
  org_name: string;
  email: string;
  role: 'owner' | 'recruiter';
  account_exists: boolean;
}

export function AcceptTeamInvite() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const preview = useQuery({ queryKey: ['team-invite', token], queryFn: () => http.post<TeamPreview>('/team-invites/preview', { token }), enabled: Boolean(token), retry: false });
  const schema = z.object({ name: z.string().trim().max(120).optional(), password: z.string().max(200).optional() });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const accept = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => http.post('/team-invites/accept', { token, name: v.name || undefined, password: v.password || undefined }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ME_KEY });
      navigate('/org', { replace: true });
    },
  });
  if (preview.isLoading) return <PageLoader />;
  if (!token || preview.error) {
    return (
      <AuthLayout title="Team invitation">
        <Alert tone="danger">{token ? errorMessage(preview.error) : 'This invitation link is incomplete.'}</Alert>
      </AuthLayout>
    );
  }
  const p = preview.data!;
  return (
    <AuthLayout title={`Join ${p.org_name} on Lokus`} subtitle={`You have been invited as ${p.role === 'owner' ? 'an owner' : 'a recruiter'}.`}>
      {p.account_exists ? (
        <form className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => accept.mutate(v))}>
          {accept.error && <Alert tone="danger">{errorMessage(accept.error)}</Alert>}
          <Alert tone="info">Sign in as {p.email} first if you have not already, then accept.</Alert>
          <div className="flex gap-2">
            <Button type="submit" loading={accept.isPending}>
              Accept invitation
            </Button>
            <Button asChild variant="secondary">
              <Link to={`/login?next=${encodeURIComponent(`/team-invite?token=${token}`)}`}>Sign in</Link>
            </Button>
          </div>
        </form>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => accept.mutate(v))} noValidate>
          {accept.error && <Alert tone="danger">{errorMessage(accept.error)}</Alert>}
          <Field label="Email" htmlFor="email">
            <Input id="email" value={p.email} disabled readOnly />
          </Field>
          <Field label="Full name" htmlFor="name" error={form.formState.errors.name?.message}>
            <Input id="name" autoComplete="name" {...form.register('name', { required: 'Enter your name.' })} />
          </Field>
          <Field label="Choose a password" htmlFor="password" hint="At least 10 characters." error={form.formState.errors.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" {...form.register('password', { minLength: { value: 10, message: 'Use at least 10 characters.' } })} />
          </Field>
          <Button type="submit" size="lg" loading={accept.isPending}>
            Create account and join
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
