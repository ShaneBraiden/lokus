import { ArrowRight, CalendarClock, Plus } from 'lucide-react';
import { Link } from 'react-router';
import croOffice from '@/assets/sim/cro-office.webp';
import deskBokeh from '@/assets/sim/desk-bokeh.webp';
import office from '@/assets/sim/office.webp';
import { errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { dueLabel, firstName, formatDate } from '@/lib/format';
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, EmptyState, PageLoader } from '@/ui';
import { EASE_OUT, m, Stagger, StaggerItem } from '@/ui/motion';
import { BarList } from '@/features/results/Charts';
import { OUTCOME_META, OUTCOME_ORDER, OutcomeBadge } from '@/features/results/Outcome';
import { useEmployerOverview } from './api';
import { Eyebrow, FlowStepper, SIMULATION } from './Flow';

const greeting = (h = new Date().getHours()) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

function Stat({ value, label, dot }: { value: number; label: string; dot?: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xl font-semibold leading-none text-ink tabular">
        {dot && <span className="size-1.5 rounded-full" style={{ backgroundColor: dot }} aria-hidden />}
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

/** Step 1 of the employer flow: the simulation at a glance, what needs attention, and recent results. */
export function EmployerOverview() {
  const { data: me } = useMe();
  const q = useEmployerOverview();
  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const o = q.data;
  const total = o.invited + o.in_progress + o.completed;
  const completedPct = total ? Math.round((o.completed / total) * 100) : 0;
  const results = OUTCOME_ORDER.reduce((s, k) => s + (o.outcomes[k] ?? 0), 0);
  const firstResult = o.recent.find((c) => c.attempt_id)?.attempt_id;

  return (
    <div className="flex flex-col gap-8">
      <FlowStepper current={1} candidateTo={firstResult ? `/org/results/${firstResult}` : null} />

      <section aria-labelledby="overview-title" className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <div>
          <Eyebrow>
            {greeting()}
            {me ? `, ${firstName(me.user.name)}` : ''}
          </Eyebrow>
          <h1 id="overview-title" className="mt-3 max-w-xl font-serif text-[34px] leading-[1.12] tracking-[-0.02em] text-ink sm:text-[42px]">
            See how your simulation is building a job-ready talent pipeline.
          </h1>
          <p className="mt-3 text-sm text-muted">
            {me?.org?.name ? `${me.org.name} · ` : ''}Real-world simulations for clinical research. Clearer insights, stronger hires.
          </p>
        </div>
        <div className="relative h-48 overflow-hidden rounded-2xl shadow-card sm:h-60">
          <img src={office} alt="" className="size-full object-cover saturate-[0.92]" />
          <div className="absolute inset-0 bg-gradient-to-r from-canvas/60 via-transparent to-transparent" aria-hidden />
        </div>
      </section>

      <section aria-labelledby="sims-title" className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <h2 id="sims-title" className="font-serif text-[22px] tracking-tight text-ink">
            Active simulations
          </h2>
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-subtle text-[11px] font-semibold text-ink-2">1</span>
        </div>
        <Link
          to="/org/candidates"
          className="group grid gap-5 rounded-xl border border-line bg-surface p-4 shadow-card transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-pop md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-center"
        >
          <img src={croOffice} alt="" className="hidden h-28 w-full rounded-lg object-cover md:block" />
          <div className="min-w-0">
            <Badge tone="success">Active</Badge>
            <p className="mt-1.5 font-serif text-xl text-ink">{SIMULATION.title}</p>
            <p className="text-xs text-faint">
              {SIMULATION.product} · {SIMULATION.meta}
            </p>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">{SIMULATION.description}</p>
          </div>
          <div className="flex items-center gap-5 border-line md:border-l md:pl-6">
            <div className="min-w-56">
              <div className="grid grid-cols-4 gap-4">
                <Stat value={total} label="Total" />
                <Stat value={o.completed} label="Completed" dot="var(--color-success)" />
                <Stat value={o.awaiting_review} label="In review" dot="var(--color-warning)" />
                <Stat value={o.in_progress} label="In progress" dot="var(--color-faint)" />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 rounded-full bg-subtle" role="img" aria-label={`${completedPct}% completed`}>
                  <m.div className="h-full rounded-full bg-success" initial={{ width: 0 }} animate={{ width: `${completedPct}%` }} transition={{ duration: 0.9, ease: EASE_OUT }} />
                </div>
                <span className="text-xs font-medium text-ink-2 tabular">{completedPct}% completed</span>
              </div>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent transition-transform group-hover:translate-x-0.5 [&_svg]:size-4">
              <ArrowRight />
            </span>
          </div>
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Outcomes" description={results ? `${results} candidate${results === 1 ? '' : 's'} with a result` : 'No results yet'} />
          <CardBody>
            {results === 0 ? (
              <EmptyState title="No results yet" className="py-6">
                Results appear here as candidates submit.
              </EmptyState>
            ) : (
              <BarList
                label="Outcome counts"
                max={Math.max(...OUTCOME_ORDER.map((k) => o.outcomes[k] ?? 0))}
                data={OUTCOME_ORDER.map((k) => ({ key: k, text: OUTCOME_META[k].label, label: <OutcomeBadge outcome={k} />, value: o.outcomes[k] ?? 0, display: `${o.outcomes[k] ?? 0}`, color: OUTCOME_META[k].color, note: OUTCOME_META[k].meaning }))}
              />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Due within 7 days" description="Candidates who have not submitted yet." />
          {o.due_soon.length ? (
            <ul className="divide-y divide-line">
              {o.due_soon.map((d) => (
                <li key={d.invitation_id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{d.name}</p>
                    <p className="truncate text-xs text-muted">{d.progress_label}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-warning">
                    <CalendarClock className="size-3.5" /> {dueLabel(d.deadline_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing due soon" className="py-8" />
          )}
        </Card>
      </div>

      <section className="grid overflow-hidden rounded-2xl border border-line bg-accent-soft/60 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="flex flex-col items-start gap-3 p-6 sm:p-8">
          <Eyebrow>Expand your hiring pipeline</Eyebrow>
          <h2 className="font-serif text-[26px] tracking-tight text-ink">Invite candidates</h2>
          <p className="max-w-md text-sm text-muted">Send the simulation to anyone by email. They get two proctored workdays; you get an evidence-backed result once assessors have reviewed the written work.</p>
          <Button asChild className="mt-2">
            <Link to="/org/invites">
              <Plus /> Invite candidates
            </Link>
          </Button>
        </div>
        <img src={deskBokeh} alt="" className="hidden size-full object-cover md:block" />
      </section>

      <section aria-labelledby="recent-title" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-title" className="font-serif text-[22px] tracking-tight text-ink">
            Latest results
          </h2>
          <Link to="/org/candidates" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
            View all in pipeline <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {o.recent.length ? (
          <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {o.recent.map((c) => (
              <StaggerItem key={c.invitation_id}>
                <Link to={c.attempt_id ? `/org/results/${c.attempt_id}` : '/org/candidates'} className="flex h-full items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-pop">
                  <Avatar name={c.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                    <p className="truncate text-xs text-muted">{c.result?.scores_final ? `Workday 1 ${c.result.t1} · Workday 2 ${c.result.t2}` : 'Scores after review'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <OutcomeBadge outcome={c.result?.outcome ?? null} />
                      <span className="text-[11px] text-faint">{formatDate(c.submitted_at)}</span>
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <Card>
            <EmptyState title="No results yet" className="py-8">
              Results appear here as candidates submit.
            </EmptyState>
          </Card>
        )}
      </section>
    </div>
  );
}
