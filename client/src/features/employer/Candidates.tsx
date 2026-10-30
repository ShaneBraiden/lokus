import { useQuery } from '@tanstack/react-query';
import { Download, GitCompare, Search, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { errorMessage, http } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Alert, Badge, Button, Card, CardBody, EmptyState, Input, PageHeader, PageLoader, Select, Table, TD, TH, THead, TR, Tooltip } from '@/ui';
import { CompetencyBars, GateFlags, ScoreMeter } from '@/features/results/Charts';
import { OUTCOME_META, OUTCOME_ORDER, OutcomeBadge } from '@/features/results/Outcome';
import { GATE_LABELS, type GateId } from '@lokus/shared';
import { useCandidates, type EmployerResult } from './api';

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

export function Candidates() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(params.get('query') ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const filters = Object.fromEntries([...params.entries()].filter(([k, v]) => v && ['query', 'progress', 'outcome'].includes(k)));
  const list = useCandidates(filters);
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Employer"
        title="Candidates"
        description="Everyone you have invited, with their progress and result."
        actions={
          <>
            <Button variant="secondary" disabled={selected.length < 2} onClick={() => navigate(`/org/compare?ids=${selected.join(',')}`)}>
              <GitCompare /> Compare{selected.length ? ` (${selected.length})` : ''}
            </Button>
            <Button asChild variant="secondary">
              <a href="/api/org/candidates.csv" download>
                <Download /> Export CSV
              </a>
            </Button>
          </>
        }
      />
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          set('query', query.trim());
        }}
      >
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input aria-label="Search candidates" placeholder="Name or email" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select aria-label="Progress" className="w-44" value={params.get('progress') ?? ''} onChange={(e) => set('progress', e.target.value)}>
          <option value="">Any progress</option>
          {PROGRESS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select aria-label="Outcome" className="w-52" value={params.get('outcome') ?? ''} onChange={(e) => set('outcome', e.target.value)}>
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
                <TH>Progress</TH>
                <TH>Outcome</TH>
                <TH numeric>Workday 1</TH>
                <TH numeric>Workday 2</TH>
                <TH>Flags</TH>
                <TH>Invited</TH>
              </tr>
            </THead>
            <tbody>
              {list.data.map((c) => (
                <TR key={c.invitation_id} interactive={Boolean(c.attempt_id && c.result)} onClick={() => c.attempt_id && c.result && navigate(`/org/results/${c.attempt_id}`)}>
                  <TD onClick={(e) => e.stopPropagation()}>
                    {c.attempt_id && c.result && <input type="checkbox" aria-label={`Compare ${c.name}`} className="size-4 accent-accent" checked={selected.includes(c.attempt_id)} onChange={() => toggle(c.attempt_id!)} />}
                  </TD>
                  <TD>
                    <span className="block font-medium text-ink">{c.name}</span>
                    <span className="block text-xs text-muted">
                      {c.email}
                      {c.source !== 'Invitation' && ` · ${c.source}`}
                    </span>
                  </TD>
                  <TD>{c.progress_label}</TD>
                  <TD>{c.result ? <OutcomeBadge outcome={c.result.outcome} /> : <span className="text-muted">—</span>}</TD>
                  <TD numeric>{c.result?.t1 ?? '—'}</TD>
                  <TD numeric>{c.result?.t2 ?? '—'}</TD>
                  <TD>{c.result ? <Flags flags={c.result.flags} /> : <span className="text-muted">—</span>}</TD>
                  <TD className="whitespace-nowrap">{formatDate(c.invited_at)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <p className="text-xs text-muted">Select two to four candidates with a result to compare them side by side. Scores appear once trained assessors have reviewed the written work.</p>
    </div>
  );
}

interface CompareRow {
  attempt_id: string;
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
              <Button asChild>
                <Link to="/org/candidates">Go to candidates</Link>
              </Button>
            }
          >
            Tick two to four candidates with a result on the Candidates page.
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
                  <Link to={`/org/results/${c.attempt_id}`} className="font-semibold text-ink hover:text-accent">
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
