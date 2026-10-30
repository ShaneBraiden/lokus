import { useEffect, useState, type ReactNode } from 'react';
import type { EvidenceView, FindingView } from '@lokus/shared';
import { formatDateTime } from '@/lib/format';
import { Badge, EmptyState, Tabs, TabsContent, TabsList, TabsTrigger, cn } from '@/ui';

export type EvidenceTab = 'w1' | 'w2' | 'timeline';
export interface EvidenceTarget {
  tab: EvidenceTab;
  id: string;
  nonce: number;
}

const mins = (m: number | null | undefined) => (m === null || m === undefined ? '—' : m < 1 ? `${Math.round(m * 60)}s` : `${Math.floor(m)}m ${String(Math.round((m % 1) * 60)).padStart(2, '0')}s`);

function Section({ id, title, children, aside }: { id?: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border border-line bg-surface p-4 shadow-card target:ring-2 target:ring-accent/30">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {aside && <span className="text-xs text-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function Text({ children, empty = 'Nothing written.' }: { children: string; empty?: string }) {
  return children.trim() ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{children}</p> : <p className="text-sm italic text-faint">{empty}</p>;
}

function FindingRow({ f }: { f: FindingView }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={cn('rounded-lg border border-line p-3', f.withdrawn && 'opacity-60')}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        <span className="mt-px rounded bg-subtle px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-2">{f.id}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">
            {f.target}
            {f.location && <span className="font-normal text-muted"> · {f.location}</span>}
          </span>
          <span className="block text-xs text-muted">
            {f.finding_type}
            {f.severity && ` · ${f.severity}`}
            {f.status && ` · ${f.status}`} · +{mins(f.at_min)}
          </span>
        </span>
        {f.withdrawn && <Badge>Withdrawn</Badge>}
      </button>
      {open && (
        <div className="mt-3 grid gap-3 border-t border-line pt-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-muted">Observed issue</p>
            <Text>{f.observed_issue}</Text>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted">Recommended action</p>
            <Text>{f.action}</Text>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold text-muted">Query to site</p>
            <Text empty="No query drafted.">{f.query_text}</Text>
          </div>
          {f.reference_codes.length > 0 && (
            <p className="text-xs text-muted sm:col-span-2">
              References: <span className="font-mono text-ink-2">{f.reference_codes.join(', ')}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function Mail({ to, cc, subject, body, at }: { to: string[]; cc: string[]; subject: string; body: string; at: string }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-sm font-medium text-ink">{subject}</p>
      <p className="text-xs text-muted">
        To {to.join(', ')}
        {cc.length > 0 && ` · Cc ${cc.join(', ')}`} · {at}
      </p>
      <div className="mt-2">
        <Text>{body}</Text>
      </div>
    </div>
  );
}

/**
 * The candidate's work as recorded, in three tabs. Used by assessors (pseudonymised), admins and employers.
 * Nothing here says whether a finding was "right"; it shows what the candidate did and when.
 */
export function EvidencePanel({ evidence, target }: { evidence: EvidenceView; target?: EvidenceTarget | null }) {
  const [tab, setTab] = useState<EvidenceTab>('w1');
  const { t1, t2 } = evidence;

  useEffect(() => {
    if (!target) return;
    setTab(target.tab);
    const t = window.setTimeout(() => document.getElementById(target.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => window.clearTimeout(t);
  }, [target]);

  const active = t1.findings.filter((f) => !f.withdrawn);
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as EvidenceTab)}>
      <TabsList>
        <TabsTrigger value="w1">Workday 1</TabsTrigger>
        <TabsTrigger value="w2">Workday 2</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
      </TabsList>

      <TabsContent value="w1" className="mt-4 flex flex-col gap-4 outline-none">
        <dl className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-4">
          <Fact label="Time on Workday 1" value={t1.duration_min === null ? 'Not submitted' : mins(t1.duration_min)} />
          <Fact label="Findings logged" value={`${active.length}${t1.findings.length > active.length ? ` (+${t1.findings.length - active.length} withdrawn)` : ''}`} />
          <Fact label="Records opened" value={`${t1.records_opened.length} of 12`} />
          <Fact label="No deviation recorded" value={t1.no_deviation.length} />
        </dl>

        {t1.safety_signal && (
          <Section id="evidence-safety" title={`Safety signal · ${t1.safety_signal.participant_id}`}>
            <dl className="grid gap-4 sm:grid-cols-4">
              <Fact label="Record first opened" value={t1.safety_signal.first_open_min === null ? 'Never opened' : `+${mins(t1.safety_signal.first_open_min)}`} />
              <Fact label="First escalation" value={t1.safety_signal.first_escalation_min === null ? 'Not escalated' : `+${mins(t1.safety_signal.first_escalation_min)}`} />
              <Fact label="Open to escalation" value={mins(t1.safety_signal.minutes_to_escalation)} />
              <Fact label="Escalated to" value={t1.safety_signal.escalated_to.join(', ') || '—'} />
            </dl>
          </Section>
        )}

        <Section title="Findings" aside={`${active.length} active`}>
          {t1.findings.length ? (
            <ul className="flex flex-col gap-2">
              {t1.findings.map((f) => (
                <FindingRow key={f.id} f={f} />
              ))}
            </ul>
          ) : (
            <EmptyState title="No findings logged" className="py-6" />
          )}
        </Section>

        {t1.challenge_section && (
          <Section id="evidence-instruction" title={`Instruction to skip ${t1.challenge_section.label}`}>
            <dl className="grid gap-4 sm:grid-cols-4">
              <Fact label="Briefing read" value={t1.briefing_read_min === null ? '—' : `+${mins(t1.briefing_read_min)}`} />
              <Fact label="Section opened" value={t1.challenge_section.opened_at_min === null ? 'Never' : `+${mins(t1.challenge_section.opened_at_min)}`} />
              <Fact label="Times opened" value={t1.challenge_section.opens} />
              <Fact label="Findings on the section" value={t1.challenge_section.findings.join(', ') || 'None'} />
            </dl>
          </Section>
        )}

        <Section title="Safety escalations" aside={`${t1.escalations.length}`}>
          {t1.escalations.length ? (
            <div className="flex flex-col gap-2">
              {t1.escalations.map((e) => (
                <div key={e.id} className="rounded-lg border border-line p-3">
                  <p className="text-sm font-medium text-ink">
                    {e.participant_id} → {e.to.join(', ')}
                    {e.cc.length > 0 && <span className="font-normal text-muted"> · Cc {e.cc.join(', ')}</span>}
                  </p>
                  <p className="text-xs text-muted">
                    +{mins(e.at_min)}
                    {e.visit && ` · ${e.visit}`}
                    {e.fields.length > 0 && ` · ${e.fields.join(', ')}`}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Text>{e.facts}</Text>
                    <Text empty="No action requested.">{e.requested_action}</Text>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">None.</p>
          )}
        </Section>

        {t1.notes.length > 0 && (
          <Section title="Messages to the team" aside={`${t1.notes.length}`}>
            <div className="flex flex-col gap-2">
              {t1.notes.map((n) => (
                <Mail key={n.id} to={n.to} cc={[]} subject={n.subject} body={n.text} at={`+${mins(n.at_min)}`} />
              ))}
            </div>
          </Section>
        )}

        {(t1.source_edits.length > 0 || t1.corrections.length > 0) && (
          <Section title="Source values" aside="Changes to CRF values and recommended corrections">
            <ul className="flex flex-col gap-1.5 text-sm">
              {t1.source_edits.map((e, i) => (
                <li key={`e${i}`} className="text-ink-2">
                  {e.participant_id} · {[e.visit, e.field].filter(Boolean).join(' · ')}: {e.commits} change{e.commits === 1 ? '' : 's'}, {e.reverts} restored{e.left_changed ? ' — left changed' : ''}
                </li>
              ))}
              {t1.corrections.map((c, i) => (
                <li key={`c${i}`} className="text-ink-2">
                  {c.participant_id} · {[c.visit, c.field].filter(Boolean).join(' · ')}: correction recommended (“{c.proposed}”)
                </li>
              ))}
            </ul>
          </Section>
        )}
      </TabsContent>

      <TabsContent value="w2" className="mt-4 flex flex-col gap-4 outline-none">
        <Section id="evidence-decisions" title="Decisions on the sponsor’s requests">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="SAE report request" value={t2.decisions.sae ? `${t2.decisions.sae.label} · +${mins(t2.decisions.sae.at_min)}` : 'No decision'} />
            <Fact label="Screening waiver request" value={t2.decisions.waiver ? `${t2.decisions.waiver.label} · +${mins(t2.decisions.waiver.at_min)}` : 'No decision'} />
          </dl>
        </Section>
        <Section id="evidence-reply" title="Reply to the sponsor">
          {t2.reply ? <Mail to={t2.reply.to} cc={t2.reply.cc} subject={t2.reply.subject} body={t2.reply.body} at={`+${mins(t2.reply.at_min)}`} /> : <p className="text-sm text-muted">No reply sent.</p>}
        </Section>
        <Section id="evidence-messages" title="Other messages" aside={`${t2.messages.length}`}>
          {t2.messages.length ? (
            <div className="flex flex-col gap-2">
              {t2.messages.map((mm) => (
                <Mail key={mm.id} to={mm.to} cc={mm.cc} subject={mm.subject} body={mm.body} at={`+${mins(mm.at_min)}`} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">None.</p>
          )}
        </Section>
        <Section id="evidence-record" title="Issue record">
          <div className="grid gap-3 lg:grid-cols-2">
            {(['sae', 'waiver'] as const).map((k) => {
              const r = t2.record[k];
              return (
                <div key={k} className="rounded-lg border border-line p-3">
                  <p className="text-sm font-medium text-ink">{k === 'sae' ? 'SAE reporting request' : 'Screening waiver request'}</p>
                  {r ? (
                    <dl className="mt-2 grid gap-2 text-sm">
                      <Fact label="Status" value={r.status || '—'} />
                      <Fact label="Owner" value={r.owner || '—'} />
                      <Fact label="Next step" value={r.next_step || '—'} />
                      <div>
                        <dt className="text-xs text-muted">Summary</dt>
                        <dd>
                          <Text>{r.summary}</Text>
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-1 text-sm text-muted">Not recorded.</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <p className="text-xs font-semibold text-muted">Narrative</p>
            <Text empty="No narrative.">{t2.record.narrative}</Text>
          </div>
        </Section>
      </TabsContent>

      <TabsContent value="timeline" className="mt-4 outline-none">
        <ol className="relative flex flex-col gap-0.5 border-l border-line pl-5">
          {evidence.timeline.map((e) => (
            <li key={e.seq} id={`ev-${e.event_id}`} className="relative py-1.5 text-sm">
              <span className={cn('absolute -left-[25px] top-3 size-2 rounded-full ring-4 ring-surface', e.task === 'T1' ? 'bg-ink' : 'bg-copper')} aria-hidden />
              <span className="mr-2 inline-block w-28 text-xs text-muted tabular">{formatDateTime(e.at)}</span>
              <span className="text-ink-2">{e.label}</span>
            </li>
          ))}
        </ol>
      </TabsContent>
    </Tabs>
  );
}
