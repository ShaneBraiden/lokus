import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage, http } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { formatDate, formatDateTime } from '@/lib/format';
import { Alert, Badge, Button, Card, CardBody, CardFooter, CardHeader, Dialog, Field, Input, PageHeader, PageLoader, Select, Table, TD, TH, THead, TR, useToast } from '@/ui';
import { orgKeys } from './api';

interface Team {
  members: { user_id: string; name: string; email: string; role: 'owner' | 'recruiter'; joined_at: string; last_login_at: string | null }[];
  pending_invitations: { id: string; email: string; role: string; expires_at: string; created_at: string }[];
}

export function TeamSettings() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const owner = me?.org?.role === 'owner';
  const settings = useQuery({ queryKey: orgKeys.settings, queryFn: () => http.get<{ name: string; invite_deadline_days: number; role: string }>('/org') });
  const team = useQuery({ queryKey: orgKeys.team, queryFn: () => http.get<Team>('/org/members') });
  const [name, setName] = useState('');
  const [days, setDays] = useState('');
  useEffect(() => {
    if (settings.data) {
      setName(settings.data.name);
      setDays(String(settings.data.invite_deadline_days));
    }
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () => http.patch('/org', { name: name.trim(), invite_deadline_days: Number(days) }),
    onSuccess: () => {
      toast.success('Settings saved');
      void qc.invalidateQueries({ queryKey: orgKeys.settings });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: '', role: 'recruiter' });
  const sendInvite = useMutation({
    mutationFn: () => http.post('/org/members/invite', invite),
    onSuccess: () => {
      toast.success('Invitation sent', `${invite.email} will receive an email.`);
      setInviteOpen(false);
      setInvite({ email: '', role: 'recruiter' });
      void qc.invalidateQueries({ queryKey: orgKeys.team });
    },
  });
  const remove = useMutation({
    mutationFn: (userId: string) => http.delete(`/org/members/${userId}`),
    onSuccess: () => {
      toast.success('Member removed');
      void qc.invalidateQueries({ queryKey: orgKeys.team });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => http.post(`/org/members/invitations/${id}/revoke`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orgKeys.team }),
  });

  if (settings.isLoading || team.isLoading) return <PageLoader />;
  if (settings.error || team.error) return <Alert tone="danger">{errorMessage(settings.error ?? team.error)}</Alert>;
  const dirty = settings.data && (name.trim() !== settings.data.name || Number(days) !== settings.data.invite_deadline_days);
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader eyebrow="Employer" title="Team & settings" description={owner ? 'Manage your organisation and who can see candidate results.' : 'Only owners can change these settings.'} />
      <Card>
        <CardHeader title="Organisation" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="org-name">
            <Input id="org-name" value={name} disabled={!owner} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Default days to complete" htmlFor="org-days" hint="Used when you invite candidates without choosing a deadline.">
            <Input id="org-days" type="number" min={1} max={90} value={days} disabled={!owner} onChange={(e) => setDays(e.target.value)} />
          </Field>
        </CardBody>
        {owner && (
          <CardFooter>
            <Button disabled={!dirty || name.trim().length < 2 || !(Number(days) >= 1 && Number(days) <= 90)} loading={save.isPending} onClick={() => save.mutate()}>
              Save settings
            </Button>
          </CardFooter>
        )}
      </Card>
      <Card>
        <CardHeader
          title="Team"
          description="Everyone here can invite candidates and read your organisation's results."
          action={
            owner && (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus /> Invite member
              </Button>
            )
          }
        />
        <Table>
          <THead>
            <tr>
              <TH>Member</TH>
              <TH>Role</TH>
              <TH>Joined</TH>
              <TH>Last sign-in</TH>
              <TH className="sr-only">Actions</TH>
            </tr>
          </THead>
          <tbody>
            {team.data!.members.map((m) => (
              <TR key={m.user_id}>
                <TD>
                  <span className="block font-medium text-ink">
                    {m.name}
                    {m.user_id === me?.user.id && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}
                  </span>
                  <span className="block text-xs text-muted">{m.email}</span>
                </TD>
                <TD>
                  <Badge tone={m.role === 'owner' ? 'accent' : 'neutral'}>{m.role === 'owner' ? 'Owner' : 'Recruiter'}</Badge>
                </TD>
                <TD>{formatDate(m.joined_at)}</TD>
                <TD className="whitespace-nowrap">{formatDateTime(m.last_login_at)}</TD>
                <TD className="text-right">
                  {owner && m.user_id !== me?.user.id && (
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(m.user_id)} loading={remove.isPending && remove.variables === m.user_id}>
                      Remove
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
            {team.data!.pending_invitations.map((p) => (
              <TR key={p.id}>
                <TD>
                  <span className="block font-medium text-ink">{p.email}</span>
                  <span className="block text-xs text-muted">Invitation pending · expires {formatDate(p.expires_at)}</span>
                </TD>
                <TD>
                  <Badge>{p.role === 'owner' ? 'Owner' : 'Recruiter'}</Badge>
                </TD>
                <TD>—</TD>
                <TD>—</TD>
                <TD className="text-right">
                  {owner && (
                    <Button size="sm" variant="ghost" onClick={() => revoke.mutate(p.id)}>
                      <X /> Withdraw
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
      <Dialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Invite a team member"
        description="They receive an email to create an employer account in your organisation."
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!invite.email.includes('@')} loading={sendInvite.isPending} onClick={() => sendInvite.mutate()}>
              Send invitation
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {sendInvite.error && <Alert tone="danger">{errorMessage(sendInvite.error)}</Alert>}
          <Field label="Email" htmlFor="tm-email">
            <Input id="tm-email" type="email" value={invite.email} onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))} />
          </Field>
          <Field label="Role" htmlFor="tm-role">
            <Select id="tm-role" value={invite.role} onChange={(e) => setInvite((s) => ({ ...s, role: e.target.value }))}>
              <option value="recruiter">Recruiter — invite candidates and read results</option>
              <option value="owner">Owner — also manages the team and settings</option>
            </Select>
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
