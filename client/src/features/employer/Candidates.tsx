import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronRight, Clock, Download, GitCompare, Plus, Search, Target, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import croOffice from '@/assets/sim/cro-office.webp';
import { errorMessage, http } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Alert, Avatar, Badge, Button, Card, CardBody, EmptyState, Input, PageHeader, PageLoader, Select, Table, TD, TH, THead, TR, Tooltip, type BadgeTone } from '@/ui';
import { EASE_OUT, m } from '@/ui/motion';
import { CompetencyBars, GateFlags, ScoreMeter } from '@/features/results/Charts';
import { OUTCOME_META, OUTCOME_ORDER, OutcomeBadge } from '@/features/results/Outcome';
import { GATE_LABELS, type GateId } from '@lokus/shared';
import { useCandidates, useEmployerOverview, type CandidateRow, type EmployerResult } from './api';
import { Breadcrumbs, DecisionBadge, Eyebrow, FlowStepper, SIMULATION } from './Flow';

const PROGRESS = [
  ['invited', 'Invited'],
  ['not_started', 'Not started'],
  ['in_progress', 'In progress'],
  ['submitted', 'Submitted'],
  ['closed', 'Closed'],
  ['withdrawn', 'Withdrawn'],
];

function Flags({ flags }: { flags: string[] }) {
  if (!flags.length) return <span className="text-xs text-muted">None</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <Tooltip key={f} content={GATE_LABELS[f as GateId]}>
          <span tabIndex={0}>
            <Badge tone={f === 'GR' ? 'violet' : 'danger'}>{f}</Badge>
          </span>
        </Tooltip>
      ))}
    </span>
  );
}

const PROGRESS_TONE: Record<CandidateRow['progress'], BadgeTone> = {
  invited: 'neutral',
  not_started: 'neutral',
  in_progress: 'info',
  submitted: 'success',
  closed: 'warning',
  withdrawn: 'neutral',
};

/** Step 2 of the employer flow: the simulation's candidate pipeline, with what needs attention alongside. */
export function Candidates() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(params.get('query') ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const filters = Object.fromEntries([...params.entries()].filter(([k, v]) => v && ['query', 'progress', 'outcome'].includes(k)));
  const list = useCandidates(filters);
  const overview = useEmployerOverview();
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));
  const o = overview.data;
  const total = o ? o.invited + o.in_progress + o.completed : 0;
  const completedPct = o && total ? Math.round((o.completed / total) * 100) : 0;
  const firstResult = list.data?.find((c) => c.attempt_id && c.result)?.attempt_id ?? o?.recent.find((c) => c.attempt_id)?.attempt_id;

  return (
    <div className="flex flex-col gap-6">
      <FlowStepper current={2} candidateTo={firstResult ? `/org/results/${firstResult}` : null} />
      <Breadcrumbs items={[{ label: 'Overview', to: '/org' }, { label: SIMULATION.title }]} />

      <section className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-[32px] leading-tight tracking-tight text-ink sm:text-[38px]">{SIMULATION.title}</h1>
            <Badge tone="success">Active</Badge>
          </div>
          <p className="mt-1 text-xs text-faint">
            {SIMULATION.product} · {SIMULATION.meta}
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{SIMULATION.description}</p>
        </div>
        <div className="relative h-36 overflow-hidden rounded-xl shadow-card">
          <img src={croOffice} alt="" className="size-full object-cover" />
          <div className="absolute right-3 top-3 flex gap-2">
            <Button asChild size="sm" variant="secondary" className="bg-surface/90 backdrop-blur">
              <a href="/api/org/candidates.csv" download aria-label="Export CSV">
                <Download />
              </a>
            </Button>
            <Button asChild size="sm">
              <Link to="/org/invites">
                Invite candidates <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {o && (
        <>
          <Card className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
            {[
              { v: total, l: 'Invited' },
              { v: o.completed, l: 'Completed', dot: 'var(--color-success)' },
              { v: o.awaiting_review, l: 'Awaiting review', dot: 'var(--color-warning)' },
              { v: o.in_progress, l: 'In progress' },
            ].map((s) => (
              <div key={s.l} className="px-5 py-4">
                <p className="flex items-center gap-1.5 text-2xl font-semibold text-ink tabular">
                  {s.dot && <span className="size-1.5 rounded-full" style={{ backgroundColor: s.dot }} aria-hidden />}
                  {s.v}
                </p>
                <p className="text-xs text-muted">{s.l}</p>
              </div>
            ))}
          </Card>
          <Card>
            <CardBody className="flex items-end gap-6">
              <div className="flex-1">
                <p className="mb-3 text-xs font-medium text-muted">Candidate progress</p>
                <div className="h-2 rounded-full bg-subtle" role="img" aria-label={`${completedPct}% completed`}>
                  <m.div className="h-full rounded-full bg-success" initial={{ width: 0 }} animate={{ width: `${completedPct}%` }} transition={{ duration: 0.9, ease: EASE_OUT }} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-ink tabular">{completedPct}%</p>
                <p className="text-xs text-muted">
                  {o.completed} of {total} completed
                </p>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-[22px] tracking-tight text-ink">Candidates</h2>
            <Button variant="secondary" size="sm" disabled={selected.length < 2} onClick={() => navigate(`/org/compare?ids=${selected.join(',')}`)}>
              <GitCompare /> Compare{selected.length ? ` (${selected.length})` : ''}
            </Button>
          </div>
          <form
            className="flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              set('query', query.trim());
            }}
          >
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input aria-label="Search candidates" placeholder="Search by name or email" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Select aria-label="Progress" className="w-40" value={params.get('progress') ?? ''} onChange={(e) => set('progress', e.target.value)}>
              <option value="">Any progress</option>
              {PROGRESS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            <Select aria-label="Outcome" className="w-48" value={params.get('outcome') ?? ''} onChange={(e) => set('outcome', e.target.value)}>
              <option value="">Any outcome</option>
              {OUTCOME_ORDER.map((k) => (
                <option key={k} value={k}>
                  {OUTCOME_META[k].label}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
          <Card className={list.isFetching && list.data ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            {list.isLoading ? (
              <PageLoader />
            ) : list.error ? (
              <CardBody>
                <Alert tone="danger">{errorMessage(list.error)}</Alert>
              </CardBody>
            ) : !list.data?.length ? (
              <EmptyState
                icon={<UsersRound />}
                title={Object.keys(filters).length ? 'No candidates match' : 'No candidates yet'}
                action={
                  !Object.keys(filters).length && (
                    <Button asChild>
                      <Link to="/org/invites">Invite candidates</Link>
                    </Button>
                  )
                }
              >
                {Object.keys(filters).length ? 'Try different filters.' : 'Invite candidates by email to get started.'}
              </EmptyState>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH className="w-10">
                      <span className="sr-only">Select to compare</span>
                    </TH>
                    <TH>Candidate</TH>
                    <TH>Status</TH>
                    <TH>Outcome</TH>
                    <TH numeric>Workday 1</TH>
                    <TH numeric>Workday 2</TH>
                    <TH>Flags</TH>
                    <TH>Decision</TH>
                    <TH>Completed</TH>
                    <TH className="w-8">
                      <span className="sr-only">Open</span>
                    </TH>
                  </tr>
                </THead>
                <tbody>
                  {list.data.map((c) => {
                    const open = Boolean(c.attempt_id && c.result);
                    return (
                      <TR key={c.invitation_id} interactive={open} onClick={() => open && navigate(`/org/results/${c.attempt_id}`)}>
                        <TD onClick={(e) => e.stopPropagation()}>
                          {open && <input type="checkbox" aria-label={`Compare ${c.name}`} className="size-4 accent-accent" checked={selected.includes(c.attempt_id!)} onChange={() => toggle(c.attempt_id!)} />}
                        </TD>
                        <TD>
                          <span className="flex items-center gap-3">
                            <Avatar name={c.name} size="sm" />
                            <span className="min-w-0">
                              <span className="block font-medium text-ink">{c.name}</span>
                              <span className="block text-xs text-muted">
                                {c.email}
                                {c.source !== 'Invitation' && ` · ${c.source}`}
                              </span>
                            </span>
                          </span>
                        </TD>
                        <TD>
                          <Badge tone={PROGRESS_TONE[c.progress]}>{c.progress_label}</Badge>
                        </TD>
                        <TD>{c.result ? <OutcomeBadge outcome={c.result.outcome} /> : <span className="text-muted">—</span>}</TD>
                        <TD numeric>{c.result?.t1 ?? '—'}</TD>
                        <TD numeric>{c.result?.t2 ?? '—'}</TD>
                        <TD>{c.result ? <Flags flags={c.result.flags} /> : <span className="text-muted">—</span>}</TD>
                        <TD>{c.decision ? <DecisionBadge decision={c.decision.decision} /> : <span className="text-muted">—</span>}</TD>
                        <TD className="whitespace-nowrap">{c.submitted_at ? formatDate(c.submitted_at) : <span className="text-muted">—</span>}</TD>
                        <TD>{open && <ChevronRight className="size-4 text-faint" aria-hidden />}</TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
          <p className="text-xs text-muted">Select two to four candidates with a result to compare them side by side. Scores appear once trained assessors have reviewed the written work.</p>
        </div>

        <aside className="flex flex-col gap-4">
          {o && o.awaiting_review > 0 && (
            <div className="rounded-xl border border-accent-line bg-accent-soft/70 p-5">
              <p className="flex items-center gap-2 text-xs font-semibold text-accent">
                <Clock className="size-3.5" /> Needs your attention
              </p>
              <p className="mt-2 font-serif text-[26px] leading-tight text-ink">
                {o.awaiting_review} candidate{o.awaiting_review === 1 ? '' : 's'}
              </p>
              <p className="font-serif text-lg text-ink-2">awaiting review</p>
              <p className="mt-2 text-[13px] text-muted">Submitted and with assessors now. Provisional outcomes are shown until the written work is rated.</p>
              <Button className="mt-4 w-full" onClick={() => set('outcome', 'AWAITING_REVIEW')}>
                Show these candidates <ArrowRight />
              </Button>
            </div>
          )}
          <Card>
            <CardBody>
              <h2 className="font-serif text-lg text-ink">Assessment details</h2>
              <dl className="mt-3 flex flex-col gap-2.5 text-[13px]">
                {[
                  ['Simulation', `${SIMULATION.product} · ${SIMULATION.title}`],
                  ['Format', 'Two workdays, proctored'],
                  ['Rubric', 'Rubric v1.1'],
                  ['Scoring', 'Engine + blind assessor review'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <h2 className="flex items-center gap-2 font-serif text-lg text-ink">
                <Target className="size-4 text-accent" /> Assessment goal
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{SIMULATION.goal}</p>
            </CardBody>
          </Card>
          <Link to="/org/invites" className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line-strong p-4 text-sm font-medium text-ink-2 hover:border-accent hover:text-accent">
            <span>
              <Eyebrow className="mb-0.5">Invitations</Eyebrow>
              Invite more candidates
            </span>
            <Plus className="size-4" />
          </Link>
        </aside>
      </div>
    </div>
  );
}

interface CompareRow {
  attempt_id: string;
  talent_pool: boolean;
  name: string;
  status_label: string;
  result: EmployerResult | null;
}

export function EmployerCompare() {
  const [params] = useSearchParams();
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
  const q = useQuery({ queryKey: ['org', 'compare', ids.join(',')], queryFn: () => http.get<{ candidates: CompareRow[] }>(`/org/compare?ids=${ids.join(',')}`).then((r) => r.candidates), enabled: ids.length >= 2, retry: false });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Employer" title="Compare candidates" description="Outcome, workday scores, critical flags and competencies, side by side." />
      {ids.length < 2 ? (
        <Card>
          <EmptyState
            icon={<GitCompare />}
            title="Choose candidates to compare"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link to="/org/candidates">Go to candidates</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/org/talent-pool">Go to the talent pool</Link>
                </Button>
              </div>
            }
          >
            Tick two to four candidates with a result on the Candidates or Talent pool page.
          </EmptyState>
        </Card>
      ) : q.isLoading ? (
        <PageLoader />
      ) : q.error || !q.data ? (
        <Alert tone="danger">{errorMessage(q.error)}</Alert>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${q.data.length}, minmax(240px, 1fr))` }}>
          {q.data.map((c) => (
            <Card key={c.attempt_id} className="min-w-0">
              <CardBody className="flex flex-col gap-4">
                <div>
                  <Link to={c.talent_pool ? `/org/talent-pool/${c.attempt_id}` : `/org/results/${c.attempt_id}`} className="font-semibold text-ink hover:text-accent">
                    {c.name}
                  </Link>
                  <div className="mt-1.5">
                    <OutcomeBadge outcome={c.result?.outcome ?? null} />
                  </div>
                </div>
                {c.result ? (
                  <>
                    <ScoreMeter label="Workday 1" score={c.result.t1} pending={!c.result.scores_final} />
                    <ScoreMeter label="Workday 2" score={c.result.t2} pending={!c.result.scores_final} />
                    <GateFlags gates={c.result.gates.map((g) => ({ gate_id: g.gate_id, fired: g.fired, resolved: !g.held }))} />
                    <CompetencyBars competencies={c.result.competencies} />
                  </>
                ) : (
                  <p className="text-sm text-muted">{c.status_label}</p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
        </div>
      )}
    </div>
  );
}
