import { Building, Check, FileText, Hospital, Mail, UsersRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { EASE_OUT, m } from '@/ui/motion';

/**
 * Illustrated scenes for the simulation's narrative screens (no photos). Everything shown is information the
 * candidate already has from the screen's text: who the study team is, which documents are in the package.
 */

const rise = (delay: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.7, ease: EASE_OUT } });

function Connector({ delay }: { delay: number }) {
  return (
    <m.svg viewBox="0 0 4 40" className="mx-auto h-10 w-1 overflow-visible" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay }}>
      <line x1="2" y1="0" x2="2" y2="40" stroke="var(--color-line-strong)" strokeWidth="2" strokeDasharray="4 4" className="animate-dash" />
    </m.svg>
  );
}

function Org({ icon, name, role, highlight, children, delay }: { icon: ReactNode; name: string; role: string; highlight?: boolean; children?: ReactNode; delay: number }) {
  return (
    <m.div {...rise(delay)} className={`rounded-2xl border bg-surface p-4 shadow-card ${highlight ? 'border-accent-line ring-4 ring-accent-soft' : 'border-line'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex size-10 items-center justify-center rounded-xl [&_svg]:size-5 ${highlight ? 'bg-accent text-white' : 'bg-subtle text-muted'}`}>{icon}</span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{name}</p>
          <p className="truncate text-xs text-muted">{role}</p>
        </div>
      </div>
      {children}
    </m.div>
  );
}

function Person({ initials, name, role, you }: { initials: string; name: string; role: string; you?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-canvas px-2.5 py-2">
      <span className={`flex size-7 items-center justify-center rounded-full text-[11px] font-semibold ${you ? 'bg-accent text-white' : 'bg-accent-soft text-accent'}`}>{initials}</span>
      <span className="min-w-0 text-[13px]">
        <span className="block truncate font-medium text-ink">{name}</span>
        <span className="block truncate text-xs text-muted">{role}</span>
      </span>
      {you && <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">You</span>}
    </div>
  );
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

/** Overview: the sponsor, your CRO team and the study sites, connected. */
export function StudyTeamScene({ candidateName }: { candidateName: string }) {
  return (
    <div className="flex size-full flex-col justify-center px-8 py-10">
      <Org icon={<Building />} name="Biovance Therapeutics" role="Sponsor" delay={0.1} />
      <Connector delay={0.45} />
      <Org icon={<UsersRound />} name="Aurous Healthcare" role="Contract research organisation · your team" highlight delay={0.3}>
        <div className="mt-3 flex flex-col gap-1.5">
          <Person initials="AR" name="Dr. Anjali Roy" role="Clinical Project Manager" />
          <Person initials={initialsOf(candidateName)} name={candidateName} role="Clinical Trial Associate" you />
        </div>
      </Org>
      <Connector delay={0.75} />
      <Org icon={<Hospital />} name="Study sites" role="Participants enrolled across three sites" delay={0.55} />
    </div>
  );
}

const DOCS = [
  { title: 'Protocol extract', meta: 'Version 2.1', rotate: -2.5 },
  { title: 'Informed consent form', meta: 'Version 3.0 · draft', rotate: -1 },
  { title: 'Data dictionary', meta: 'Version 1.3', rotate: 1 },
  { title: 'Case report forms', meta: '12 participants', rotate: 2.5 },
];

/** Workday 1: the review package, stacked so every document's header stays readable. */
export function DocumentsScene() {
  return (
    <div className="relative size-full">
      {DOCS.map((d, i) => (
        <m.div
          key={d.title}
          className="absolute w-[64%] rounded-2xl border border-paper-line bg-paper p-4 shadow-pop"
          style={{ left: `${16 + i * 5}%`, top: `${12 + i * 14}%` }}
          initial={{ opacity: 0, y: 36, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: d.rotate }}
          transition={{ delay: 0.15 + i * 0.14, duration: 0.85, ease: EASE_OUT }}
        >
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <FileText className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold leading-tight text-ink">{d.title}</span>
              <span className="block truncate text-[11px] text-muted">{d.meta}</span>
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            {[92, 78, 86, 64, 80, 58, 74, 66].map((w, k) => (
              <span key={k} className="h-1.5 rounded-full bg-line-strong/60" style={{ width: `${w}%` }} />
            ))}
          </div>
        </m.div>
      ))}
    </div>
  );
}

/** Workday 2: a morning inbox fills up while the clock runs. */
export function InboxScene() {
  return (
    <div className="flex size-full flex-col justify-center gap-5 px-8 py-10">
      <m.div {...rise(0.1)} className="flex items-center gap-4 self-center rounded-2xl border border-line bg-surface px-5 py-4 shadow-card">
        <svg viewBox="0 0 48 48" className="size-12">
          <circle cx="24" cy="24" r="21" fill="var(--color-canvas)" stroke="var(--color-line-strong)" strokeWidth="2" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="24" y1="5.5" x2="24" y2="8.5" stroke="var(--color-faint)" strokeWidth="1.5" transform={`rotate(${i * 30} 24 24)`} />
          ))}
          {/* Each hand's group includes an invisible dial-sized circle so it rotates about the dial's centre. */}
          <m.g animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}>
            <circle cx="24" cy="24" r="21" fill="none" />
            <line x1="24" y1="24" x2="24" y2="11" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
          </m.g>
          <m.g animate={{ rotate: 360 }} transition={{ duration: 144, repeat: Infinity, ease: 'linear' }}>
            <circle cx="24" cy="24" r="21" fill="none" />
            <line x1="24" y1="24" x2="34" y2="24" stroke="var(--color-copper)" strokeWidth="2.5" strokeLinecap="round" />
          </m.g>
          <circle cx="24" cy="24" r="2" fill="var(--color-ink)" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-ink">About 30 minutes</p>
          <p className="text-xs text-muted">The countdown is a guide</p>
        </div>
      </m.div>
      <m.div {...rise(0.25)} className="rounded-2xl border border-line bg-surface p-4 shadow-pop">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Mail className="size-4 text-muted" /> Inbox
          </span>
          <span className="text-xs text-muted">New this morning</span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <m.div key={i} className="flex items-center gap-3 rounded-xl border border-line/70 bg-canvas/70 p-2.5" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.22, duration: 0.6, ease: EASE_OUT }}>
              <span className={`size-8 shrink-0 rounded-full ${['bg-accent-soft', 'bg-[#e7ecf3]', 'bg-[#eaf3ee]', 'bg-subtle'][i]}`} />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="h-2 rounded-full bg-ink/20" style={{ width: `${[58, 66, 50, 62][i]}%` }} />
                <span className="h-1.5 rounded-full bg-line-strong/70" style={{ width: `${[86, 78, 90, 72][i]}%` }} />
              </span>
              {i < 2 && <span className="size-2 shrink-0 rounded-full bg-copper animate-pulse-ring" />}
            </m.div>
          ))}
        </div>
      </m.div>
    </div>
  );
}

function Ring({ label, delay, size = 132 }: { label: string; delay: number; size?: number }) {
  const r = 52;
  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 120 120" style={{ width: size, height: size }}>
        <circle cx="60" cy="60" r={r} fill="var(--color-surface)" stroke="var(--color-subtle)" strokeWidth="8" />
        <g transform="rotate(-90 60 60)">
          <m.circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-copper)" strokeWidth="8" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay, duration: 1.2, ease: EASE_OUT }} />
        </g>
        <m.path d="M40 61 l13 13 l27 -29" fill="none" stroke="var(--color-ink)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ delay: delay + 1, duration: 0.5, ease: EASE_OUT }} />
      </svg>
      <m.span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink shadow-card" {...rise(delay + 1.1)}>
        <Check className="size-3.5 text-success" /> {label}
      </m.span>
    </div>
  );
}

/** Completion: one ring per finished workday draws closed, then ticks. */
export function CompletionScene({ workdays }: { workdays: 1 | 2 }) {
  return (
    <div className="flex size-full items-center justify-center gap-8 px-8">
      <Ring label="Workday 1" delay={0.2} size={workdays === 1 ? 168 : 128} />
      {workdays === 2 && <Ring label="Workday 2" delay={0.6} size={128} />}
    </div>
  );
}
