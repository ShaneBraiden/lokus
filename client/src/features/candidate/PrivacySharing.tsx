import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Users } from 'lucide-react';
import { useState } from 'react';
import { errorMessage, http } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, Dialog, EmptyState, PageHeader, PageLoader, useToast } from '@/ui';
import { candidateKeys, usePrivacy, type Privacy } from './api';

type Share = Privacy['shares'][number];
interface ShareRequest {
  id: string;
  org_name: string;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
  decided_at: string | null;
}

function TalentPoolCard({ pool }: { pool: Privacy['talent_pool'] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const update = useMutation({
    mutationFn: () => http.put<{ listed: boolean }>('/candidate/talent-pool', { listed: true }),
    onSuccess: () => {
      toast.success('You joined the talent pool');
      setConfirm(false);
      setAgreed(false);
      void qc.invalidateQueries({ queryKey: candidateKeys.privacy });
    },
  });

  return (
    <Card>
      <CardHeader
        title="Talent pool"
        description={pool.all_results ? 'While Lokus is in testing, employers on Lokus can find every result you submit, including invited ones.' : 'Employers on Lokus can find the result of the simulation you took on your own.'}
        action={pool.listed ? <Badge tone="success" dot>Listed</Badge> : <Badge>Not listed</Badge>}
      />
      <CardBody className="flex flex-col gap-4 text-sm text-ink-2">
        {!pool.eligible ? (
          <p className="text-muted">
            {pool.all_results ? 'Your result appears in the talent pool once you submit a simulation.' : 'The talent pool is for results from a simulation you start yourself. Results from an employer’s invitation are shared only with that employer.'}
          </p>
        ) : pool.listed ? (
          <p>Employers can see your result report, your name, headline, location and email address. Sharing with employers is part of the Lokus terms you agreed to when you created your account.</p>
        ) : (
          <>
            <p>Your account was created before sharing with employers became part of the terms, so your self-started result is private. Join the pool so employers can find you.</p>
            <Button className="w-fit" onClick={() => setConfirm(true)}>
              <Users /> Join the talent pool
            </Button>
          </>
        )}
      </CardBody>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Join the talent pool"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => update.mutate()} disabled={!agreed} loading={update.isPending}>
              Join
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 text-sm text-ink-2">
          {update.error && <Alert tone="danger">{errorMessage(update.error)}</Alert>}
          <p>Employers using Lokus will be able to find you and see:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>the result report for the simulation you took on your own</li>
            <li>your name, headline and location</li>
            <li>your email address, so they can contact you</li>
          </ul>
          <p>Lokus records your choice. Once you join, your listing stays in place while you hold an account.</p>
          <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} label="I agree to share my self-started result with employers on Lokus." description={`Consent text version ${pool.consent_version}`} />
        </div>
      </Dialog>
    </Card>
  );
}

function SharesCard({ shares }: { shares: Share[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [revoking, setRevoking] = useState<Share | null>(null);
  const revoke = useMutation({
    mutationFn: (id: string) => http.post(`/candidate/shares/${id}/revoke`),
    onSuccess: () => {
      toast.success('Access removed');
      setRevoking(null);
      void qc.invalidateQueries({ queryKey: candidateKeys.privacy });
    },
  });
  return (
    <Card>
      <CardHeader title="Employers with access" description="Who can see a result of yours, and why." />
      {shares.length === 0 ? (
        <EmptyState icon={<Briefcase />} title="No employer has access">
          When you accept an invitation or approve a request, it appears here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {shares.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-ink">{s.org_name}</p>
                <p className="text-sm text-muted">
                  {s.basis === 'invite' ? 'Invited you' : 'You approved their request'} · since {formatDate(s.granted_at)}
                </p>
              </div>
              {s.revoked_at ? (
                <Badge>Removed {formatDate(s.revoked_at)}</Badge>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setRevoking(s)}>
                  Remove access
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Remove ${revoking?.org_name ?? ''}’s access?`}
        description="They will no longer be able to see your result. This cannot be undone from your side."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={revoke.isPending} onClick={() => revoking && revoke.mutate(revoking.id)}>
              Remove access
            </Button>
          </>
        }
      >
        {revoke.error && <Alert tone="danger">{errorMessage(revoke.error)}</Alert>}
      </Dialog>
    </Card>
  );
}

function RequestsCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const requests = useQuery({ queryKey: ['candidate', 'share-requests'], queryFn: () => http.get<{ share_requests: ShareRequest[] }>('/candidate/share-requests') });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => http.post(`/candidate/share-requests/${id}/${approve ? 'approve' : 'decline'}`),
    onSuccess: (_d, v) => {
      toast.success(v.approve ? 'Result shared' : 'Request declined');
      void qc.invalidateQueries({ queryKey: ['candidate'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const rows = requests.data?.share_requests ?? [];
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader title="Requests to see your result" description="Employers who invited you after you had already taken the simulation." />
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">{r.org_name}</p>
              <p className="text-sm text-muted">Requested {formatDate(r.created_at)}</p>
            </div>
            {r.status === 'pending' ? (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: false })}>
                  Decline
                </Button>
                <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: true })}>
                  Share my result
                </Button>
              </div>
            ) : (
              <Badge tone={r.status === 'approved' ? 'success' : 'neutral'}>
                {r.status === 'approved' ? 'Shared' : 'Declined'} {formatDate(r.decided_at)}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PrivacySharing() {
  const privacy = usePrivacy();
  if (privacy.isLoading) return <PageLoader />;
  if (privacy.error || !privacy.data) return <Alert tone="danger">{errorMessage(privacy.error)}</Alert>;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Candidate" title="Privacy & sharing" description="Who can see your results, and why. Results you take on your own are shared with employers on Lokus under the terms you agreed to." />
      <TalentPoolCard pool={privacy.data.talent_pool} />
      <RequestsCard />
      <SharesCard shares={privacy.data.shares} />
    </div>
  );
}
