import { ArrowLeft, Download, GitCompare, Hourglass, Mail, MapPin, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, PageHeader, PageLoader } from '@/ui';
import { Stagger, StaggerItem } from '@/ui/motion';
import { CompetencyBars, GateFlags, ScoreMeter } from '@/features/results/Charts';
import { EvidencePanel, type EvidenceTarget } from '@/features/results/EvidencePanel';
import { OutcomeBadge, OutcomeBanner } from '@/features/results/Outcome';
import { usePool, useReport, type LockdownIntegrity } from './api';

const VIOLATION_LABELS: Record<string, string> = {
  tab_hidden: 'Switched tab or app',
  window_blur: 'Left the assessment window',
  fullscreen_exit: 'Exited fullscreen',
  devtools: 'Opened developer tools',
  multiple_screens: 'Second screen connected',
  second_tab: 'Opened in a second tab',
  screen_capture: 'Screen capture attempted',
  copy: 'Copy blocked',
  cut: 'Cut blocked',
  paste: 'Paste blocked',
  context_menu: 'Right-click blocked',
  shortcut: 'Shortcut blocked',
  print: 'Print blocked',
  drop: 'Drag and drop blocked',
  injected_text: 'Inserted text reverted (paste tool or extension)',
};

function IntegrityCard({ integrity }: { integrity: LockdownIntegrity }) {
  if (!integrity.lockdown) return null;
  const blocked = integrity.violations.length - integrity.strikes;
  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 text-accent" /> Lockdown record
          </span>
        }
        description={`${integrity.strikes} of ${integrity.limit} strikes · ${blocked} blocked action${blocked === 1 ? '' : 's'}${integrity.closed_by_lockdown ? ' · closed at the strike limit' : ''}`}
      />
      <CardBody>
        {integrity.violations.length === 0 ? (
          <p className="text-sm text-muted">No violations recorded.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {integrity.violations.map((v, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2">
                  {v.strike ? <Badge tone="danger">Strike</Badge> : <Badge>Blocked</Badge>}
                  <span className="text-ink">{VIOLATION_LABELS[v.kind] ?? v.kind}</span>
                  {v.detail && <span className="text-muted">· {v.detail}</span>}
                </span>
                <span className="whitespace-nowrap text-xs text-muted">{formatDateTime(v.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

const EVIDENCE_TAB: Record<string, EvidenceTarget['tab']> = { 'evidence-safety': 'w1', 'evidence-decisions': 'w2', 'evidence-reply': 'w2' };

function ReportView({ id, pool }: { id: string; pool: boolean }) {
  const q = useReport(id, pool);
  const [target, setTarget] = useState<EvidenceTarget | null>(null);
  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const { candidate, attempt, result, evidence, integrity } = q.data;
  return (
    <div className="flex flex-col gap-6">
      <Link to={pool ? '/org/talent-pool' : '/org/candidates'} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {pool ? 'Talent pool' : 'Candidates'}
      </Link>
      <PageHeader
        eyebrow={pool ? 'Talent pool' : 'Result report'}
        title={candidate.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" /> {candidate.email}
            </span>
            {candidate.headline && <span>{candidate.headline}</span>}
            {candidate.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {candidate.location}
              </span>
            )}
          </span>
        }
        actions={
          result && (
            <Button asChild variant="secondary">
              <a href={pool ? `/api/org/talent-pool/${id}/report.pdf` : `/api/org/results/${id}/report.pdf`} download>
                <Download /> Download PDF
              </a>
            </Button>
          )
        }
      />
      {pool && <Alert tone="info">This candidate is listed in the Lokus talent pool. Your view is recorded; contact them by email if you would like to talk.</Alert>}
      {integrity && <IntegrityCard integrity={integrity} />}
      {!result || !evidence ? (
        <Card>
          <EmptyState icon={<Hourglass />} title={attempt.in_progress ? 'Assessment in progress' : attempt.status_label}>
            {attempt.in_progress ? `The result appears here once both workdays are submitted${attempt.deadline_at ? ` (due ${formatDate(attempt.deadline_at)})` : ''}.` : 'There is no result to show.'}
          </EmptyState>
        </Card>
      ) : (
        <>
          <OutcomeBanner outcome={result.outcome} reason={result.reason}>
            <p className="mt-2 text-xs text-muted">
              Submitted {formatDateTime(attempt.submitted_at)} · result {result.status === 'final' ? 'final' : 'provisional'} since {formatDateTime(result.computed_at)}
            </p>
          </OutcomeBanner>
          <Stagger className="grid gap-3 sm:grid-cols-2">
            <StaggerItem>
              <ScoreMeter label="Workday 1 · data review" score={result.t1} pending={!result.scores_final} hint="Case report forms and study documents" />
            </StaggerItem>
            <StaggerItem>
              <ScoreMeter label="Workday 2 · inbox" score={result.t2} pending={!result.scores_final} hint="Sponsor requests, escalation and the record" />
            </StaggerItem>
          </Stagger>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Critical flags" description="Raised whatever the overall score." />
              <CardBody>
                <GateFlags
                  gates={result.gates.map((g) => ({ gate_id: g.gate_id, fired: g.fired, resolved: !g.held, reason: g.explanation }))}
                  showReasons
                  onEvidence={(gid) => {
                    const g = result.gates.find((x) => x.gate_id === gid)!;
                    setTarget({ tab: EVIDENCE_TAB[g.evidence] ?? 'w1', id: g.evidence, nonce: Date.now() });
                  }}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Competencies" description={result.scores_final ? 'Out of 100. Reported when enough scored evidence exists.' : 'Shown when the assessor review is complete.'} />
              <CardBody>
                <CompetencyBars competencies={result.competencies} />
              </CardBody>
            </Card>
          </div>
          <section aria-labelledby="evidence-heading" className="flex flex-col gap-3">
            <h2 id="evidence-heading" className="text-lg font-semibold text-ink">
              Evidence
            </h2>
            <p className="-mt-2 text-sm text-muted">What the candidate did, in their own words, with timings.</p>
            <EvidencePanel evidence={evidence} target={target} />
          </section>
        </>
      )}
    </div>
  );
}

export function ResultReport() {
  const { attemptId = '' } = useParams();
  return <ReportView id={attemptId} pool={false} />;
}

export function PoolReport() {
  const { attemptId = '' } = useParams();
  return <ReportView id={attemptId} pool />;
}

export function TalentPool() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const q = usePool(search);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Employer"
        title="Talent pool"
        description="Every candidate listed on Lokus with a submitted result. Open a report, or tick two to four to compare them. Every view is recorded."
        actions={
          <Button variant="secondary" disabled={selected.length < 2} onClick={() => navigate(`/org/compare?ids=${selected.join(',')}`)}>
            <GitCompare /> Compare{selected.length ? ` (${selected.length})` : ''}
          </Button>
        }
      />
      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input aria-label="Search the talent pool" placeholder="Name, headline or location" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {q.isLoading ? (
        <PageLoader />
      ) : q.error ? (
        <Alert tone="danger">{errorMessage(q.error)}</Alert>
      ) : !q.data?.length ? (
        <Card>
          <EmptyState icon={<Search />} title={search ? 'No one matches' : 'The talent pool is empty'}>
            {search ? 'Try a different search.' : 'Candidates appear here once they submit the simulation.'}
          </EmptyState>
        </Card>
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((c) => (
            <StaggerItem key={c.attempt_id} className="relative">
              <Link to={`/org/talent-pool/${c.attempt_id}`} className="block h-full rounded-xl border border-line bg-surface p-5 shadow-card transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-pop">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{c.name}</p>
                    <p className="truncate text-sm text-muted">{c.headline || 'No headline'}</p>
                  </div>
                  <OutcomeBadge outcome={c.result.outcome} />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                  <MapPin className="size-3.5" /> {c.location || 'Location not given'} · completed {formatDate(c.submitted_at)}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
                  <div>
                    <p className="text-xs text-muted">Workday 1</p>
                    <p className="font-semibold text-ink">{c.result.t1 ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Workday 2</p>
                    <p className="font-semibold text-ink">{c.result.t2 ?? '—'}</p>
                  </div>
                </div>
                {c.result.flags.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-1">
                    {c.result.flags.map((f) => (
                      <Badge key={f} tone={f === 'GR' ? 'violet' : 'danger'}>
                        {f}
                      </Badge>
                    ))}
                  </p>
                )}
              </Link>
              <label className="absolute bottom-4 right-4 flex cursor-pointer items-center gap-1.5 rounded-md bg-surface px-1.5 py-1 text-xs font-medium text-muted hover:text-ink">
                <input type="checkbox" className="size-4 accent-accent" checked={selected.includes(c.attempt_id)} disabled={!selected.includes(c.attempt_id) && selected.length >= 4} onChange={() => toggle(c.attempt_id)} />
                Compare
              </label>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
