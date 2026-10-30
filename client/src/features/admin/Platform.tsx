import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { errorMessage, http } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Dialog, EmptyState, Field, Input, KeyValue, PageHeader, PageLoader, Select, Table, TD, TH, THead, TR, useToast } from '@/ui';

interface ContentRegister {
  simulation: { code: string; version: string; title: string; contentVersion: string; study: { id: string; title: string; sponsor: string; cro: string } };
  documents: { id: string; title: string; short_title: string; version: string; status: string; sections: number }[];
  participants: number;
  emails: number;
  packages: { id: string; label: string; status: string; sme_status: string }[];
  sme: { active_package: string | null; status: string | null; register: { id: string; area: string; title: string; draft: string; where: string }[] };
}

export function Content() {
  const q = useQuery({ queryKey: ['admin', 'content'], queryFn: () => http.get<ContentRegister>('/admin/content') });
  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const c = q.data;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Lokus admin" title="Content & SME register" description="What candidates see, and every drafted rule or story element that needs a subject-matter expert's sign-off before live use." />
      {c.sme.status !== 'SME confirmed' && <Alert tone="warning" title="Awaiting SME sign-off">The active package ({c.sme.active_package}) is marked “{c.sme.status}”. Record sign-off on the package once an SME has reviewed the items below.</Alert>}
      <Card>
        <CardHeader title={c.simulation.title} description={`${c.simulation.code} v${c.simulation.version} · ${c.simulation.contentVersion}`} />
        <CardBody>
          <KeyValue
            className="lg:grid-cols-4"
            items={[
              { label: 'Study', value: `${c.simulation.study.id} — ${c.simulation.study.title}` },
              { label: 'Sponsor / CRO', value: `${c.simulation.study.sponsor} / ${c.simulation.study.cro}` },
              { label: 'Participant CRFs', value: c.participants },
              { label: 'Emails', value: c.emails },
            ]}
          />
        </CardBody>
        <Table>
          <THead>
            <tr>
              <TH>Document</TH>
              <TH>Version</TH>
              <TH>Status</TH>
              <TH numeric>Sections</TH>
            </tr>
          </THead>
          <tbody>
            {c.documents.map((d) => (
              <TR key={d.id}>
                <TD className="font-medium text-ink">{d.title}</TD>
                <TD>{d.version}</TD>
                <TD>{d.status}</TD>
                <TD numeric>{d.sections}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card>
        <CardHeader title="SME-confirm register" description={`${c.sme.register.length} drafted items`} />
        <Table>
          <THead>
            <tr>
              <TH>Item</TH>
              <TH>Area</TH>
              <TH>Drafted as</TH>
              <TH>Where</TH>
            </tr>
          </THead>
          <tbody>
            {c.sme.register.map((r) => (
              <TR key={r.id}>
                <TD>
                  <span className="block font-medium text-ink">{r.title}</span>
                  <span className="block font-mono text-[11px] text-faint">{r.id}</span>
                </TD>
                <TD>
                  <Badge>{r.area}</Badge>
                </TD>
                <TD className="max-w-xl text-[13px]">{r.draft}</TD>
                <TD className="font-mono text-[11px] text-muted">{r.where}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  created_at: string;
  members: number;
}

export function Orgs() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin', 'orgs'], queryFn: () => http.get<{ organizations: OrgRow[] }>('/admin/orgs').then((r) => r.organizations) });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const create = useMutation({
    mutationFn: () => http.post<{ default_password?: string }>('/admin/orgs', { name: name.trim(), owner_email: owner.trim() }),
    onSuccess: (r) => {
      toast.success('Organisation created', r.default_password ? `${owner.trim()} can sign in now with the password ${r.default_password}` : `An invitation was emailed to ${owner.trim()}.`);
      setOpen(false);
      setName('');
      setOwner('');
      void qc.invalidateQueries({ queryKey: ['admin', 'orgs'] });
    },
  });
  const toggle = useMutation({
    mutationFn: (o: OrgRow) => http.patch(`/admin/orgs/${o.id}`, { status: o.status === 'active' ? 'suspended' : 'active' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'orgs'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Lokus admin"
        title="Organisations"
        description="Employer accounts. Each organisation's data is isolated from the others."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> New organisation
          </Button>
        }
      />
      <Card>
        {q.isLoading ? (
          <PageLoader />
        ) : !q.data?.length ? (
          <EmptyState title="No organisations yet">Create one and invite its first owner.</EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Organisation</TH>
                <TH numeric>Members</TH>
                <TH>Status</TH>
                <TH>Created</TH>
                <TH className="sr-only">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {q.data.map((o) => (
                <TR key={o.id}>
                  <TD>
                    <span className="block font-medium text-ink">{o.name}</span>
                    <span className="block font-mono text-[11px] text-faint">{o.slug}</span>
                  </TD>
                  <TD numeric>{o.members}</TD>
                  <TD>{o.status === 'active' ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Suspended</Badge>}</TD>
                  <TD>{formatDate(o.created_at)}</TD>
                  <TD className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => toggle.mutate(o)} loading={toggle.isPending && toggle.variables?.id === o.id}>
                      {o.status === 'active' ? 'Suspend' : 'Reactivate'}
                    </Button>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="New organisation"
        description="The owner receives an email invitation to create their account."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={name.trim().length < 2 || !owner.includes('@')}>
              Create and invite
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {create.error && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
          <Field label="Organisation name" htmlFor="org-name">
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Owner's email" htmlFor="org-owner">
            <Input id="org-owner" type="email" value={owner} onChange={(e) => setOwner(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  kind: 'candidate' | 'employer' | 'staff';
  platform_role: 'admin' | 'assessor' | null;
  email_verified: boolean;
  mfa_enabled: boolean;
  disabled_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

export function Users() {
  const qc = useQueryClient();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const q = useQuery({ queryKey: ['admin', 'users', search, kind], queryFn: () => http.get<{ users: UserRow[] }>(`/admin/users?${new URLSearchParams({ ...(search ? { query: search } : {}), ...(kind ? { kind } : {}) })}`).then((r) => r.users) });
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState({ name: '', email: '', role: 'assessor' });
  const create = useMutation({
    mutationFn: () => http.post<{ default_password?: string }>('/admin/staff', staff),
    onSuccess: (r) => {
      toast.success('Staff account created', r.default_password ? `${staff.email} can sign in now with the password ${r.default_password}` : 'A set-password link was emailed.');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => http.patch(`/admin/users/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Lokus admin"
        title="Users"
        description="Candidates, employer team members and Lokus staff."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> New staff account
          </Button>
        }
      />
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
        }}
      >
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input aria-label="Search users" placeholder="Name or email" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select aria-label="Kind" className="w-44" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Everyone</option>
          <option value="candidate">Candidates</option>
          <option value="employer">Employers</option>
          <option value="staff">Staff</option>
        </Select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <Card>
        {q.isLoading ? (
          <PageLoader />
        ) : !q.data?.length ? (
          <EmptyState title="No users match" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>User</TH>
                <TH>Kind</TH>
                <TH>Security</TH>
                <TH>Last sign-in</TH>
                <TH className="sr-only">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {q.data.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <span className="block font-medium text-ink">{u.name}</span>
                    <span className="block text-xs text-muted">{u.email}</span>
                  </TD>
                  <TD>
                    <span className="flex flex-wrap gap-1.5">
                      <Badge>{u.kind}</Badge>
                      {u.platform_role && <Badge tone="info">{u.platform_role}</Badge>}
                      {u.disabled_at && <Badge tone="danger">Disabled</Badge>}
                    </span>
                  </TD>
                  <TD className="text-xs">
                    {u.email_verified ? 'Email confirmed' : 'Email not confirmed'}
                    {u.kind === 'staff' && <span className="block">{u.mfa_enabled ? 'Two-step on' : 'Two-step not set up'}</span>}
                  </TD>
                  <TD className="whitespace-nowrap">{formatDateTime(u.last_login_at)}</TD>
                  <TD className="whitespace-nowrap text-right">
                    {u.kind === 'staff' && (
                      <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: u.id, body: { platform_role: u.platform_role === 'admin' ? 'assessor' : 'admin' } })}>
                        Make {u.platform_role === 'admin' ? 'assessor' : 'admin'}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: u.id, body: { disabled: !u.disabled_at } })}>
                      {u.disabled_at ? 'Enable' : 'Disable'}
                    </Button>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="New staff account"
        description="Staff sign in with a password and an authenticator app."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!staff.name.trim() || !staff.email.includes('@')}>
              Create and email
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {create.error && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
          <Field label="Name" htmlFor="staff-name">
            <Input id="staff-name" value={staff.name} onChange={(e) => setStaff((s) => ({ ...s, name: e.target.value }))} />
          </Field>
          <Field label="Email" htmlFor="staff-email">
            <Input id="staff-email" type="email" value={staff.email} onChange={(e) => setStaff((s) => ({ ...s, email: e.target.value }))} />
          </Field>
          <Field label="Role" htmlFor="staff-role">
            <Select id="staff-role" value={staff.role} onChange={(e) => setStaff((s) => ({ ...s, role: e.target.value }))}>
              <option value="assessor">Assessor — blind review only</option>
              <option value="admin">Admin — everything</option>
            </Select>
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

interface AuditEntry {
  id: number;
  actorId: string | null;
  actorRole: string;
  orgId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  ip: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export function Audit() {
  const [type, setType] = useState('');
  const q = useQuery({ queryKey: ['admin', 'audit', type], queryFn: () => http.get<{ entries: AuditEntry[] }>(`/admin/audit?limit=300${type ? `&target_type=${type}` : ''}`).then((r) => r.entries) });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Lokus admin" title="Audit log" description="Who viewed or changed what. Entries cannot be edited or deleted." />
      <Select aria-label="Target type" className="w-60" value={type} onChange={(e) => setType(e.target.value)}>
        <option value="">All targets</option>
        {['access_request', 'attempt', 'review_item', 'scoring_package', 'invitation', 'organization', 'user', 'share_request', 'result'].map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <Card>
        {q.isLoading ? (
          <PageLoader />
        ) : !q.data?.length ? (
          <EmptyState title="No entries" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Action</TH>
                <TH>Actor</TH>
                <TH>Target</TH>
                <TH>Details</TH>
              </tr>
            </THead>
            <tbody>
              {q.data.map((e) => (
                <TR key={e.id}>
                  <TD className="whitespace-nowrap">{formatDateTime(e.createdAt)}</TD>
                  <TD className="font-mono text-[12px] text-ink">{e.action}</TD>
                  <TD>{e.actorRole}</TD>
                  <TD className="font-mono text-[11px]">
                    {e.targetType} · {e.targetId.slice(0, 18)}
                  </TD>
                  <TD className="max-w-sm truncate font-mono text-[11px] text-muted">{Object.keys(e.details ?? {}).length ? JSON.stringify(e.details) : ''}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
