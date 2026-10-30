import { ArrowRight, ClipboardCheck, Hourglass, Send, UsersRound } from 'lucide-react';
import { Link } from 'react-router';
import { errorMessage } from '@/lib/api';
import { Alert, Button, Card, CardBody, CardHeader, PageHeader, PageLoader, StatTile } from '@/ui';
import { Stagger, StaggerItem } from '@/ui/motion';
import { BarList } from '@/features/results/Charts';
import { OUTCOME_META, OUTCOME_ORDER, OutcomeBadge } from '@/features/results/Outcome';
import { GATE_LABELS, type GateId } from '@lokus/shared';
import { useOverview } from './api';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function Overview() {
  const q = useOverview();
  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const o = q.data;
  const submitted = o.attempts.submitted ?? 0;
  const inProgress = (o.attempts.w1_in_progress ?? 0) + (o.attempts.w1_submitted ?? 0) + (o.attempts.w2_in_progress ?? 0);
  const outcomeTotal = OUTCOME_ORDER.reduce((s, k) => s + (o.outcomes[k] ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Lokus admin"
        title="Overview"
        description="Assessment activity across every organisation."
        actions={
          <Button asChild>
            <Link to="/admin/review">
              Review queue <ArrowRight />
            </Link>
          </Button>
        }
      />
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StaggerItem>
          <StatTile label="Submitted" value={submitted} hint={`${o.submitted_last_7_days} in the last 7 days`} icon={<Send />} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="In progress" value={inProgress} hint={`${o.attempts.not_started ?? 0} not started`} icon={<Hourglass />} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Awaiting review" value={o.review_queue.open + o.review_queue.in_progress} hint={o.review_queue.oldest_hours === null ? 'Queue is empty' : `Oldest waiting ${o.review_queue.oldest_hours} h`} icon={<ClipboardCheck />} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Candidates" value={o.candidates} hint={plural(o.organizations, 'active organisation')} icon={<UsersRound />} />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Outcomes" description={`Latest result of each submitted attempt (${outcomeTotal}).`} />
          <CardBody>
            {outcomeTotal === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No submitted attempts yet.</p>
            ) : (
              <BarList
                label="Outcome counts"
                max={Math.max(...OUTCOME_ORDER.map((k) => o.outcomes[k] ?? 0))}
                data={OUTCOME_ORDER.map((k) => {
                  const n = o.outcomes[k] ?? 0;
                  return {
                    key: k,
                    text: OUTCOME_META[k].label,
                    label: <OutcomeBadge outcome={k} />,
                    value: n,
                    display: `${n}`,
                    color: OUTCOME_META[k].color,
                    note: `${outcomeTotal ? Math.round((n / outcomeTotal) * 100) : 0}% of submitted attempts`,
                  };
                })}
              />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Critical flags" description="Share of submitted attempts where each gate fired." />
          <CardBody>
            <BarList
              label="Gate fire rates"
              max={100}
              data={o.gate_rates.map((g) => {
                const pct = g.of ? Math.round((g.fired / g.of) * 100) : 0;
                return { key: g.gate, text: `${g.gate} ${GATE_LABELS[g.gate as GateId]}`, label: <span><span className="mr-1.5 font-mono text-[11px] text-faint">{g.gate}</span>{GATE_LABELS[g.gate as GateId]}</span>, value: pct, display: `${pct}%`, note: `${g.fired} of ${g.of} attempts` };
              })}
            />
          </CardBody>
        </Card>
      </div>
      <p className="text-xs text-muted">
        Environment: {o.environment.env} · database: {o.environment.database}
      </p>
    </div>
  );
}
