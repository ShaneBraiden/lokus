import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleCheck, ClipboardCheck, Hand, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { errorMessage, http } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, PageHeader, PageLoader, Tabs, TabsList, TabsTrigger, Table, TD, TH, THead, TR, Textarea, cn, useToast } from '@/ui';
import { AnimatePresence, m } from '@/ui/motion';
import { EvidencePanel } from '@/features/results/EvidencePanel';
import { adminKeys, usePacket, useQueue, type PacketCriterion, type ReviewPacket } from './api';

const CRITERION_SHORT: Record<string, string> = {
  T1_SEC4: 'Consent form Section 4',
  T1_QUERY: 'Query quality',
  T2_REFUSE: 'Refusing the SAE delay',
  T2_WAIV: 'Handling the waiver',
  T2_REC: 'Issue record',
  T2_TONE: 'Tone of the reply',
};

export function ReviewQueue() {
  const [scope, setScope] = useState<'open' | 'mine' | 'done'>('open');
  const queue = useQueue(scope);
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Blind review" title="Review queue" description="Candidates are shown by pseudonym. Rate the written work against the anchors; identity, employer and scores stay hidden." />
      <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
        <TabsList>
          <TabsTrigger value="open">To review</TabsTrigger>
          <TabsTrigger value="mine">Assigned to me</TabsTrigger>
          <TabsTrigger value="done">Completed</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        {queue.isLoading ? (
          <PageLoader />
        ) : queue.error ? (
          <CardBody>
            <Alert tone="danger">{errorMessage(queue.error)}</Alert>
          </CardBody>
        ) : !queue.data?.length ? (
          <EmptyState icon={<ClipboardCheck />} title={scope === 'done' ? 'No completed reviews yet' : 'Nothing waiting'}>
            {scope === 'done' ? 'Completed reviews appear here.' : 'New submissions appear here as soon as candidates finish.'}
          </EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Candidate</TH>
                <TH>Waiting</TH>
                <TH>To rate</TH>
                <TH>Status</TH>
                <TH className="sr-only">Open</TH>
              </tr>
            </THead>
            <tbody>
              {queue.data.map((item) => (
                <TR key={item.id} interactive onClick={() => navigate(`/admin/review/${item.id}`)}>
                  <TD>
                    <span className="font-medium text-ink">{item.pseudonym}</span>
                    {item.priority > 0 && <Badge className="ml-2">Employer invite</Badge>}
                  </TD>
                  <TD className="tabular">{item.status === 'done' ? formatDateTime(item.completed_at) : `${item.age_hours} h`}</TD>
                  <TD>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {item.pending.length ? <span className="text-ink-2">{item.pending.length} criteria</span> : <span className="text-muted">—</span>}
                      {item.gr_hold && (
                        <Badge tone="violet">
                          <ShieldAlert /> Hold to resolve
                        </Badge>
                      )}
                    </span>
                  </TD>
                  <TD>{item.status === 'done' ? <Badge tone="success">Complete</Badge> : item.assigned_to_me ? <Badge tone="accent">With you</Badge> : item.assignee ? <Badge>With {item.assignee}</Badge> : <Badge>Unassigned</Badge>}</TD>
                  <TD className="text-right">
                    <Link to={`/admin/review/${item.id}`} className="text-sm font-semibold text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                      Open
                    </Link>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

interface Draft {
  rating: number | null;
  rationale: string;
}

function CriterionCard({ c, draft, onChange, disabled }: { c: PacketCriterion; draft: Draft; onChange: (d: Draft) => void; disabled: boolean }) {
  const [open, setOpen] = useState(c.needs_review && !c.current);
  const auto = !c.needs_review;
  return (
    <div className={cn('rounded-xl border bg-surface shadow-card', draft.rating !== null && draft.rating !== c.current?.raw_rating ? 'border-accent-line' : 'border-line')}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-subtle font-mono text-[11px] font-semibold text-ink-2">{c.task}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{CRITERION_SHORT[c.id] ?? c.name}</span>
          <span className="block truncate text-xs text-muted">
            {c.id} · weight {c.weight}
          </span>
        </span>
        {auto ? (
          <Badge>Auto {c.auto_rating}</Badge>
        ) : c.current ? (
          <Badge tone="success">
            <CircleCheck /> {c.current.raw_rating}
          </Badge>
        ) : (
          <Badge tone="warning">To rate</Badge>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
              <p className="text-[13px] text-ink-2">{c.what_to_observe}</p>
              {c.explanation && <p className="rounded-md bg-subtle px-3 py-2 text-xs text-ink-2">{c.explanation}</p>}
              {c.cap !== null && <Alert tone="info">Capped at {c.cap}: {c.cap_reasons.join('; ')}</Alert>}
              {auto ? (
                <p className="text-sm text-muted">Scored automatically from the evidence — no rating needed.</p>
              ) : (
                <>
                  <fieldset disabled={disabled} className="flex flex-col gap-1.5">
                    <legend className="mb-1 text-xs font-semibold text-muted">Rating</legend>
                    {(['4', '3', '2', '1', '0'] as const).map((k) => {
                      const n = Number(k);
                      const selected = draft.rating === n;
                      return (
                        <label key={k} className={cn('flex cursor-pointer gap-3 rounded-lg border px-3 py-2 text-[13px] transition-colors', selected ? 'border-ink bg-subtle' : 'border-line hover:border-line-strong')}>
                          <input type="radio" name={`rate-${c.id}`} className="mt-0.5 accent-ink" checked={selected} onChange={() => onChange({ ...draft, rating: n })} />
                          <span className="w-4 shrink-0 font-semibold text-ink tabular">{k}</span>
                          <span className="text-ink-2">{c.anchors[k]}</span>
                        </label>
                      );
                    })}
                  </fieldset>
                  <Field label="Rationale" htmlFor={`why-${c.id}`} hint="Point to the evidence that places the work at this anchor.">
                    <Textarea id={`why-${c.id}`} rows={3} value={draft.rationale} disabled={disabled} onChange={(e) => onChange({ ...draft, rationale: e.target.value })} />
                  </Field>
                  {c.current && (
                    <p className="text-xs text-muted">
                      Current: {c.current.raw_rating} by {c.current.assessor} · {formatDateTime(c.current.at)}
                    </p>
                  )}
                </>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GrPanel({ packet, disabled }: { packet: ReviewPacket; disabled: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState<Record<string, 'cleared' | 'confirmed'>>({});
  const save = useMutation({
    mutationFn: (clause: 'delay' | 'waiver') => http.post(`/review/items/${packet.item.id}/gr`, { clause, disposition: choice[clause], note: notes[clause] ?? '' }),
    onSuccess: () => {
      toast.success('Disposition recorded');
      void qc.invalidateQueries({ queryKey: adminKeys.packet(packet.item.id) });
      void qc.invalidateQueries({ queryKey: ['review', 'queue'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const effect = { delay: 'Confirming caps “Refusing the SAE delay” (T2_REFUSE) at 0.', waiver: 'Confirming caps “Handling the waiver” (T2_WAIV) at 1.' };
  return (
    <Card className="border-violet-200">
      <CardHeader title="Text conflicts with a selection" description="The written reply or record appears to agree with a request the candidate declined. Read it in context, then clear or confirm each clause." />
      <CardBody className="flex flex-col gap-4">
        {packet.gr.clauses
          .filter((c) => c.fired)
          .map((c) => (
            <div key={c.clause} className="flex flex-col gap-3 rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{c.clause === 'delay' ? 'Delaying the SAE report' : 'Accepting the waiver'}</p>
                {c.disposition ? <Badge tone={c.disposition === 'cleared' ? 'success' : 'danger'}>{c.disposition === 'cleared' ? 'Cleared' : 'Confirmed'}</Badge> : <Badge tone="violet">Open</Badge>}
              </div>
              <ul className="flex flex-col gap-1">
                {c.matches.map((x, i) => (
                  <li key={i} className="rounded bg-violet-soft px-2 py-1 text-xs text-ink-2">
                    “{x}”
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Disposition">
                {(['cleared', 'confirmed'] as const).map((d) => (
                  <label key={d} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm', choice[c.clause] === d ? 'border-ink bg-subtle' : 'border-line')}>
                    <input type="radio" name={`gr-${c.clause}`} className="accent-ink" disabled={disabled} checked={choice[c.clause] === d} onChange={() => setChoice((s) => ({ ...s, [c.clause]: d }))} />
                    {d === 'cleared' ? 'Clear — not real agreement' : 'Confirm — the text agrees'}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted">{effect[c.clause]}</p>
              <Textarea rows={2} placeholder="Why?" aria-label={`Note for the ${c.clause} clause`} value={notes[c.clause] ?? ''} disabled={disabled} onChange={(e) => setNotes((s) => ({ ...s, [c.clause]: e.target.value }))} />
              <Button size="sm" className="w-fit" disabled={disabled || !choice[c.clause] || (notes[c.clause] ?? '').trim().length < 3} loading={save.isPending && save.variables === c.clause} onClick={() => save.mutate(c.clause)}>
                Save disposition
              </Button>
            </div>
          ))}
      </CardBody>
    </Card>
  );
}

export function ReviewItem() {
  const { itemId = '' } = useParams();
  const packet = usePacket(itemId);
  const qc = useQueryClient();
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const p = packet.data;

  const draftFor = (c: PacketCriterion): Draft => drafts[c.id] ?? { rating: c.current?.raw_rating ?? null, rationale: c.current?.rationale ?? '' };
  const changed = useMemo(() => (p ? p.criteria.filter((c) => c.needs_review && drafts[c.id] && (drafts[c.id].rating !== c.current?.raw_rating || drafts[c.id].rationale.trim() !== (c.current?.rationale ?? ''))) : []), [p, drafts]);
  const invalid = changed.filter((c) => drafts[c.id].rating === null || drafts[c.id].rationale.trim().length < 3);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: adminKeys.packet(itemId) });
    void qc.invalidateQueries({ queryKey: ['review', 'queue'] });
  };
  const claim = useMutation({ mutationFn: (release: boolean) => http.post(`/review/items/${itemId}/${release ? 'release' : 'claim'}`), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  const save = useMutation({
    mutationFn: () => http.post<{ pending: string[]; gr_hold: boolean; complete: boolean }>(`/review/items/${itemId}/ratings`, { ratings: changed.map((c) => ({ criterion_id: c.id, raw_rating: drafts[c.id].rating, rationale: drafts[c.id].rationale.trim() })) }),
    onSuccess: (r) => {
      setDrafts({});
      toast.success(r.complete ? 'Review complete' : 'Ratings saved', r.complete ? 'The result is now final.' : `${r.pending.length} still to rate${r.gr_hold ? ' and a hold to resolve' : ''}.`);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (packet.isLoading) return <PageLoader />;
  if (packet.error || !p) return <Alert tone="danger">{errorMessage(packet.error)}</Alert>;
  const lockedByOther = p.item.assigned && !p.item.assigned_to_me;
  const done = p.item.status === 'done';
  const needed = p.criteria.filter((c) => c.needs_review);
  const rated = needed.filter((c) => c.current).length;

  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/review" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Review queue
      </Link>
      <PageHeader
        eyebrow="Blind review"
        title={p.item.pseudonym}
        description={`In the queue since ${formatDateTime(p.item.created_at)}. ${rated} of ${needed.length} reviewer criteria rated.`}
        actions={
          done ? (
            <Badge tone="success">
              <CircleCheck /> Review complete
            </Badge>
          ) : p.item.assigned_to_me ? (
            <Button variant="secondary" onClick={() => claim.mutate(true)} loading={claim.isPending}>
              Release
            </Button>
          ) : (
            <Button onClick={() => claim.mutate(false)} loading={claim.isPending} disabled={lockedByOther}>
              <Hand /> {lockedByOther ? 'With another assessor' : 'Claim'}
            </Button>
          )
        }
      />
      {lockedByOther && <Alert tone="warning">Another assessor is reviewing this candidate. You can read the packet, but ratings are disabled.</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <EvidencePanel evidence={p.evidence} />
        </div>
        <aside className="flex flex-col gap-3 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:self-start xl:overflow-y-auto xl:pb-2">
          {p.gr.fired && <GrPanel packet={p} disabled={lockedByOther || done} />}
          {p.criteria.map((c) => (
            <CriterionCard key={c.id} c={c} draft={draftFor(c)} disabled={lockedByOther || done} onChange={(d) => setDrafts((s) => ({ ...s, [c.id]: d }))} />
          ))}
          {!done && (
            <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur">
              <p className="text-xs text-muted">{changed.length ? `${changed.length} change${changed.length === 1 ? '' : 's'} to save${invalid.length ? ' · add a rating and rationale to each' : ''}` : 'No unsaved changes'}</p>
              <Button onClick={() => save.mutate()} disabled={!changed.length || invalid.length > 0 || lockedByOther} loading={save.isPending}>
                Save ratings
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
