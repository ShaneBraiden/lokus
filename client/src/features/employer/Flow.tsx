import { ChevronRight, CirclePause, CircleX, FileSpreadsheet, Layers, Rocket, UserCheck } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge, cn, type BadgeTone } from '@/ui';
import type { DecisionKey } from './api';

export const DECISION_META: Record<DecisionKey, { label: string; tone: BadgeTone; icon: ReactNode; meaning: string }> = {
  advance: { label: 'Advance', tone: 'accent', icon: <Rocket />, meaning: 'Move to the next stage' },
  hold: { label: 'Hold', tone: 'warning', icon: <CirclePause />, meaning: 'Keep under consideration' },
  decline: { label: 'Decline', tone: 'danger', icon: <CircleX />, meaning: 'Do not progress' },
};

export function DecisionBadge({ decision, className }: { decision: DecisionKey; className?: string }) {
  const meta = DECISION_META[decision];
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.icon}
      {meta.label}
    </Badge>
  );
}

/** The one simulation employers assess with. Shown on the overview card and the assessment dashboard. */
export const SIMULATION = {
  product: 'NorthrSim',
  title: 'Clinical Trial Associate',
  meta: 'Two proctored workdays · Rubric v1.1',
  description: 'Assess real-world readiness for clinical trial operations, with a focus on data integrity, protocol compliance and stakeholder communication.',
  goal: 'Identify candidates who can apply clinical research knowledge in realistic scenarios, show integrity under sponsor pressure, and communicate clearly with the study team.',
};

export type FlowStep = 1 | 2 | 3;

const STEPS: { step: FlowStep; label: string; icon: ReactNode }[] = [
  { step: 1, label: 'Overview', icon: <Layers /> },
  { step: 2, label: 'Assessment dashboard', icon: <FileSpreadsheet /> },
  { step: 3, label: 'Candidate review', icon: <UserCheck /> },
];

/**
 * The employer journey in three steps: overview → assessment dashboard → candidate review.
 * Step 3 links to the first candidate with a result, when there is one.
 */
export function FlowStepper({ current, candidateTo }: { current: FlowStep; candidateTo?: string | null }) {
  const to: Record<FlowStep, string | null> = { 1: '/org', 2: '/org/candidates', 3: candidateTo ?? null };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs shadow-card">
      <p className="flex items-center gap-1.5 text-faint">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">Sequential workflow</span>
        <span className="hidden sm:inline">· Follow the 3-step candidate pipeline</span>
      </p>
      <nav aria-label="Workflow steps" className="flex flex-wrap items-center gap-1.5">
        {STEPS.map((s, i) => {
          const cls = cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors [&_svg]:size-3.5',
            s.step === current ? 'bg-accent font-semibold text-white shadow-sm' : s.step < current ? 'font-medium text-success hover:bg-success-soft' : 'text-muted hover:bg-subtle hover:text-ink',
          );
          const body = (
            <>
              {s.icon}
              <span>
                {s.step}. {s.label}
              </span>
            </>
          );
          const target = to[s.step];
          return (
            <Fragment key={s.step}>
              {i > 0 && <ChevronRight className="size-3.5 text-faint" aria-hidden />}
              {target && s.step !== current ? (
                <Link to={target} className={cls}>
                  {body}
                </Link>
              ) : (
                <span className={cn(cls, !target && s.step !== current && 'cursor-default opacity-60 hover:bg-transparent')} aria-current={s.step === current ? 'step' : undefined}>
                  {body}
                </span>
              )}
            </Fragment>
          );
        })}
      </nav>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 text-faint" aria-hidden />}
            {it.to ? (
              <Link to={it.to} className="hover:text-ink">
                {it.label}
              </Link>
            ) : (
              <span className="font-medium text-ink" aria-current="page">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Small uppercase label above editorial (serif) headings. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[11px] font-bold uppercase tracking-[0.12em] text-accent', className)}>{children}</p>;
}
