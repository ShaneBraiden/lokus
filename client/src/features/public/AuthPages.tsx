import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, MailCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { AuthLayout } from '@/layouts/AuthLayout';
import { ApiError, errorMessage, http } from '@/lib/api';
import { ME_KEY, homeFor, useMe, type Me } from '@/lib/auth';
import { Alert, Button, Checkbox, Field, Input, Select, Spinner, Textarea } from '@/ui';

const emailField = z.email('Enter a valid email address.');
const newPassword = z.string().min(10, 'Use at least 10 characters.').max(200);

function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export function SignIn() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const schema = z.object({ email: emailField, password: z.string().min(1, 'Enter your password.') });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const login = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => http.post<Me>('/auth/login', v),
    onSuccess: (me) => {
      qc.setQueryData(ME_KEY, me);
      navigate(me.user.kind === 'staff' && me.user.mfa.required ? '/mfa' : (safeNext(params.get('next')) ?? homeFor(me)), { replace: true });
    },
  });
  const { errors } = form.formState;
  return (
    <AuthLayout
      title="Sign in to Lokus"
      subtitle="Enter your email and password to continue."
      footer={
        <>
          New candidate?{' '}
          <Link to="/signup" className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
          <p className="mt-3">
            Hiring?{' '}
            <Link to="/request-access" className="font-semibold text-accent hover:underline">
              Request employer access
            </Link>
          </p>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => login.mutate(v))} noValidate>
        {login.error && <Alert tone="danger">{errorMessage(login.error)}</Alert>}
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...form.register('password')} />
        </Field>
        <div className="-mt-2 text-right">
          <Link to="/forgot" className="text-[13px] font-medium text-accent hover:underline">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" size="lg" loading={login.isPending}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}

export function SignUp() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const schema = z.object({
    name: z.string().trim().min(1, 'Enter your name.').max(120),
    email: emailField,
    password: newPassword,
    accept_terms: z.literal(true, { error: 'Please accept the terms to continue.' }),
  });
  const form = useForm<z.input<typeof schema>>({ resolver: zodResolver(schema) });
  const signup = useMutation({
    mutationFn: (v: z.input<typeof schema>) => http.post<Me>('/auth/signup', v),
    onSuccess: (me) => {
      qc.setQueryData(ME_KEY, me);
      navigate('/app', { replace: true });
    },
  });
  const { errors } = form.formState;
  return (
    <AuthLayout
      title="Create your candidate account"
      subtitle="Take the Clinical Trial Associate simulation and let employers on Lokus see your result."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
          <p className="mt-3">
            Hiring?{' '}
            <Link to="/request-access" className="font-semibold text-accent hover:underline">
              Request employer access
            </Link>
          </p>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => signup.mutate(v))} noValidate>
        {signup.error && (
          <Alert tone="danger" action={signup.error instanceof ApiError && signup.error.code === 'email_taken' ? <Link to="/login" className="text-sm font-semibold text-accent">Sign in</Link> : undefined}>
            {errorMessage(signup.error)}
          </Alert>
        )}
        <Field label="Full name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...form.register('name')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 10 characters." error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register('password')} />
        </Field>
        <div>
          <Checkbox
            label={
              <>
                I agree to the{' '}
                <Link to="/legal/terms" target="_blank" className="text-accent underline">
                  terms
                </Link>{' '}
                and{' '}
                <Link to="/legal/privacy" target="_blank" className="text-accent underline">
                  privacy notice
                </Link>
              </>
            }
            description="This includes sharing your result report, name, headline, location and email with employers on Lokus."
            {...form.register('accept_terms')}
          />
          {errors.accept_terms && <p className="mt-1.5 text-xs font-medium text-danger">{errors.accept_terms.message}</p>}
        </div>
        <Button type="submit" size="lg" loading={signup.isPending}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

/** Public form for employers: a Lokus admin reviews each request and, on approval, sets up the organisation. */
export function RequestAccess() {
  const schema = z.object({
    org_name: z.string().trim().min(2, "Enter your organisation's name.").max(120),
    contact_name: z.string().trim().min(1, 'Enter your name.').max(120),
    email: emailField,
    job_title: z.string().trim().max(120),
    website: z.string().trim().max(254),
    team_size: z.enum(['', '1-10', '11-50', '51-200', '201-1000', '1000+']),
    hiring_needs: z.string().trim().max(2000, 'Keep this under 2,000 characters.'),
    accept_terms: z.literal(true, { error: 'Please accept the terms to continue.' }),
  });
  const form = useForm<z.input<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { job_title: '', website: '', team_size: '', hiring_needs: '' } });
  const submit = useMutation({ mutationFn: (v: z.input<typeof schema>) => http.post('/access-requests', v) });
  const { errors } = form.formState;
  return (
    <AuthLayout
      title="Request employer access"
      subtitle="Tell us about your organisation. Our team reviews every request and emails you with the decision."
      footer={
        <>
          Already have an employer account?{' '}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {submit.isSuccess ? (
        <Alert tone="success" title="Request received">
          Thanks — we will review your request and email {form.getValues('email')} once it has been decided. If approved, you will receive an invitation to set up your organisation&rsquo;s account.
        </Alert>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => submit.mutate(v))} noValidate>
          {submit.error && (
            <Alert tone="danger" action={submit.error instanceof ApiError && submit.error.code === 'email_taken' ? <Link to="/login" className="text-sm font-semibold text-accent">Sign in</Link> : undefined}>
              {errorMessage(submit.error)}
            </Alert>
          )}
          <Field label="Organisation name" htmlFor="org_name" error={errors.org_name?.message}>
            <Input id="org_name" autoComplete="organization" aria-invalid={!!errors.org_name} {...form.register('org_name')} />
          </Field>
          <Field label="Your name" htmlFor="contact_name" error={errors.contact_name?.message}>
            <Input id="contact_name" autoComplete="name" aria-invalid={!!errors.contact_name} {...form.register('contact_name')} />
          </Field>
          <Field label="Work email" htmlFor="email" hint="You will become the organisation's owner if approved." error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register('email')} />
          </Field>
          <Field label="Job title" htmlFor="job_title" optional error={errors.job_title?.message}>
            <Input id="job_title" autoComplete="organization-title" {...form.register('job_title')} />
          </Field>
          <Field label="Company website" htmlFor="website" optional error={errors.website?.message}>
            <Input id="website" type="url" inputMode="url" placeholder="https://" {...form.register('website')} />
          </Field>
          <Field label="Company size" htmlFor="team_size" optional>
            <Select id="team_size" {...form.register('team_size')}>
              <option value="">Select…</option>
              <option value="1-10">1–10 employees</option>
              <option value="11-50">11–50 employees</option>
              <option value="51-200">51–200 employees</option>
              <option value="201-1000">201–1,000 employees</option>
              <option value="1000+">More than 1,000 employees</option>
            </Select>
          </Field>
          <Field label="What are you hiring for?" htmlFor="hiring_needs" optional error={errors.hiring_needs?.message}>
            <Textarea id="hiring_needs" rows={3} placeholder="Roles, number of candidates, timeline…" {...form.register('hiring_needs')} />
          </Field>
          <div>
            <Checkbox
              label={
                <>
                  I agree to the{' '}
                  <Link to="/legal/terms" target="_blank" className="text-accent underline">
                    terms
                  </Link>{' '}
                  and{' '}
                  <Link to="/legal/privacy" target="_blank" className="text-accent underline">
                    privacy notice
                  </Link>
                </>
              }
              {...form.register('accept_terms')}
            />
            {errors.accept_terms && <p className="mt-1.5 text-xs font-medium text-danger">{errors.accept_terms.message}</p>}
          </div>
          <Button type="submit" size="lg" loading={submit.isPending}>
            Submit request
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const schema = z.object({ email: emailField });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const forgot = useMutation({ mutationFn: (v: z.infer<typeof schema>) => http.post('/auth/forgot-password', v) });
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your account email and we will send you a link to choose a new password."
      footer={
        <Link to="/login" className="font-semibold text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      {forgot.isSuccess ? (
        <Alert tone="success" title="Check your email">
          If an account exists for that address, a reset link is on its way. It expires in one hour.
        </Alert>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => forgot.mutate(v))} noValidate>
          {forgot.error && <Alert tone="danger">{errorMessage(forgot.error)}</Alert>}
          <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          </Field>
          <Button type="submit" size="lg" loading={forgot.isPending}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const schema = z
    .object({ password: newPassword, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: 'The passwords do not match.', path: ['confirm'] });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const reset = useMutation({ mutationFn: (v: z.infer<typeof schema>) => http.post('/auth/reset-password', { token, password: v.password }) });
  const { errors } = form.formState;
  return (
    <AuthLayout title="Choose a new password" subtitle="Use at least 10 characters. Other devices will be signed out.">
      {reset.isSuccess ? (
        <div className="flex flex-col gap-5">
          <Alert tone="success" title="Password updated">
            You can now sign in with your new password.
          </Alert>
          <Button asChild size="lg">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => reset.mutate(v))} noValidate>
          {!token && <Alert tone="danger">This link is incomplete. Request a new one from the sign-in page.</Alert>}
          {reset.error && <Alert tone="danger">{errorMessage(reset.error)}</Alert>}
          <Field label="New password" htmlFor="password" error={errors.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
            <Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} />
          </Field>
          <Button type="submit" size="lg" loading={reset.isPending} disabled={!token}>
            Save password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [state, setState] = useState<'working' | 'done' | 'failed'>(token ? 'working' : 'failed');
  const [message, setMessage] = useState('');
  const sent = useRef(false);
  const resend = useMutation({ mutationFn: () => http.post('/auth/resend-verification') });

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    http
      .post('/auth/verify-email', { token })
      .then(() => {
        setState('done');
        void qc.invalidateQueries({ queryKey: ME_KEY });
      })
      .catch((err) => {
        setMessage(errorMessage(err));
        setState('failed');
      });
  }, [token, qc]);

  return (
    <AuthLayout title="Confirm your email">
      {state === 'working' && <Spinner label="Confirming your email" />}
      {state === 'done' && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 text-success">
            <CircleCheck className="size-6" />
            <p className="font-semibold text-ink">Your email address is confirmed.</p>
          </div>
          <Button asChild size="lg">
            <Link to={me ? homeFor(me) : '/login'}>{me ? 'Continue' : 'Sign in'}</Link>
          </Button>
        </div>
      )}
      {state === 'failed' && (
        <div className="flex flex-col gap-5">
          <Alert tone="danger">{message || 'This link is invalid or has expired.'}</Alert>
          {me && !me.user.email_verified && (
            <Button variant="secondary" loading={resend.isPending} disabled={resend.isSuccess} onClick={() => resend.mutate()}>
              <MailCheck /> {resend.isSuccess ? 'New link sent' : 'Send a new link'}
            </Button>
          )}
          {!me && (
            <Link to="/login" className="text-sm font-semibold text-accent hover:underline">
              Sign in to request a new link
            </Link>
          )}
        </div>
      )}
    </AuthLayout>
  );
}
