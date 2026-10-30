import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CalendarClock, CircleCheck, Coffee, Inbox, Laptop, Lock, Save, ScanSearch, Timer } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { AttemptStateDTO } from '@lokus/shared';
import { errorMessage, http } from '@/lib/api';
import { dueLabel, formatDate, formatDateTime } from '@/lib/format';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, PageHeader, PageLoader } from '@/ui';
import { STATUS_TONE } from './CandidateHome';

function Fact({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted [&_svg]:size-4">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{children}</p>
      </div>
    </div>
  );
}

function useWideScreen() {
  const [wide, setWide] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return wide;
}

/** Pre-start page (expectations and a readiness check) and, after submission, the completion confirmation. No scores. */
export function AssessmentDetail() {
  const { attemptId } = useParams();
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const wide = useWideScreen();
  const state = useQuery({ queryKey: ['attempt', attemptId, 'summary'], queryFn: () => http.get<AttemptStateDTO>(`/attempts/${attemptId}/state`), retry: false });

  if (state.isLoading) return <PageLoader />;
  if (state.error || !state.data) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="danger">{errorMessage(state.error)}</Alert>
        <Link to="/app" className="text-sm font-semibold text-accent hover:underline">
          Back to your assessments
        </Link>
      </div>
    );
  }
  const { attempt } = state.data;
  const due = attempt.phase !== 'done' && attempt.phase !== 'closed' ? dueLabel(attempt.deadline_at) : null;

  return (
    <div className="flex flex-col gap-6">
      <Link to="/app" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Assessments
      </Link>
      <PageHeader
        eyebrow={attempt.org_name ? `Invited by ${attempt.org_name}` : 'Talent pool route'}
        title={attempt.simulation_title}
        description={attempt.org_name ? `${attempt.org_name} receives your result when you finish.` : 'Your result stays private unless you choose to join the talent pool.'}
        actions={<Badge tone={STATUS_TONE[attempt.status]}>{attempt.status_label}</Badge>}
      />

      {attempt.phase === 'done' && (
        <Card>
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <CircleCheck className="size-6" />
            </div>
            <div className="flex flex-col gap-2 text-sm text-ink-2">
              <p className="text-base font-semibold text-ink">Submitted {formatDateTime(attempt.t2_submitted_at)}</p>
              <p>Thank you for completing the simulation. Parts of your work are reviewed by trained Lokus assessors, which usually takes a few working days.</p>
              <p>{attempt.org_name ? `${attempt.org_name} will see your result and contact you about next steps.` : 'Your result is private. If you would like employers to find it, join the talent pool from Privacy & sharing.'} Candidates do not see scores.</p>
              {!attempt.org_name && (
                <Button asChild variant="secondary" className="mt-2 w-fit">
                  <Link to="/app/privacy">Privacy &amp; sharing</Link>
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {attempt.phase === 'closed' && (
        <Alert tone="warning" title="This assessment is closed">
          {attempt.close_reason === 'expired' ? 'The deadline passed before the assessment was finished.' : 'Lokus closed this assessment.'} If you think this is a mistake, contact the employer who invited you or hello@lokus.example.
        </Alert>
      )}

      {(attempt.phase === 'workday1' || attempt.phase === 'between' || attempt.phase === 'workday2') && (
        <Card>
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">{attempt.phase === 'between' ? 'Workday 1 is submitted' : 'You are part-way through'}</p>
              <p className="mt-0.5 text-sm text-muted">{attempt.phase === 'between' ? 'Continue to Workday 2 when you are ready.' : 'Your work is saved. Pick up where you left off.'}</p>
            </div>
            <Button asChild size="lg">
              <Link to={`/sim/${attempt.id}`}>
                Continue <ArrowRight />
              </Link>
            </Button>
          </CardBody>
        </Card>
      )}

      {attempt.phase === 'intro' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="What to expect" description="Two short workdays as a Clinical Trial Associate on a fictional study." />
            <CardBody className="flex flex-col gap-5">
              <Fact icon={<ScanSearch />} title="Workday 1 · data review · about 60 minutes">
                Review case report forms for 12 participants against the study documents and record what you find.
              </Fact>
              <Fact icon={<Inbox />} title="Workday 2 · inbox · about 30 minutes">
                Work through a morning&rsquo;s correspondence and keep the study record up to date.
              </Fact>
              <Fact icon={<Coffee />} title="Breaks">
                You can stop between the two workdays and come back later. Workday 1 timing is measured from when you start it.
              </Fact>
              <Fact icon={<Save />} title="Saving">
                Everything you do is saved as you go. You can close the tab and continue from your dashboard.
              </Fact>
              <Fact icon={<Lock />} title="Fair play">
                Work on your own and do not share the content. Your actions in the simulation are recorded to assess your work.
              </Fact>
            </CardBody>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title="Before you start" />
              <CardBody className="flex flex-col gap-4">
                {attempt.deadline_at && (
                  <p className="flex items-center gap-2 text-sm text-ink-2">
                    <CalendarClock className="size-4 text-muted" /> Complete by <span className="font-semibold text-ink">{formatDate(attempt.deadline_at)}</span>
                    {due && <span className="text-muted">({due.toLowerCase()})</span>}
                  </p>
                )}
                <p className="flex items-center gap-2 text-sm text-ink-2">
                  <Timer className="size-4 text-muted" /> Set aside about 90 minutes in total.
                </p>
                <p className="flex items-center gap-2 text-sm text-ink-2">
                  <Laptop className="size-4 text-muted" /> Use a laptop or desktop with a reliable connection.
                </p>
                {!wide && <Alert tone="warning">Your screen is narrow. The simulation works best on a screen at least 1024 pixels wide.</Alert>}
                <div className="border-t border-line pt-4">
                  <Checkbox checked={ready} onChange={(e) => setReady(e.target.checked)} label="I’m ready, and I’ll complete the simulation on my own." />
                </div>
                <Button size="lg" disabled={!ready} onClick={() => navigate(`/sim/${attempt.id}`)}>
                  Open the simulation <ArrowRight />
                </Button>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
