import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { errorMessage, http } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { Alert, Badge, Button, Card, Dialog, EmptyState, Field, Input, KeyValue, PageHeader, PageLoader, Select, Table, TD, TH, THead, TR, Textarea, useToast } from '@/ui';

type Status = 'pending' | 'approved' | 'rejected';

interface AccessRequestRow {
  id: string;
  org_name: string;
  contact_name: string;
  email: string;
  job_title: string;
  website: string;
  team_size: string;
  hiring_needs: string;
  status: Status;
  decision_note: string;
  decided_at: string | null;
  decided_by: string | null;
  org_id: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<Status, { tone: 'warning' | 'success' | 'danger'; label: string }> = {
  pending: { tone: 'warning', label: 'Pending' },
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'danger', label: 'Rejected' },
};

/** Employer access requests from the public form: an admin approves (creating the organisation) or rejects each one. */
export function AccessRequests() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<Status | ''>('pending');
  const q = useQuery({
    queryKey: ['admin', 'access-requests', status],
    queryFn: () => http.get<{ requests: AccessRequestRow[] }>(`/admin/access-requests${status ? `?status=${status}` : ''}`).then((r) => r.requests),
  });
  const [open, setOpen] = useState<AccessRequestRow | null>(null);
  const [orgName, setOrgName] = useState('');
  const [note, setNote] = useState('');
  const show = (r: AccessRequestRow) => {
    setOpen(r);
    setOrgName(r.org_name);
    setNote('');
    approve.reset();
    reject.reset();
  };
  const done = () => {
    setOpen(null);
    void qc.invalidateQueries({ queryKey: ['admin', 'access-requests'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'orgs'] });
  };
  const approve = useMutation({
    mutationFn: (r: AccessRequestRow) => http.post<{ default_password?: string }>(`/admin/access-requests/${r.id}/approve`, { org_name: orgName.trim(), note: note.trim() }),
    onSuccess: (res, r) => {
      toast.success('Access approved', res.default_password ? `${r.email} can sign in now with the password ${res.default_password}` : `${orgName.trim()} was created and an invitation was emailed to ${r.email}.`);
      done();
    },
  });
  const reject = useMutation({
    mutationFn: (r: AccessRequestRow) => http.post(`/admin/access-requests/${r.id}/reject`, { note: note.trim() }),
    onSuccess: (_res, r) => {
      toast.success('Request rejected', `${r.org_name}'s request was declined.`);
      done();
    },
  });
  const pending = open?.status === 'pending';
  const busy = approve.isPending || reject.isPending;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Lokus admin" title="Access requests" description="Employers who asked for access through the public form. Approving creates the organisation and invites the requester as its owner." />
      <Select aria-label="Status" className="w-48" value={status} onChange={(e) => setStatus(e.target.value as Status | '')}>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="">All requests</option>
      </Select>
      <Card>
        {q.isLoading ? (
          <PageLoader />
        ) : q.error ? (
          <Alert tone="danger">{errorMessage(q.error)}</Alert>
        ) : !q.data?.length ? (
          <EmptyState icon={<Inbox />} title={status === 'pending' ? 'No requests waiting' : 'No requests'}>
            New requests from the employer access form appear here.
          </EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Organisation</TH>
                <TH>Contact</TH>
                <TH>Size</TH>
                <TH>Submitted</TH>
                <TH>Status</TH>
                <TH className="sr-only">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {q.data.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium text-ink">{r.org_name}</TD>
                  <TD>
                    <span className="block text-ink">{r.contact_name}</span>
                    <span className="block text-xs text-muted">{r.email}</span>
                  </TD>
                  <TD>{r.team_size || '—'}</TD>
                  <TD className="whitespace-nowrap">{formatDate(r.created_at)}</TD>
                  <TD>
                    <Badge tone={STATUS_BADGE[r.status].tone}>{STATUS_BADGE[r.status].label}</Badge>
                  </TD>
                  <TD className="text-right">
                    <Button size="sm" variant={r.status === 'pending' ? 'secondary' : 'ghost'} onClick={() => show(r)}>
                      {r.status === 'pending' ? 'Review' : 'View'}
                    </Button>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Dialog
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open?.org_name ?? ''}
        description={pending ? 'Approve to create the organisation and invite this person as its owner.' : undefined}
        footer={
          pending && open ? (
            <>
              <Button variant="secondary" onClick={() => reject.mutate(open)} loading={reject.isPending} disabled={busy}>
                Reject
              </Button>
              <Button onClick={() => approve.mutate(open)} loading={approve.isPending} disabled={busy || orgName.trim().length < 2}>
                Approve and invite
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Close
            </Button>
          )
        }
      >
        {open && (
          <div className="flex flex-col gap-5">
            {(approve.error || reject.error) && <Alert tone="danger">{errorMessage(approve.error ?? reject.error)}</Alert>}
            <KeyValue
              items={[
                { label: 'Contact', value: open.contact_name },
                { label: 'Email', value: open.email },
                { label: 'Job title', value: open.job_title || '—' },
                { label: 'Company size', value: open.team_size || '—' },
                {
                  label: 'Website',
                  value: /^https?:\/\//i.test(open.website) ? (
                    <a href={open.website} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                      {open.website}
                    </a>
                  ) : (
                    open.website || '—'
                  ),
                },
                { label: 'Submitted', value: formatDateTime(open.created_at) },
              ]}
            />
            {open.hiring_needs && (
              <div>
                <p className="text-xs font-medium text-muted">Hiring needs</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{open.hiring_needs}</p>
              </div>
            )}
            {pending ? (
              <>
                <Field label="Organisation name" htmlFor="ar-org" hint="Correct it here if needed before approving.">
                  <Input id="ar-org" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </Field>
                <Field label="Note" htmlFor="ar-note" optional hint="Included in the email if you reject the request.">
                  <Textarea id="ar-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
              </>
            ) : (
              <Alert tone={open.status === 'approved' ? 'success' : 'neutral'} title={`${STATUS_BADGE[open.status].label} ${open.decided_by ? `by ${open.decided_by} ` : ''}on ${formatDateTime(open.decided_at)}`}>
                {open.decision_note || 'No note was added.'}
              </Alert>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
