import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, GitCompare, Link2, RefreshCcw, Search, ShieldCheck, ShieldX } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ATTEMPT_STATUS_LABELS } from '@lokus/shared';
import { errorMessage, http } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  KeyValue,
  PageHeader,
  PageLoader,
  Select,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  useToast,
} from '@/ui';
import { CompetencyBars, GateFlags, ScoreMeter } from '@/features/results/Charts';
import { EvidencePanel } from '@/features/results/EvidencePanel';
import { OUTCOME_META, OUTCOME_ORDER, OutcomeBadge, OutcomeBanner, outcomeKey } from '@/features/results/Outcome';
import { adminKeys, useAttempt, useAttemptEvents, useAttempts, type AttemptDetail, type CompareResult } from './api';

const PAGE = 25;
const STATUS_OPTIONS = Object.entries(ATTEMPT_STATUS_LABELS);

export function Attempts() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(params.get('query') ?? '');
  const offset = Number(params.get('offset') ?? 0);
  const filters = Object.fromEntries([...params.entries()].filter(([k, v]) => v && ['query', 'status', 'outcome', 'offset'].includes(k)));
  const list = useAttempts({ ...filters, limit: String(PAGE) });
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'offset') next.delete('offset');
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Lokus admin" title="Attempts" description="Every attempt across organisations, with its latest result." />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          set('query', query.trim());
        }}
      >
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input aria-label="Search candidates" placeholder="Name, email or attempt id" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select aria-label="Status" value={params.get('status') ?? ''} onChange={(e) => set('status', e.target.value)} className="w-48">
          <option value="">Any status</option>
          {STATUS_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select aria-label="Outcome" value={params.get('outcome') ?? ''} onChange={(e) => set('outcome', e.target.value)} className="w-52">
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
        ) : !list.data?.attempts.length ? (
          <EmptyState title="No attempts match">Try a different search or clear the filters.</EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Candidate</TH>
                <TH>Employer</TH>
                <TH>Status</TH>
                <TH>Outcome</TH>
                <TH numeric>Workday 1</TH>
                <TH numeric>Workday 2</TH>
                <TH>Created</TH>
              </tr>
            </THead>
            <tbody>
              {list.data.attempts.map((a) => (
                <TR key={a.id} interactive onClick={() => navigate(`/admin/attempts/${a.id}`)}>
                  <TD>
                    <span className="block font-medium text-ink">{a.candidate.name}</span>
                    <span className="block text-xs text-muted">{a.candidate.email}</span>
                  </TD>
                  <TD>{a.org_name ?? <span className="text-muted">Talent pool route</span>}</TD>
                  <TD>
                    {a.status_label}
                    {a.is_retake && <Badge className="ml-1.5">Retake</Badge>}
                  </TD>
                  <TD>{a.status === 'submitted' || a.status === 'closed' ? <OutcomeBadge outcome={outcomeKey(a.result)} /> : <span className="text-muted">—</span>}</TD>
                  <TD numeric>{a.result?.t1 ?? '—'}</TD>
                  <TD numeric>{a.result?.t2 ?? '—'}</TD>
                  <TD className="whitespace-nowrap">{formatDateTime(a.created_at)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => set('offset', String(Math.max(0, offset - PAGE)))}>
          <ChevronLeft /> Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={!list.data?.has_more} onClick={() => set('offset', String(offset + PAGE))}>
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

function ResultTab({ d }: { d: AttemptDetail }) {
  const r = d.result;
  if (!r) return <EmptyState title="No result yet">A result is computed when Workday 1 is submitted.</EmptyState>;
  const key = outcomeKey({ status: r.status, outcome: r.outcome });
  return (
    <div className="flex flex-col gap-6">
      {key && <OutcomeBanner outcome={key} reason={r.outcome_reason} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <ScoreMeter label="Workday 1" score={r.tasks.T1.score_q / 4} pending={r.tasks.T1.pending_criteria.length > 0} />
        <ScoreMeter label="Workday 2" score={r.tasks.T2.score_q / 4} pending={r.tasks.T2.pending_criteria.length > 0} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Critical flags" />
          <CardBody>
            <GateFlags gates={r.gates} showReasons />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Competencies" description="Reported when at least two scored criteria carry evidence." />
          <CardBody>
            <CompetencyBars competencies={r.competencies} />
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Criteria" description={`Engine ${r.engine_version} · package ${r.package_id} · result v${r.version} (${r.trigger})`} />
        <Table>
          <THead>
            <tr>
              <TH>Criterion</TH>
              <TH>Method</TH>
              <TH numeric>Rating</TH>
              <TH numeric>Points</TH>
              <TH>Rule and explanation</TH>
            </tr>
          </THead>
          <tbody>
            {r.criteria.map((c) => (
              <TR key={c.criterion_id}>
                <TD>
                  <span className="block font-medium text-ink">{c.name}</span>
                  <span className="block font-mono text-[11px] text-faint">
                    {c.criterion_id} · w{c.weight} · {c.competency}
                  </span>
                </TD>
                <TD>{c.method === 'Reviewer' ? <Badge tone="info">Reviewer</Badge> : <Badge>Auto</Badge>}</TD>
                <TD numeric>
                  {c.status === 'PENDING' ? (
                    <Badge tone="warning">Pending</Badge>
                  ) : (
                    <span>
                      {c.rating}
                      {c.cap !== null && c.raw_rating !== c.rating && <span className="block text-[11px] text-muted">raw {c.raw_rating}, cap {c.cap}</span>}
                    </span>
                  )}
                </TD>
                <TD numeric>{c.points_q === null ? '—' : c.points_q / 4}</TD>
                <TD>
                  <span className="block font-mono text-[11px] text-faint">{c.rule_id}</span>
                  <span className="block text-[13px]">{c.explanation}</span>
                  {c.cap_reasons.length > 0 && <span className="block text-[12px] text-warning">{c.cap_reasons.join('; ')}</span>}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function EventsTab({ id, active }: { id: string; active: boolean }) {
  const events = useAttemptEvents(id, active);
  if (!active) return null;
  if (events.isLoading) return <PageLoader />;
  if (events.error || !events.data) return <Alert tone="danger">{errorMessage(events.error)}</Alert>;
  return (
    <Card>
      <CardHeader
        title="Event log"
        description="Append-only; each event's hash covers the previous one."
        action={
          events.data.chain.ok ? (
            <Badge tone="success">
              <ShieldCheck /> Chain verified · {events.data.chain.length}
            </Badge>
          ) : (
            <Badge tone="danger">
              <ShieldX /> Broken at #{events.data.chain.brokenAtSeq}
            </Badge>
          )
        }
      />
      <div className="max-h-[560px] overflow-y-auto">
        <Table>
          <THead className="sticky top-0">
            <tr>
              <TH numeric>#</TH>
              <TH>Server time</TH>
              <TH>Task</TH>
              <TH>Type</TH>
              <TH>Object</TH>
              <TH>Source</TH>
              <TH>Hash</TH>
            </tr>
          </THead>
          <tbody>
            {events.data.events.map((e) => (
              <TR key={e.seq}>
                <TD numeric>{e.seq}</TD>
                <TD className="whitespace-nowrap tabular">{new Date(e.at).toISOString().replace('T', ' ').slice(0, 19)}</TD>
                <TD>{e.task}</TD>
                <TD className="font-mono text-[12px]">{e.type}</TD>
                <TD className="max-w-48 truncate font-mono text-[12px]">{e.object_id ?? '—'}</TD>
                <TD>
                  <Badge>{{ O: 'Observed', C: 'Command', S: 'System', T: 'Telemetry' }[e.source] ?? e.source}</Badge>
                </TD>
                <TD className="font-mono text-[11px] text-faint">{e.hash.slice(0, 10)}…</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}

function ActionsTab({ d }: { d: AttemptDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<null | 'close' | 'void' | 'retake'>(null);
  const [reason, setReason] = useState('');
  const [voidPrevious, setVoidPrevious] = useState(true);
  const id = d.attempt.id;
  const done = () => {
    setDialog(null);
    setReason('');
    void qc.invalidateQueries({ queryKey: adminKeys.attempt(id) });
    void qc.invalidateQueries({ queryKey: ['admin', 'attempts'] });
  };
  const rescore = useMutation({
    mutationFn: () => http.post<{ created: boolean; version: number }>(`/admin/attempts/${id}/rescore`),
    onSuccess: (r) => {
      toast.success(r.created ? `New result version ${r.version}` : 'Result unchanged', r.created ? undefined : 'The inputs and package are the same, so no new version was written.');
      done();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const act = useMutation({
    mutationFn: () => http.post<{ attempt_id?: string }>(`/admin/attempts/${id}/${dialog}`, dialog === 'retake' ? { reason, void_previous: voidPrevious } : { reason }),
    onSuccess: (r) => {
      toast.success(dialog === 'retake' ? 'Retake granted' : dialog === 'void' ? 'Attempt withdrawn' : 'Attempt closed');
      done();
      if (r.attempt_id) navigate(`/admin/attempts/${r.attempt_id}`);
    },
  });
  const active = ['not_started', 'w1_in_progress', 'w1_submitted', 'w2_in_progress'].includes(d.attempt.status);
  const titles = { close: 'Close this attempt', void: 'Withdraw this attempt', retake: 'Grant a retake' };
  const descriptions = {
    close: 'The candidate can no longer continue. Their result becomes a final Incomplete.',
    void: 'The attempt is withdrawn and disappears from results. This is recorded in the audit log.',
    retake: 'A new attempt is created for the same candidate, pinned to the active scoring package. Employers who could see this attempt will see the new one.',
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[
        { title: 'Rescore', body: 'Recompute the result from the stored evidence. A new version is written only if inputs changed.', action: <Button variant="secondary" loading={rescore.isPending} onClick={() => rescore.mutate()}><RefreshCcw /> Rescore</Button> },
        { title: 'Grant a retake', body: descriptions.retake, action: <Button variant="secondary" onClick={() => setDialog('retake')}>Grant retake</Button> },
        { title: 'Close', body: descriptions.close, action: <Button variant="secondary" disabled={!active} onClick={() => setDialog('close')}>Close attempt</Button> },
        { title: 'Withdraw', body: descriptions.void, action: <Button variant="danger" disabled={d.attempt.status === 'void'} onClick={() => setDialog('void')}>Withdraw</Button> },
      ].map((x) => (
        <Card key={x.title}>
          <CardBody className="flex h-full flex-col gap-3">
            <p className="font-semibold text-ink">{x.title}</p>
            <p className="flex-1 text-sm text-muted">{x.body}</p>
            <div>{x.action}</div>
          </CardBody>
        </Card>
      ))}
      <Dialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog ? titles[dialog] : ''}
        description={dialog ? descriptions[dialog] : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant={dialog === 'void' ? 'danger' : 'primary'} disabled={reason.trim().length < 3} loading={act.isPending} onClick={() => act.mutate()}>
              Confirm
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {act.error && <Alert tone="danger">{errorMessage(act.error)}</Alert>}
          <Field label="Reason" htmlFor="admin-reason" hint="Recorded in the audit log.">
            <Textarea id="admin-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {dialog === 'retake' && <Checkbox checked={voidPrevious} onChange={(e) => setVoidPrevious(e.target.checked)} label="Withdraw the current attempt" description="Recommended: only the new attempt's result will count." />}
        </div>
      </Dialog>
    </div>
  );
}

export function AttemptDetailPage() {
  const { attemptId = '' } = useParams();
  const q = useAttempt(attemptId);
  const [tab, setTab] = useState('result');
  if (q.isLoading) return <PageLoader />;
  if (q.error || !q.data) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const d = q.data;
  const key = d.result ? outcomeKey({ status: d.result.status, outcome: d.result.outcome }) : null;
  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/attempts" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Attempts
      </Link>
      <PageHeader
        eyebrow={d.org ? `Invited by ${d.org.name}` : 'Talent pool route'}
        title={d.candidate.name}
        description={`${d.candidate.email} · ${d.attempt.status_label}${d.attempt.is_retake ? ' · retake' : ''}`}
        actions={
          <>
            {key && <OutcomeBadge outcome={key} />}
            <Button asChild variant="secondary" size="sm">
              <Link to={`/admin/compare?a=${d.attempt.id}`}>
                <GitCompare /> Compare
              </Link>
            </Button>
          </>
        }
      />
      <Card>
        <CardBody>
          <KeyValue
            className="lg:grid-cols-4"
            items={[
              { label: 'Started', value: formatDateTime(d.attempt.started_at) },
              { label: 'Workday 1 submitted', value: formatDateTime(d.attempt.t1_submitted_at) },
              { label: 'Workday 2 clock started', value: formatDateTime(d.attempt.w2_clock_started_at) },
              { label: 'Submitted', value: formatDateTime(d.attempt.t2_submitted_at) },
              { label: 'Deadline', value: formatDateTime(d.attempt.deadline_at) },
              { label: 'Scoring package', value: <span className="font-mono text-xs">{d.attempt.scoring_package_id}</span> },
              { label: 'Review', value: d.review ? `${d.review.status === 'done' ? 'Complete' : d.review.assignee ? `With ${d.review.assignee}` : 'Waiting'} · ${d.review.pseudonym}` : '—' },
              { label: 'Shared with', value: d.shares.filter((s) => !s.revoked_at).map((s) => s.org).join(', ') || '—' },
            ]}
          />
          {d.attempt.close_reason && <p className="mt-4 text-sm text-muted">Closed: {d.attempt.close_reason}</p>}
        </CardBody>
      </Card>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="result">Result</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="events">Event log</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>
        <TabsContent value="result" className="mt-5 outline-none">
          <ResultTab d={d} />
        </TabsContent>
        <TabsContent value="evidence" className="mt-5 outline-none">
          <EvidencePanel evidence={d.evidence} />
        </TabsContent>
        <TabsContent value="events" className="mt-5 outline-none">
          <EventsTab id={d.attempt.id} active={tab === 'events'} />
        </TabsContent>
        <TabsContent value="history" className="mt-5 flex flex-col gap-6 outline-none">
          <Card>
            <CardHeader title="Result versions" description="Append-only; a new version is written whenever the inputs change." />
            <Table>
              <THead>
                <tr>
                  <TH numeric>Version</TH>
                  <TH>Trigger</TH>
                  <TH>Outcome</TH>
                  <TH numeric>Workday 1</TH>
                  <TH numeric>Workday 2</TH>
                  <TH>Computed</TH>
                  <TH>Input digest</TH>
                </tr>
              </THead>
              <tbody>
                {d.versions.map((v) => (
                  <TR key={v.version}>
                    <TD numeric>{v.version}</TD>
                    <TD>{v.trigger}</TD>
                    <TD>
                      <OutcomeBadge outcome={outcomeKey(v)} />
                    </TD>
                    <TD numeric>{v.t1}</TD>
                    <TD numeric>{v.t2}</TD>
                    <TD className="whitespace-nowrap">{formatDateTime(v.computed_at)}</TD>
                    <TD className="font-mono text-[11px] text-faint">{v.input_digest.slice(0, 12)}…</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>
          <Card>
            <CardHeader title="Assessor ratings" description="Append-only; the latest rating per criterion counts." />
            {d.ratings.length ? (
              <Table>
                <THead>
                  <tr>
                    <TH>Criterion</TH>
                    <TH numeric>Rating</TH>
                    <TH>Rationale</TH>
                    <TH>Assessor</TH>
                    <TH>When</TH>
                  </tr>
                </THead>
                <tbody>
                  {d.ratings.map((r, i) => (
                    <TR key={i}>
                      <TD className="font-mono text-[12px]">{r.criterion_id}</TD>
                      <TD numeric>{r.raw_rating}</TD>
                      <TD className="max-w-md">{r.rationale}</TD>
                      <TD>{r.assessor}</TD>
                      <TD className="whitespace-nowrap">{formatDateTime(r.at)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <CardBody>
                <p className="text-sm text-muted">No ratings yet.</p>
              </CardBody>
            )}
            {d.dispositions.length > 0 && (
              <CardBody className="border-t border-line">
                <p className="mb-2 text-sm font-semibold text-ink">Hold dispositions</p>
                <ul className="flex flex-col gap-1 text-sm text-ink-2">
                  {d.dispositions.map((x, i) => (
                    <li key={i}>
                      {x.clause}: {x.disposition} by {x.assessor} · {formatDateTime(x.at)} — {x.note}
                    </li>
                  ))}
                </ul>
              </CardBody>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="actions" className="mt-5 outline-none">
          <ActionsTab d={d} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AttemptPicker({ id, value, onChange, label }: { id: string; value: string; onChange: (v: string) => void; label: string }) {
  const options = useQuery({ queryKey: ['admin', 'attempts-with-results'], queryFn: () => http.get<{ attempts: { id: string; name: string; email: string; outcome_label: string; t1: number | null; t2: number | null }[] }>('/admin/attempts-with-results').then((r) => r.attempts) });
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose an attempt</option>
        {(options.data ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} — {o.outcome_label} · {o.t1 ?? '–'} / {o.t2 ?? '–'}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function Compare() {
  const [params, setParams] = useSearchParams();
  const a = params.get('a') ?? '';
  const b = params.get('b') ?? '';
  const set = (k: 'a' | 'b', v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const q = useQuery({ queryKey: ['admin', 'compare', a, b], queryFn: () => http.get<CompareResult>(`/admin/compare?a=${a}&b=${b}`), enabled: Boolean(a && b && a !== b), retry: false });
  const sides = q.data ? [q.data.a, q.data.b] : [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Lokus admin" title="Compare attempts" description="Why did A score differently from B? Criteria are listed with the largest point differences first." />
      <Card>
        <CardBody className="grid gap-4 md:grid-cols-2">
          <AttemptPicker id="compare-a" label="Attempt A" value={a} onChange={(v) => set('a', v)} />
          <AttemptPicker id="compare-b" label="Attempt B" value={b} onChange={(v) => set('b', v)} />
        </CardBody>
      </Card>
      {q.isLoading && <PageLoader />}
      {q.error && <Alert tone="danger">{errorMessage(q.error)}</Alert>}
      {q.data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {sides.map((s, i) => (
              <Card key={s.id}>
                <CardBody className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Attempt {i === 0 ? 'A' : 'B'}</p>
                      <Link to={`/admin/attempts/${s.id}`} className="font-semibold text-ink hover:text-accent">
                        {s.candidate.name}
                      </Link>
                    </div>
                    <OutcomeBadge outcome={outcomeKey({ status: s.status, outcome: s.outcome })} />
                  </div>
                  <p className="text-sm text-muted">{s.outcome_reason}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <ScoreMeter label="Workday 1" score={s.t1} />
                    <ScoreMeter label="Workday 2" score={s.t2} />
                  </div>
                  <GateFlags gates={s.gates} />
                </CardBody>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader title="Where they differ" description={q.data.differences.length ? `${q.data.differences.length} criteria rated differently.` : 'Every criterion has the same rating.'} />
            <Table>
              <THead>
                <tr>
                  <TH>Criterion</TH>
                  <TH numeric>A</TH>
                  <TH numeric>B</TH>
                  <TH numeric>Points A − B</TH>
                  <TH>Why</TH>
                </tr>
              </THead>
              <tbody>
                {(q.data.differences.length ? q.data.differences : q.data.criteria).map((c) => (
                  <TR key={c.criterion_id}>
                    <TD>
                      <span className="block font-medium text-ink">{c.name}</span>
                      <span className="block font-mono text-[11px] text-faint">
                        {c.criterion_id} · w{c.weight}
                      </span>
                    </TD>
                    <TD numeric>{c.a?.rating ?? 'Pending'}</TD>
                    <TD numeric>{c.b?.rating ?? 'Pending'}</TD>
                    <TD numeric className={c.points_difference > 0 ? 'text-success' : c.points_difference < 0 ? 'text-danger' : ''}>
                      {c.points_difference > 0 ? '+' : ''}
                      {c.points_difference}
                    </TD>
                    <TD className="max-w-xl text-[13px]">
                      <span className="block">
                        <span className="font-semibold text-ink">A:</span> {c.a?.explanation}
                      </span>
                      <span className="mt-1 block">
                        <span className="font-semibold text-ink">B:</span> {c.b?.explanation}
                      </span>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
      {!a || !b ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Link2 className="size-4" /> Pick two attempts to compare, or open one from the attempts list and choose Compare.
        </p>
      ) : null}
    </div>
  );
}
