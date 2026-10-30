import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Briefcase, CalendarClock, CircleCheck, CirclePlay, Mail, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { errorMessage, http } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { dueLabel, firstName, formatDate } from '@/lib/format';
import { Alert, Badge, Button, Card, CardBody, Checkbox, Dialog, EmptyState, PageHeader, PageLoader, Skeleton, useToast, type BadgeTone } from '@/ui';
import { Stagger, StaggerItem } from '@/ui/motion';
import { candidateKeys, useCandidateHome, type AttemptCard } from './api';

export const STATUS_TONE: Record<string, BadgeTone> = {
  not_started: 'neutral',
  w1_in_progress: 'info',
  w1_submitted: 'info',
  w2_in_progress: 'info',
  submitted: 'success',
  closed: 'warning',
  void: 'neutral',
};

function Steps({ status }: { status: string }) {
  const w1 = ['w1_submitted', 'w2_in_progress', 'submitted'].includes(status);
  const w2 = status === 'submitted';
  const item = (done: boolean, active: boolean, label: string) => (
    <span className={`flex items-center gap-1.5 ${done ? 'text-success' : active ? 'text-ink' : 'text-faint'}`}>
      {done ? <CircleCheck className="size-4" /> : <span className={`size-2 rounded-full ${active ? 'bg-accent' : 'bg-line-strong'}`} />}
      {label}
    </span>
  );
  return (
    <div className="flex items-center gap-4 text-[13px] font-medium">
      {item(w1, status === 'w1_in_progress', 'Workday 1')}
      <span className="h-px w-6 bg-line-strong" />
      {item(w2, status === 'w2_in_progress', 'Workday 2')}
    </div>
  );
}

function AssessmentCard({ a }: { a: AttemptCard }) {
  const inProgress = ['w1_in_progress', 'w1_submitted', 'w2_in_progress'].includes(a.status);
  const due = a.status !== 'submitted' && a.status !== 'closed' ? dueLabel(a.deadline_at) : null;
  return (
    <Card className="flex flex-col gap-5 p-5 transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-pop sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[a.status]}>{a.status_label}</Badge>
          {due && (
            <span className="flex items-center gap-1 text-xs font-medium text-muted">
              <CalendarClock className="size-3.5" /> {due}
            </span>
          )}
        </div>
        <h3 className="mt-2 font-semibold text-ink">{a.simulation_title}</h3>
        <p className="mt-0.5 text-sm text-muted">{a.org_name ? `Invited by ${a.org_name}` : 'Started on your own — talent pool route'}</p>
        <div className="mt-3">
          <Steps status={a.status} />
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {a.status === 'not_started' && (
          <Button asChild>
            <Link to={`/app/assessments/${a.id}`}>
              View and start <ArrowRight />
            </Link>
          </Button>
        )}
        {inProgress && (
          <Button asChild>
            <Link to={`/sim/${a.id}`}>
              Continue <ArrowRight />
            </Link>
          </Button>
        )}
        {a.status === 'submitted' && (
          <Button asChild variant="secondary">
            <Link to={`/app/assessments/${a.id}`}>Submitted {formatDate(a.submitted_at)}</Link>
          </Button>
        )}
        {a.status === 'closed' && <p className="text-sm text-muted">Closed</p>}
      </div>
    </Card>
  );
}

function StartOwnDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [agreed, setAgreed] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const start = useMutation({
    mutationFn: () => http.post<{ attempt_id: string }>('/candidate/attempts', { consent: true }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: candidateKeys.home });
      navigate(`/app/assessments/${r.attempt_id}`);
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Take the simulation on your own"
      description="Your result stays private. You can choose to join the talent pool later so employers can find you."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => start.mutate()} disabled={!agreed} loading={start.isPending}>
            Create my attempt
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-ink-2">
        {start.error && <Alert tone="danger">{errorMessage(start.error)}</Alert>}
        <p>Each candidate can take this simulation version once. Make sure you have about 90 minutes over one or two sittings.</p>
        <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} label="I understand that my actions in the simulation are recorded to assess my work." />
      </div>
    </Dialog>
  );
}

export function CandidateHome() {
  const { data: me } = useMe();
  const home = useCandidateHome();
  const qc = useQueryClient();
  const toast = useToast();
  const location = useLocation();
  const [startOpen, setStartOpen] = useState(false);
  const resend = useMutation({ mutationFn: () => http.post('/auth/resend-verification'), onSuccess: () => toast.success('Verification email sent') });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => http.post(`/candidate/share-requests/${id}/${approve ? 'approve' : 'decline'}`),
    onSuccess: (_d, v) => {
      toast.success(v.approve ? 'Result shared' : 'Request declined');
      void qc.invalidateQueries({ queryKey: candidateKeys.home });
      void qc.invalidateQueries({ queryKey: candidateKeys.privacy });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (home.isLoading || !me) return <PageLoader />;
  if (home.error) return <Alert tone="danger">{errorMessage(home.error)}</Alert>;
  const data = home.data!;
  const hasAttempt = data.attempts.some((a) => a.status !== 'void');
  const welcomeOrg = (location.state as { welcome?: string } | null)?.welcome;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Candidate" title={`Welcome, ${firstName(me.user.name)}`} description="Your work simulations and who can see your results." />

      {welcomeOrg && <Alert tone="success" title={`Invitation from ${welcomeOrg} accepted`}>Your assessment is ready below.</Alert>}

      {!data.email_verified && (
        <Alert
          tone="warning"
          title="Confirm your email address"
          action={
            <Button size="sm" variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>
              <Mail /> Resend link
            </Button>
          }
        >
          We sent a link to {me.user.email}. You need a confirmed email to start a simulation on your own.
        </Alert>
      )}

      {data.share_requests.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">Requests to see your result</h2>
          {data.share_requests.map((r) => (
            <Card key={r.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Briefcase className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-ink">{r.org_name} would like to see your result</p>
                  <p className="text-sm text-muted">You have already taken this simulation. Sharing gives {r.org_name} the same result; it does not start a new attempt.</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" onClick={() => decide.mutate({ id: r.id, approve: false })} disabled={decide.isPending}>
                  Decline
                </Button>
                <Button onClick={() => decide.mutate({ id: r.id, approve: true })} loading={decide.isPending && decide.variables?.id === r.id && decide.variables.approve}>
                  Share my result
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Your assessments</h2>
        </div>
        {home.isFetching && !data ? (
          <Skeleton className="h-32" />
        ) : data.attempts.length ? (
          <Stagger className="flex flex-col gap-3">
            {data.attempts.map((a) => (
              <StaggerItem key={a.id}>
                <AssessmentCard a={a} />
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <Card>
            <EmptyState
              icon={<CirclePlay />}
              title="No assessments yet"
              action={
                <Button onClick={() => setStartOpen(true)} disabled={!data.email_verified}>
                  Start the simulation
                </Button>
              }
            >
              If an employer invited you, open the link in their email. You can also take the Clinical Trial Associate simulation on your own.
            </EmptyState>
          </Card>
        )}
      </section>

      {hasAttempt && (
        <Card>
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted">
                <Users className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-ink">Talent pool</p>
                <p className="text-sm text-muted">Choose whether employers can find a result you earned on your own, and see who has access to your results.</p>
              </div>
            </div>
            <Button asChild variant="secondary">
              <Link to="/app/privacy">Privacy &amp; sharing</Link>
            </Button>
          </CardBody>
        </Card>
      )}
      <StartOwnDialog open={startOpen} onOpenChange={setStartOpen} />
    </div>
  );
}
