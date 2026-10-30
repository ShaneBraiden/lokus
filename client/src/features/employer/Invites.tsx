import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Mail, RotateCw, Send, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage, http } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader, PageLoader, Table, Tabs, TabsContent, TabsList, TabsTrigger, TD, TH, THead, TR, Textarea, useToast } from '@/ui';
import { orgKeys, useInvitations } from './api';

interface InviteResult {
  email: string;
  status: 'invited' | 'already_invited' | 'duplicate_in_batch';
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** "Name, email" or "email" per line; header rows and blank lines are skipped. */
export function parseCandidateList(text: string): { candidates: { name: string; email: string }[]; invalid: string[] } {
  const candidates: { name: string; email: string }[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    const email = cells.find((c) => EMAIL.test(c));
    if (!email) {
      if (!/e-?mail/i.test(line)) invalid.push(line);
      continue;
    }
    const name = cells.filter((c) => c && c !== email).join(' ').trim();
    candidates.push({ name, email: email.toLowerCase() });
  }
  return { candidates, invalid };
}

function useSettings() {
  return useQuery({ queryKey: orgKeys.settings, queryFn: () => http.get<{ name: string; invite_deadline_days: number; role: string }>('/org') });
}

function InviteForm() {
  const qc = useQueryClient();
  const toast = useToast();
  const settings = useSettings();
  const [mode, setMode] = useState('single');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bulk, setBulk] = useState('');
  const [days, setDays] = useState('');
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const parsed = parseCandidateList(bulk);
  const send = useMutation({
    mutationFn: (candidates: { name: string; email: string }[]) => http.post<{ results: InviteResult[] }>('/org/invitations', { candidates, ...(days ? { deadline_days: Number(days) } : {}) }),
    onSuccess: (r) => {
      const invited = r.results.filter((x) => x.status === 'invited').length;
      toast.success(invited ? `${invited} invitation${invited === 1 ? '' : 's'} sent` : 'No new invitations sent');
      setResults(r.results);
      setName('');
      setEmail('');
      setBulk('');
      void qc.invalidateQueries({ queryKey: orgKeys.invitations });
      void qc.invalidateQueries({ queryKey: ['org'] });
    },
  });
  const loadFile = async (file: File | undefined) => {
    if (file) setBulk(await file.text());
  };
  return (
    <Card>
      <CardHeader title="Invite candidates" description="Each candidate gets a personal link by email. They choose whether to create an account, and agree that you receive their result." />
      <CardBody className="flex flex-col gap-5">
        {send.error && <Alert tone="danger">{errorMessage(send.error)}</Alert>}
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList>
            <TabsTrigger value="single">One candidate</TabsTrigger>
            <TabsTrigger value="bulk">Several at once</TabsTrigger>
          </TabsList>
          <TabsContent value="single" className="mt-4 grid gap-4 outline-none sm:grid-cols-2">
            <Field label="Name" htmlFor="inv-name">
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Email" htmlFor="inv-email" required>
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </Field>
          </TabsContent>
          <TabsContent value="bulk" className="mt-4 flex flex-col gap-3 outline-none">
            <Field label="Candidates" htmlFor="inv-bulk" hint="One per line: “Name, email” or just the email. You can also upload a CSV file.">
              <Textarea id="inv-bulk" rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'Asha Rao, asha@example.com\nben@example.com'} className="font-mono text-[13px]" />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-accent hover:underline">
                <FileUp className="size-4" /> Upload CSV
                <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => void loadFile(e.target.files?.[0])} />
              </label>
              <p className="text-xs text-muted">
                {parsed.candidates.length} valid{parsed.invalid.length ? ` · ${parsed.invalid.length} line${parsed.invalid.length === 1 ? '' : 's'} without an email will be skipped` : ''}
              </p>
            </div>
          </TabsContent>
        </Tabs>
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
          <Field label="Days to complete" htmlFor="inv-days" hint={settings.data ? `Default ${settings.data.invite_deadline_days} days` : undefined} className="w-44">
            <Input id="inv-days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} placeholder={settings.data ? String(settings.data.invite_deadline_days) : ''} />
          </Field>
          <Button
            loading={send.isPending}
            disabled={mode === 'single' ? !EMAIL.test(email.trim()) : parsed.candidates.length === 0}
            onClick={() => send.mutate(mode === 'single' ? [{ name: name.trim(), email: email.trim() }] : parsed.candidates)}
          >
            <Send /> {mode === 'single' ? 'Send invitation' : `Send ${parsed.candidates.length || ''} invitation${parsed.candidates.length === 1 ? '' : 's'}`}
          </Button>
        </div>
        {results && results.some((x) => x.status !== 'invited') && (
          <Alert tone="info" title="Some addresses were skipped">
            {results
              .filter((x) => x.status !== 'invited')
              .map((x) => `${x.email} (${x.status === 'already_invited' ? 'already invited' : 'duplicate'})`)
              .join(', ')}
          </Alert>
        )}
      </CardBody>
    </Card>
  );
}

export function Invites() {
  const list = useInvitations();
  const qc = useQueryClient();
  const toast = useToast();
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'resend' | 'revoke' }) => http.post(`/org/invitations/${id}/${action}`),
    onSuccess: (_r, v) => {
      toast.success(v.action === 'resend' ? 'Invitation resent' : 'Invitation withdrawn');
      void qc.invalidateQueries({ queryKey: orgKeys.invitations });
      void qc.invalidateQueries({ queryKey: ['org'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Employer" title="Invitations" description="Invite candidates to NorthrSim · Clinical Trial Associate and follow their progress." />
      <InviteForm />
      <Card>
        <CardHeader title="Sent invitations" />
        {list.isLoading ? (
          <PageLoader />
        ) : !list.data?.length ? (
          <EmptyState icon={<Mail />} title="No invitations yet" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Candidate</TH>
                <TH>Status</TH>
                <TH>Complete by</TH>
                <TH>Last sent</TH>
                <TH className="sr-only">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {list.data.map((i) => (
                <TR key={i.id}>
                  <TD>
                    <span className="block font-medium text-ink">{i.name || i.email}</span>
                    {i.name && <span className="block text-xs text-muted">{i.email}</span>}
                  </TD>
                  <TD>{i.status === 'revoked' ? <Badge>Withdrawn</Badge> : i.status === 'pending' ? <Badge tone="info">Invited</Badge> : <span>{i.progress}</span>}</TD>
                  <TD className="whitespace-nowrap">{formatDate(i.deadline_at)}</TD>
                  <TD className="whitespace-nowrap">{formatDateTime(i.last_sent_at ?? i.created_at)}</TD>
                  <TD className="whitespace-nowrap text-right">
                    {i.status === 'pending' ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: i.id, action: 'resend' })} disabled={act.isPending}>
                          <RotateCw /> Resend
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: i.id, action: 'revoke' })} disabled={act.isPending}>
                          <X /> Withdraw
                        </Button>
                      </>
                    ) : i.attempt_id ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/org/results/${i.attempt_id}`}>Open</Link>
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
