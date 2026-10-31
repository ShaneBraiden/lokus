import { ArrowRight, ChevronLeft, ChevronRight, CirclePlay, ClipboardCheck, Download, FileSearch, GitCompare, Hourglass, Inbox, Lock, Mail, MapPin, Search, ShieldAlert, ShieldCheck, ShieldX, UserCheck } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, PageHeader, PageLoader, Textarea, cn, useToast } from '@/ui';
import { EASE_OUT, m, Stagger, StaggerItem } from '@/ui/motion';
import { GateFlags } from '@/features/results/Charts';
import { EvidencePanel, type EvidenceTab, type EvidenceTarget } from '@/features/results/EvidencePanel';
import { OUTCOME_META, OutcomeBadge } from '@/features/results/Outcome';
import { useCandidates, usePool, useRecordDecision, useReport, type DecisionKey, type LockdownIntegrity, type Report } from './api';
import { Breadcrumbs, DECISION_META, DecisionBadge, Eyebrow, SIMULATION } from './Flow';

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
          <ul className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto text-sm">
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

const EVIDENCE_TAB: Record<string, EvidenceTab> = { 'evidence-safety': 'w1', 'evidence-decisions': 'w2', 'evidence-reply': 'w2' };

/** What every candidate tab gets from the shell: the loaded report and where the tabs live. */
interface CandidateContext {
  id: string;
  pool: boolean;
  base: string;
  report: Report;
}
const useCandidate = () => useOutletContext<CandidateContext>();

const TABS = [
  { to: '', label: 'Overview', end: true },
  { to: 'evidence', label: 'Evidence' },
  { to: 'record', label: 'Assessment record' },
];

/** Previous / next through this organisation's candidates that have a result, in pipeline order. */
function CandidatePager({ id }: { id: string }) {
  const list = useCandidates({});
  const ids = (list.data ?? []).filter((c) => c.attempt_id && c.result).map((c) => c.attempt_id!);
  const i = ids.indexOf(id);
  const { pathname } = useLocation();
  if (i < 0 || ids.length < 2) return null;
  const tab = pathname.endsWith('/evidence') ? '/evidence' : pathname.endsWith('/record') ? '/record' : '';
  const step = (d: number) => `/org/results/${ids[(i + d + ids.length) % ids.length]}${tab}`;
  return (
    <div className="flex items-center gap-1.5">
      <Button asChild variant="secondary" size="icon">
        <Link to={step(-1)} aria-label="Previous candidate">
          <ChevronLeft />
        </Link>
      </Button>
      <span className="px-1.5 text-sm font-medium text-ink-2 tabular">
        {i + 1} of {ids.length}
      </span>
      <Button asChild variant="secondary" size="icon">
        <Link to={step(1)} aria-label="Next candidate">
          <ChevronRight />
        </Link>
      </Button>
    </div>
  );
}

/**
 * Step 3 of the employer flow: one candidate, with Overview, Evidence and Assessment record tabs as child routes.
 * Shared by invited candidates (/org/results/:id) and the talent pool (/org/talent-pool/:id).
 */
function CandidateShell({ pool }: { pool: boolean }) {
  const { attemptId: id = '' } = useParams();
  const { pathname } = useLocation();
  const q = useReport(id, pool);
  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const report = q.data;
  const { candidate, attempt, result } = report;
  const base = pool ? `/org/talent-pool/${id}` : `/org/results/${id}`;
  const tab = TABS.find((t) => t.to && pathname.endsWith(`/${t.to}`));
  const crumbs = pool ? [{ label: 'Talent pool', to: '/org/talent-pool' }] : [{ label: 'Overview', to: '/org' }, { label: SIMULATION.title, to: '/org/candidates' }];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[...crumbs, { label: candidate.name, to: tab ? base : undefined }, ...(tab ? [{ label: tab.label }] : [])]} />

      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-5">
          <span aria-hidden className="hidden size-20 shrink-0 items-center justify-center rounded-full bg-accent-soft font-serif text-[28px] text-copper sm:flex">
            {candidate.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join('')}
          </span>
          <div className="min-w-0">
            <h1 className="font-serif text-[32px] leading-tight tracking-tight text-ink sm:text-[38px]">{candidate.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span>{pool ? 'Talent pool' : SIMULATION.title}</span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" /> {candidate.email}
              </span>
              {candidate.headline && <span>{candidate.headline}</span>}
              {candidate.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> {candidate.location}
                </span>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={attempt.in_progress ? 'info' : 'neutral'}>{attempt.status_label}</Badge>
              {result && <OutcomeBadge outcome={result.outcome} />}
              {report.decisions?.[0] && <DecisionBadge decision={report.decisions[0].decision} />}
              {attempt.submitted_at && <span className="text-[13px] text-muted">Completed on {formatDate(attempt.submitted_at)}</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {!pool && <CandidatePager id={id} />}
          {!pool && result && (
            <Button asChild>
              <Link to={{ pathname: base, hash: 'decision' }}>
                <UserCheck /> {report.decisions?.length ? 'Change decision' : 'Make decision'}
              </Link>
            </Button>
          )}
          {result && (
            <Button asChild variant="secondary">
              <a href={`/api${base}/report.pdf`} download>
                <Download /> Download PDF
              </a>
            </Button>
          )}
        </div>
      </header>

      <nav aria-label="Candidate sections" className="-mt-1 flex gap-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-line)]">
        {TABS.map((t) => (
          <NavLink
            key={t.label}
            to={t.to ? `${base}/${t.to}` : base}
            end={t.end}
            className={({ isActive }) => cn('whitespace-nowrap border-b-2 pb-3 pt-1 text-sm transition-colors', isActive ? 'border-accent font-semibold text-ink' : 'border-transparent font-medium text-muted hover:text-ink')}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      {pool && <Alert tone="info">This candidate is listed in the Lokus talent pool. Your view is recorded; contact them by email if you would like to talk.</Alert>}
      <Outlet context={{ id, pool, base, report } satisfies CandidateContext} />
    </div>
  );
}

function NoResult({ report }: { report: Report }) {
  const { attempt } = report;
  return (
    <Card>
      <EmptyState icon={<Hourglass />} title={attempt.in_progress ? 'Assessment in progress' : attempt.status_label}>
        {attempt.in_progress ? `The result appears here once both workdays are submitted${attempt.deadline_at ? ` (due ${formatDate(attempt.deadline_at)})` : ''}.` : 'There is no result to show.'}
      </EmptyState>
    </Card>
  );
}

function SerifCard({ title, description, action, children, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardBody className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-serif text-xl tracking-tight text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          {action}
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

function WorkdayTile({ icon, label, hint, score, pending }: { icon: ReactNode; label: string; hint: string; score: number | null; pending: boolean }) {
  return (
    <div className="flex gap-4 rounded-xl border border-line p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-copper [&_svg]:size-[18px]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-[17px] text-ink">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
        <p className="mt-2 font-serif text-[30px] leading-none text-ink tabular">
          {score === null ? '—' : Number.isInteger(score) ? score : score.toFixed(1)}
          <span className="ml-1 font-sans text-sm text-faint">/100</span>
        </p>
        <div className="mt-3 h-1.5 rounded-full bg-subtle" role="img" aria-label={`${label}: ${score ?? 'not available'} out of 100`}>
          <m.div className={cn('h-full rounded-full', pending ? 'bg-accent' : 'bg-success')} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }} transition={{ duration: 0.9, ease: EASE_OUT }} />
        </div>
        {pending && <p className="mt-2 text-xs text-muted">Provisional — written work is being reviewed.</p>}
      </div>
    </div>
  );
}

/** The team's hiring decision: Advance, Hold or Decline with a note. Saving adds to the history; it never overwrites. */
function DecisionPanel({ id, report }: { id: string; report: Report }) {
  const current = report.decisions?.[0];
  const [choice, setChoice] = useState<DecisionKey | null>(current?.decision ?? null);
  const [note, setNote] = useState('');
  const save = useRecordDecision(id);
  const toast = useToast();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash !== '#decision') return;
    const t = window.setTimeout(() => document.getElementById('decision')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <section id="decision" aria-labelledby="decision-title" className={cn('scroll-mt-24 rounded-xl border bg-surface shadow-card transition-shadow', hash === '#decision' ? 'border-accent-line ring-2 ring-accent/20' : 'border-line')}>
      <form
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!choice) return;
          save.mutate(
            { decision: choice, note: note.trim() },
            {
              onSuccess: () => {
                setNote('');
                toast.success(`Decision saved: ${DECISION_META[choice].label}`, 'Recorded in the assessment record.');
              },
              onError: (err) => toast.error('Could not save the decision', errorMessage(err)),
            },
          );
        }}
      >
        <div>
          <h2 id="decision-title" className="font-serif text-xl tracking-tight text-ink">
            Hiring decision
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
            <Lock className="size-3.5" /> Private to your team; the candidate never sees it.
          </p>
        </div>
        {current && (
          <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
            Current: <span className="font-semibold text-ink">{current.label}</span> · {current.decided_by}, {formatDateTime(current.decided_at)}
          </p>
        )}
        <fieldset>
          <legend className="sr-only">Decision</legend>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(DECISION_META) as DecisionKey[]).map((k) => {
              const meta = DECISION_META[k];
              const on = choice === k;
              return (
                <label
                  key={k}
                  title={meta.meaning}
                  className={cn(
                    'flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-accent/20 [&_svg]:size-3.5',
                    on ? (k === 'advance' ? 'border-accent-line bg-accent-soft text-accent' : k === 'hold' ? 'border-amber-200 bg-warning-soft text-warning' : 'border-rose-200 bg-danger-soft text-danger') : 'border-line-strong text-ink-2 hover:border-ink/40',
                  )}
                >
                  <input type="radio" name="decision" value={k} checked={on} onChange={() => setChoice(k)} className="sr-only" />
                  {meta.icon}
                  {meta.label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <Textarea aria-label="Note for your hiring team" placeholder="Add a note for your hiring team…" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" loading={save.isPending} disabled={!choice || (choice === current?.decision && !note.trim())}>
          Save decision
        </Button>
      </form>
    </section>
  );
}

/** Candidate · Overview: outcome, workday scores, competencies, critical flags and a pointer into the evidence. */
export function CandidateOverview() {
  const { id, pool, report, base } = useCandidate();
  const navigate = useNavigate();
  const { attempt, result, evidence, integrity } = report;
  if (!result || !evidence) {
    return (
      <div className="flex flex-col gap-6">
        <NoResult report={report} />
        {integrity && <IntegrityCard integrity={integrity} />}
      </div>
    );
  }
  const meta = OUTCOME_META[result.outcome];
  const findings = evidence.t1.findings.filter((f) => !f.withdrawn).length;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardBody className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_230px]">
            <div>
              <Eyebrow>Assessment outcome</Eyebrow>
              <p className="mt-3 flex items-center gap-3 font-serif text-[36px] leading-none tracking-tight text-ink sm:text-[42px]">
                {meta.label}
                <span className="flex size-9 items-center justify-center rounded-full bg-surface shadow-card [&_svg]:size-5" style={{ color: meta.color }}>
                  {meta.icon}
                </span>
              </p>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">{result.reason}</p>
            </div>
            <dl className="flex flex-col gap-3 border-line text-[13px] md:border-l md:pl-6">
              <div>
                <dt className="font-medium text-ink">Completed</dt>
                <dd className="text-muted">{formatDateTime(attempt.submitted_at)}</dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Result</dt>
                <dd className="text-muted">
                  {result.status === 'final' ? 'Final' : 'Provisional'} since {formatDateTime(result.computed_at)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Scoring</dt>
                <dd className="text-muted">Rubric v1.1 · engine and blind assessor review</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <SerifCard title="Workday performance" description="Scores for each simulated workday, out of 100.">
          <Stagger className="grid gap-3 sm:grid-cols-2">
            <StaggerItem>
              <WorkdayTile icon={<FileSearch />} label="Workday 1 · Data review" hint="Case report forms and study documents" score={result.t1} pending={!result.scores_final} />
            </StaggerItem>
            <StaggerItem>
              <WorkdayTile icon={<Inbox />} label="Workday 2 · Inbox" hint="Sponsor requests, escalation and the record" score={result.t2} pending={!result.scores_final} />
            </StaggerItem>
          </Stagger>
        </SerifCard>

        <SerifCard title="Competencies" description={result.scores_final ? 'Out of 100. Reported when enough scored evidence exists.' : 'Shown when the assessor review is complete.'}>
          <ul className="flex flex-col divide-y divide-line">
            {result.competencies.map((c) => {
              const shown = c.reportable && c.score !== null;
              return (
                <li key={c.id} className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1 text-sm text-ink">
                    <span className="mr-2 font-mono text-[11px] text-faint">{c.id}</span>
                    {c.name}
                  </span>
                  <span className="hidden h-1.5 w-28 rounded-full bg-subtle sm:block" aria-hidden>
                    {shown && <m.span className="block h-full rounded-full bg-copper" initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, c.score!))}%` }} transition={{ duration: 0.8, ease: EASE_OUT }} />}
                  </span>
                  <Badge tone={shown ? 'accent' : 'neutral'} className="min-w-[4.5rem] justify-center">
                    {shown ? Math.round(c.score!) : result.scores_final ? 'Not reportable' : 'Pending'}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </SerifCard>
      </div>

      <aside className="flex flex-col gap-6">
        {!pool && <DecisionPanel key={id} id={id} report={report} />}
        <SerifCard title="Critical flags" description="Raised whatever the overall score.">
          <GateFlags
            gates={result.gates.map((g) => ({ gate_id: g.gate_id, fired: g.fired, resolved: !g.held, reason: g.explanation }))}
            showReasons
            onEvidence={(gid) => {
              const g = result.gates.find((x) => x.gate_id === gid)!;
              navigate(`${base}/evidence`, { state: { tab: EVIDENCE_TAB[g.evidence] ?? 'w1', id: g.evidence } });
            }}
          />
        </SerifCard>

        <SerifCard
          title="Evidence"
          description="What the candidate did, in their own words, with timings."
          action={
            <Link to={`${base}/evidence`} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-accent hover:underline">
              View all <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            {[
              ['Findings logged', findings],
              ['Escalations', evidence.t1.escalations.length],
              ['Messages sent', evidence.t2.messages.length + (evidence.t2.reply ? 1 : 0)],
              ['Records opened', `${evidence.t1.records_opened.length} of 12`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-subtle px-3 py-2">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-semibold text-ink tabular">{v}</dd>
              </div>
            ))}
          </dl>
        </SerifCard>

        {integrity && <IntegrityCard integrity={integrity} />}
      </aside>
    </div>
  );
}

/** Candidate · Evidence: the recorded work, with the critical flags alongside to jump to what triggered them. */
export function CandidateEvidence() {
  const { report } = useCandidate();
  const { state } = useLocation() as { state: { tab?: EvidenceTab; id?: string } | null };
  const [target, setTarget] = useState<EvidenceTarget | null>(null);
  useEffect(() => {
    if (state?.tab && state.id) setTarget({ tab: state.tab, id: state.id, nonce: Date.now() });
  }, [state]);
  const { result, evidence } = report;
  if (!result || !evidence) return <NoResult report={report} />;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-[30px] tracking-tight text-ink">Evidence</h2>
        <p className="text-sm text-muted">What the candidate did across both workdays, in their own words, with timings.</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <EvidencePanel evidence={evidence} target={target} />
        </div>
        <aside className="lg:sticky lg:top-6">
          <SerifCard title="Critical flags" description="Jump to the evidence behind a flag.">
            <GateFlags
              gates={result.gates.map((g) => ({ gate_id: g.gate_id, fired: g.fired, resolved: !g.held }))}
              onEvidence={(gid) => {
                const g = result.gates.find((x) => x.gate_id === gid)!;
                setTarget({ tab: EVIDENCE_TAB[g.evidence] ?? 'w1', id: g.evidence, nonce: Date.now() });
              }}
            />
          </SerifCard>
        </aside>
      </div>
    </div>
  );
}

interface RecordEvent {
  at: string;
  title: string;
  description: string;
  icon: ReactNode;
  tone: 'accent' | 'success' | 'danger' | 'info';
  aside?: ReactNode;
  quote?: string;
}

const TONE_RING: Record<RecordEvent['tone'], string> = {
  accent: 'bg-accent-soft text-copper',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

function ScoreChip({ score }: { score: number | null }) {
  if (score === null) return null;
  return (
    <span className="rounded-lg bg-success-soft px-3 py-1.5 font-serif text-lg leading-none text-ink tabular">
      {Number.isInteger(score) ? score : score.toFixed(1)}
      <span className="ml-0.5 font-sans text-xs text-faint">/100</span>
    </span>
  );
}

/** The milestones of one attempt, oldest first, from the attempt, the lockdown record and the result. */
function recordEvents({ candidate, attempt, result, evidence, integrity, decisions = [] }: Report): RecordEvent[] {
  const events: RecordEvent[] = [];
  const final = Boolean(result?.scores_final);
  if (attempt.started_at) events.push({ at: attempt.started_at, title: 'Assessment started', description: `${candidate.name} began Workday 1.`, icon: <CirclePlay />, tone: 'accent' });
  if (attempt.t1_submitted_at) {
    const n = evidence?.t1.findings.filter((f) => !f.withdrawn).length;
    events.push({ at: attempt.t1_submitted_at, title: 'Workday 1 submitted', description: `Data review${n === undefined ? '' : ` · ${n} finding${n === 1 ? '' : 's'} logged`}.`, icon: <FileSearch />, tone: 'accent', aside: final ? <ScoreChip score={result!.t1} /> : undefined });
  }
  for (const v of integrity?.violations.filter((x) => x.strike) ?? []) {
    events.push({ at: v.at, title: 'Lockdown strike', description: `${VIOLATION_LABELS[v.kind] ?? v.kind}${v.detail ? ` · ${v.detail}` : ''}.`, icon: <ShieldAlert />, tone: 'danger' });
  }
  if (attempt.submitted_at) events.push({ at: attempt.submitted_at, title: 'Workday 2 submitted', description: `Inbox · ${candidate.name} submitted both workdays.`, icon: <Inbox />, tone: 'accent', aside: final ? <ScoreChip score={result!.t2} /> : undefined });
  if (integrity?.closed_by_lockdown) {
    const last = integrity.violations.filter((x) => x.strike).at(-1);
    if (last) events.push({ at: last.at, title: 'Closed at the strike limit', description: `The attempt closed after ${integrity.limit} lockdown strikes.`, icon: <ShieldX />, tone: 'danger' });
  }
  if (result) {
    events.push(
      result.status === 'final'
        ? { at: result.computed_at, title: 'Outcome assigned', description: 'Engine scores and assessor ratings combined under rubric v1.1.', icon: <ClipboardCheck />, tone: 'success', aside: <OutcomeBadge outcome={result.outcome} /> }
        : { at: result.computed_at, title: 'Provisional result', description: 'Automatic criteria scored; trained assessors are rating the written work.', icon: <Hourglass />, tone: 'info', aside: <OutcomeBadge outcome={result.outcome} /> },
    );
  }
  decisions.forEach((d, i) => {
    events.push({ at: d.decided_at, title: i === decisions.length - 1 ? 'Hiring decision' : 'Decision changed', description: `Decided by ${d.decided_by}.`, icon: <UserCheck />, tone: 'accent', aside: <DecisionBadge decision={d.decision} />, quote: d.note || undefined });
  });
  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** Candidate · Assessment record: the chronological history of the attempt, with the full event log underneath. */
export function CandidateRecord() {
  const { report } = useCandidate();
  const { candidate, attempt, result, evidence, integrity } = report;
  const events = recordEvents(report);
  const details: [string, ReactNode][][] = [
    [
      ['Simulation', `${SIMULATION.product} · ${SIMULATION.title}`],
      ['Rubric', 'Rubric v1.1'],
    ],
    [
      ['Candidate', candidate.name],
      ['Email', <span className="break-all">{candidate.email}</span>],
      ['Attempt', <span className="font-mono text-xs">{attempt.id.slice(0, 8)}</span>],
    ],
    [
      ['Started', formatDateTime(attempt.started_at)],
      ['Workday 1 submitted', formatDateTime(attempt.t1_submitted_at)],
      ['Completed', formatDateTime(attempt.submitted_at)],
      ...(attempt.in_progress && attempt.deadline_at ? [['Deadline', formatDateTime(attempt.deadline_at)] as [string, ReactNode]] : []),
    ],
    [
      ['Status', attempt.status_label],
      ['Result', result ? (result.status === 'final' ? 'Final' : 'Provisional') : '—'],
      ['Outcome', result ? <OutcomeBadge outcome={result.outcome} /> : '—'],
      ...(integrity?.lockdown ? [['Lockdown strikes', `${integrity.strikes} of ${integrity.limit}`] as [string, ReactNode]] : []),
    ],
    ...(report.decisions?.[0]
      ? [
          [
            ['Hiring decision', <DecisionBadge decision={report.decisions[0].decision} />],
            ['Decision date', formatDateTime(report.decisions[0].decided_at)],
            ['Decided by', report.decisions[0].decided_by],
          ] as [string, ReactNode][],
        ]
      : []),
  ];
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardBody className="p-6">
          <h2 className="font-serif text-[30px] tracking-tight text-ink">Assessment record</h2>
          <p className="text-sm text-muted">Chronological history of the candidate&rsquo;s assessment, review and result.</p>
          {events.length === 0 ? (
            <EmptyState icon={<Hourglass />} title="Nothing recorded yet" className="py-10">
              Events appear once the candidate starts the simulation.
            </EmptyState>
          ) : (
            <ol className="relative mt-5 flex flex-col">
              <span className="absolute bottom-6 left-[5px] top-6 w-px bg-line" aria-hidden />
              {events.map((e, i) => (
                <li key={i} className="relative grid grid-cols-[12px_80px_minmax(0,1fr)] items-start gap-x-4 border-b border-line py-4 last:border-0 sm:grid-cols-[12px_100px_40px_minmax(0,1fr)_auto] sm:items-center">
                  <span className="mt-1.5 size-2.5 rounded-full border-2 border-surface bg-copper sm:mt-0" aria-hidden />
                  <span className="text-[13px] text-ink">
                    {formatDate(e.at)}
                    <span className="block text-xs text-muted">{new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  <span className={cn('hidden size-10 items-center justify-center rounded-full sm:flex [&_svg]:size-[18px]', TONE_RING[e.tone])}>{e.icon}</span>
                  <span className="min-w-0">
                    <span className="block font-serif text-[17px] text-ink">{e.title}</span>
                    <span className="block text-[13px] text-muted">{e.description}</span>
                    {e.quote && <span className="mt-2 block rounded-lg border border-line bg-subtle/60 px-3 py-2 text-[13px] italic text-ink-2">&ldquo;{e.quote}&rdquo;</span>}
                  </span>
                  {e.aside && <span className="col-start-3 mt-2 sm:col-start-auto sm:mt-0">{e.aside}</span>}
                </li>
              ))}
            </ol>
          )}
          {evidence && evidence.timeline.length > 0 && (
            <details className="group mt-4 rounded-lg border border-line">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink">
                Full event log
                <span className="text-xs text-muted">{evidence.timeline.length} events</span>
              </summary>
              <ol className="max-h-96 divide-y divide-line overflow-y-auto border-t border-line text-[13px]">
                {evidence.timeline.map((t) => (
                  <li key={t.event_id} className="grid grid-cols-[48px_110px_minmax(0,1fr)] gap-3 px-4 py-2">
                    <span className="font-mono text-xs text-faint">#{t.seq}</span>
                    <span className="text-muted">{formatDateTime(t.at)}</span>
                    <span className="text-ink-2">
                      <span className="mr-1.5 text-xs font-semibold text-muted">{t.task}</span>
                      {t.label}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-6">
          <h2 className="font-serif text-xl tracking-tight text-ink">Assessment details</h2>
          <div className="mt-2 flex flex-col divide-y divide-line">
            {details.map((group, gi) => (
              <dl key={gi} className="flex flex-col gap-2.5 py-4 text-[13px] last:pb-0">
                {group.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export function ResultReport() {
  return <CandidateShell pool={false} />;
}

export function PoolReport() {
  return <CandidateShell pool />;
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
