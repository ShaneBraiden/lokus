import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage, http } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { Alert, Badge, Button, Card, CardBody, CardFooter, CardHeader, Field, Input, KeyValue, PageHeader, PageLoader, useToast } from '@/ui';
import { candidateKeys, useProfile } from './api';

const profileSchema = z.object({ headline: z.string().trim().max(160, 'Keep it under 160 characters.'), location: z.string().trim().max(120) });
type ProfileValues = z.infer<typeof profileSchema>;

function DetailsCard({ initial }: { initial: ProfileValues }) {
  const qc = useQueryClient();
  const toast = useToast();
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), values: initial });
  const save = useMutation({
    mutationFn: (v: ProfileValues) => http.put('/candidate/profile', v),
    onSuccess: async () => {
      toast.success('Profile saved');
      await qc.invalidateQueries({ queryKey: candidateKeys.profile });
    },
  });
  return (
    <Card>
      <CardHeader title="Profile" description="Shown to employers who can see one of your results." />
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <CardBody className="flex flex-col gap-5">
          {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
          <Field label="Headline" htmlFor="headline" hint="For example: Clinical research coordinator, 2 years in oncology trials." error={form.formState.errors.headline?.message}>
            <Input id="headline" {...form.register('headline')} />
          </Field>
          <Field label="Location" htmlFor="location" error={form.formState.errors.location?.message}>
            <Input id="location" autoComplete="address-level2" {...form.register('location')} />
          </Field>
        </CardBody>
        <CardFooter>
          <Button type="submit" loading={save.isPending} disabled={!form.formState.isDirty}>
            Save profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

const passwordSchema = z
  .object({ current_password: z.string().min(1, 'Enter your current password.'), new_password: z.string().min(10, 'Use at least 10 characters.').max(200), confirm: z.string() })
  .refine((v) => v.new_password === v.confirm, { message: 'The passwords do not match.', path: ['confirm'] });
type PasswordValues = z.infer<typeof passwordSchema>;

function PasswordCard() {
  const toast = useToast();
  const form = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { current_password: '', new_password: '', confirm: '' } });
  const change = useMutation({
    mutationFn: (v: PasswordValues) => http.post('/auth/change-password', { current_password: v.current_password, new_password: v.new_password }),
    onSuccess: () => {
      toast.success('Password changed', 'Other devices have been signed out.');
      form.reset();
    },
  });
  const { errors } = form.formState;
  return (
    <Card>
      <CardHeader title="Password" />
      <form onSubmit={form.handleSubmit((v) => change.mutate(v))} noValidate>
        <CardBody className="flex flex-col gap-5">
          {change.error && <Alert tone="danger">{errorMessage(change.error)}</Alert>}
          <Field label="Current password" htmlFor="current_password" error={errors.current_password?.message}>
            <Input id="current_password" type="password" autoComplete="current-password" {...form.register('current_password')} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="New password" htmlFor="new_password" hint="At least 10 characters." error={errors.new_password?.message}>
              <Input id="new_password" type="password" autoComplete="new-password" {...form.register('new_password')} />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
              <Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} />
            </Field>
          </div>
        </CardBody>
        <CardFooter>
          <Button type="submit" variant="secondary" loading={change.isPending}>
            Change password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function Profile() {
  const { data: me } = useMe();
  const profile = useProfile();
  const toast = useToast();
  const resend = useMutation({ mutationFn: () => http.post('/auth/resend-verification'), onSuccess: () => toast.success('Verification email sent') });
  if (profile.isLoading || !me) return <PageLoader />;
  if (profile.error || !profile.data) return <Alert tone="danger">{errorMessage(profile.error)}</Alert>;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader eyebrow="Candidate" title="Profile" />
      <Card>
        <CardHeader title="Account" />
        <CardBody>
          <KeyValue
            items={[
              { label: 'Name', value: profile.data.name },
              {
                label: 'Email',
                value: (
                  <span className="flex flex-wrap items-center gap-2">
                    {profile.data.email}
                    {me.user.email_verified ? <Badge tone="success">Confirmed</Badge> : <Badge tone="warning">Not confirmed</Badge>}
                  </span>
                ),
              },
            ]}
          />
          {!me.user.email_verified && (
            <Button variant="secondary" size="sm" className="mt-4" loading={resend.isPending} onClick={() => resend.mutate()}>
              <MailCheck /> Resend confirmation email
            </Button>
          )}
          <p className="mt-4 text-xs text-muted">To change your name or email address, contact hello@lokus.example.</p>
        </CardBody>
      </Card>
      <DetailsCard initial={{ headline: profile.data.headline, location: profile.data.location }} />
      <PasswordCard />
    </div>
  );
}
