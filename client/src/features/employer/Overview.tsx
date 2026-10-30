import { ArrowRight, CalendarClock, CircleCheck, ClipboardCheck, Hourglass, Mail, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { dueLabel } from '@/lib/format';
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, PageLoader, StatTile } from '@/ui';
import { Stagger, StaggerItem } from '@/ui/motion';
import { BarList } from '@/features/results/Charts';
import { OUTCOME_META, OUTCOME_ORDER, OutcomeBadge } from '@/features/results/Outcome';
import { useEmployerOverview } from './api';

export function EmployerOverview() {
  const { data: me } = useMe();
  const q = useEmployerOverview();
  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const o = q.data;
  const total = OUTCOME_ORDER.reduce((s, k) => s + (o.outcomes[k] ?? 0), 0);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={me?.org?.name}
        title="Overview"
        description="Where your candidates are, and how they did."
        actions={
          <Button asChild>
            <Link to="/org/invites">
              <Plus /> Invite candidates
            </Link>
          </Button>
        }
      />
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StaggerItem>
          <StatTile label="Invited" value={o.invited} hint="Not yet accepted" icon={<Mail />} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="In progress" value={o.in_progress} hint="Accepted, not submitted" icon={<Hourglass />} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Completed" value={o.completed} hint="Both workdays submitted" icon={<CircleCheck />} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Awaiting review" value={o.awaiting_review} hint="Assessors rating written work" icon={<ClipboardCheck />} />
        </StaggerItem>
        <StaggerItem className="col-span-2 lg:col-span-1">
          <StatTile label="Meets-bar rate" value={o.meets_rate === null ? '—' : `${o.meets_rate}%`} hint="Of final results" />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Outcomes" description={total ? `${total} candidate${total === 1 ? '' : 's'} with a result` : 'No results yet'} />
          <CardBody>
            {total === 0 ? (
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

      <Card>
        <CardHeader
          title="Latest results"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/org/candidates">
                All candidates <ArrowRight />
              </Link>
            </Button>
          }
        />
        {o.recent.length ? (
          <ul className="divide-y divide-line">
            {o.recent.map((c) => (
              <li key={c.invitation_id}>
                <Link to={c.attempt_id ? `/org/results/${c.attempt_id}` : '/org/candidates'} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-subtle/70">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                    <p className="truncate text-xs text-muted">{c.result?.scores_final ? `Workday 1 ${c.result.t1} · Workday 2 ${c.result.t2}` : 'Scores after review'}</p>
                  </div>
                  <OutcomeBadge outcome={c.result?.outcome ?? null} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No results yet" className="py-8" />
        )}
      </Card>
    </div>
  );
}
