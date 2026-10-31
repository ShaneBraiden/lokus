import { FileSearch, Lock, Mail, Scale, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react';
import { cn } from '@/ui/cn';
import { Logo } from '@/ui/misc';
import { m } from '@/ui/motion';
import {
  AccountKeys,
  Barcode,
  ConceptSwitcher,
  DrawnIcon,
  EmailPrintout,
  Handwriting,
  INK,
  InkStroke,
  Key,
  Marker,
  Paperclip,
  Receipt,
  ResultReport,
  SpecimenCrf,
  Stamp,
  StampDown,
  StickyNote,
  useMedia,
  useSeen,
} from './materials';

/**
 * Concept B, "The Study Binder": a clinical study binder lies open on the desk. Scrolling turns its pages; the coloured
 * divider tabs jump straight to a section. Small screens, and readers who prefer less motion, get the same pages as a
 * stack of punched sheets.
 */
export function BinderConcept() {
  const reduce = useReducedMotion();
  const roomy = useMedia('(min-width: 1024px) and (min-height: 600px)');
  return (
    <div className="lk-real desk-surface min-h-dvh overflow-x-clip text-toner">
      <header className="sticky top-0 z-50 border-b border-[#cfc6b8] bg-[#e6e0d6]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="hidden font-print text-[12px] uppercase tracking-[0.18em] text-toner/55 sm:inline">Study file · Clinical Trial Associate</span>
          </div>
          <AccountKeys />
        </div>
      </header>
      <main>{roomy && !reduce ? <Binder /> : <PageStack />}</main>
      <footer className="pb-24 pt-10 text-center font-print text-[12px] text-toner/55">
        © {new Date().getFullYear()} Lokus ·{' '}
        <Link to="/legal/privacy" className="hover:text-toner">
          Privacy
        </Link>{' '}
        ·{' '}
        <Link to="/legal/terms" className="hover:text-toner">
          Terms
        </Link>
      </footer>
      <ConceptSwitcher current="binder" />
    </div>
  );
}

/* ---------------------------------------------------------------- structure */

/** Leaves are numbered from the front cover (0). Leaf k carries faces 2k (front, read on the right) and 2k+1 (back). */
const LEAVES = 6;
const HOLE_Y = ['14%', '50%', '86%'];
const TABS = [
  { label: 'Overview', spread: 1, color: '#c96a4a' },
  { label: 'Workdays', spread: 2, color: '#3f73c4' },
  { label: 'Scoring', spread: 3, color: '#3f9a6b' },
  { label: 'Employers', spread: 4, color: '#c44b5a' },
  { label: 'Candidates', spread: 5, color: '#d9a92e' },
];
/** First page number of each section, as printed in the contents. */
const pageOf = (spread: number) => (spread === 1 ? 1 : spread * 2 - 2);

type FaceProps = { active: boolean; go: (spread: number) => void };
type FaceKind = 'cover' | 'inside' | 'page';
const FACES: { kind: FaceKind; render: (p: FaceProps) => ReactNode }[] = [
  { kind: 'cover', render: (p) => <CoverFace {...p} /> },
  { kind: 'inside', render: (p) => <ContentsFace {...p} /> },
  { kind: 'page', render: (p) => <OverviewPage {...p} /> },
  { kind: 'page', render: (p) => <Workday1Page {...p} /> },
  { kind: 'page', render: (p) => <Workday2Page {...p} /> },
  { kind: 'page', render: (p) => <ScoringPage {...p} /> },
  { kind: 'page', render: (p) => <ReviewedPage {...p} /> },
  { kind: 'page', render: (p) => <ReportPage {...p} /> },
  { kind: 'page', render: (p) => <EmployersPage {...p} /> },
  { kind: 'page', render: (p) => <LetterPage {...p} /> },
  { kind: 'page', render: (p) => <CompetenciesPage {...p} /> },
  { kind: 'page', render: (p) => <StartPage {...p} /> },
  { kind: 'inside', render: () => <BackCoverFace /> },
];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* ---------------------------------------------------------------- the binder */

function Binder() {
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 220, damping: 40, mass: 0.4 });
  const pageFloat = useTransform(smooth, (v) => v * LEAVES);
  const [current, setCurrent] = useState(0);
  useMotionValueEvent(pageFloat, 'change', (v) => setCurrent(Math.round(v)));
  // Closed, the binder is centred on its cover; it slides to centre the spread as it opens.
  const shiftX = useTransform(pageFloat, [0.15, 0.85], ['-25%', '0%']);
  const ringsOpacity = useTransform(pageFloat, [0.45, 0.6], [0, 1]);

  const go = (spread: number) => {
    const el = track.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (spread / LEAVES) * (el.offsetHeight - window.innerHeight), behavior: 'smooth' });
  };
  const goRef = useRef(go);
  goRef.current = go;

  // Arrow keys turn the page; the page settles on a spread rather than stopping mid-turn.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const now = Math.round(scrollYProgressToSpread());
      if (e.key === 'ArrowRight') goRef.current(Math.min(LEAVES, now + 1));
      else if (e.key === 'ArrowLeft') goRef.current(Math.max(0, now - 1));
      else return;
      e.preventDefault();
    };
    const scrollYProgressToSpread = () => scrollYProgress.get() * LEAVES;
    window.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const previous = html.style.scrollSnapType;
    html.style.scrollSnapType = 'y proximity';
    return () => {
      window.removeEventListener('keydown', onKey);
      html.style.scrollSnapType = previous;
    };
  }, [scrollYProgress]);

  const remaining = LEAVES - 1 - Math.max(0, current - 1);
  const turned = Math.max(0, current - 1);
  const label = current === 0 ? 'Closed' : (TABS.findLast((t) => t.spread <= current)?.label ?? 'Start');

  return (
    <section ref={track} aria-label="Study file" className="relative" style={{ height: `${LEAVES * 100 + 100}vh` }}>
      {Array.from({ length: LEAVES + 1 }, (_, s) => (
        <span key={s} aria-hidden className="absolute left-0 h-px w-px [scroll-snap-align:start]" style={{ top: `${s * 100}vh` }} />
      ))}
      <div className="sticky top-0 flex h-dvh flex-col items-center justify-center pt-16 [--ph:min(calc(100dvh_-_13.5rem),calc((100vw_-_16rem)_*_0.6667))] [--pw:calc(var(--ph)*0.75)]">
        <m.div className="relative" style={{ x: shiftX, width: 'calc(var(--pw) * 2)', height: 'var(--ph)' }}>
          {/* Back cover, under everything, with the inside back cover's pocket. */}
          <div className="lk-vinyl absolute -bottom-[14px] -right-[18px] -top-[14px] left-1/2 rounded-r-[14px] shadow-[0_2px_3px_rgb(0_0_0/0.3),0_40px_60px_-24px_rgb(40_30_20/0.6)]" />
          <div className="absolute inset-y-0 left-1/2 right-0">
            <FaceView face={12} side="right" active={current === LEAVES} go={go} />
          </div>
          {/* The thickness of the paper on each side. */}
          <PaperEdges side="right" count={remaining} />
          <PaperEdges side="left" count={turned} />
          {Array.from({ length: LEAVES }, (_, i) => (
            <Leaf key={i} index={i} pageFloat={pageFloat} current={current} go={go} />
          ))}
          <m.div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-[300] w-0" style={{ opacity: ringsOpacity }}>
            <span className="absolute -left-[calc(var(--pw)*0.02)] bottom-[6%] top-[6%] w-[calc(var(--pw)*0.04)] rounded-[3px] bg-[linear-gradient(90deg,#8e949b,#e9ebed_45%,#a7acb2)] opacity-90 shadow-[0_1px_2px_rgb(0_0_0/0.3)]" />
            {HOLE_Y.map((y) => (
              <span
                key={y}
                className="absolute h-[2.2%] w-[calc(var(--pw)*0.1)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[3px] border-[#c9cdd2] shadow-[0_3px_4px_rgb(0_0_0/0.35),inset_0_1px_0_#f6f7f8]"
                style={{ top: y }}
              />
            ))}
          </m.div>
        </m.div>
        <p aria-live="polite" className="mt-9 flex items-center gap-3 font-print text-[12px] uppercase tracking-[0.18em] text-toner/55">
          <span>{label}</span>
          <span className="text-toner/30">·</span>
          <span>
            {current} / {LEAVES}
          </span>
          <span className="hidden normal-case tracking-normal text-toner/45 xl:inline">— scroll, or use ← → to turn the page</span>
        </p>
      </div>
    </section>
  );
}

function PaperEdges({ side, count }: { side: 'left' | 'right'; count: number }) {
  const lines = Array.from({ length: count * 2 }, (_, i) => {
    const d = (i + 1) * 1.2 * (side === 'right' ? 1 : -1);
    return `${d}px ${Math.abs(d) * 0.6}px 0 ${i % 2 ? '#fbf8f1' : '#ddd5c7'}`;
  }).join(', ');
  return (
    <div
      aria-hidden
      className={cn('absolute inset-y-0 rounded-[3px] bg-paper transition-[box-shadow] duration-300', side === 'right' ? 'left-1/2 right-0' : 'left-0 right-1/2', count === 0 && 'opacity-0')}
      style={{ boxShadow: lines || 'none' }}
    />
  );
}

/** One leaf of the binder, turned about the rings as the reader scrolls. */
function Leaf({ index, pageFloat, current, go }: { index: number; pageFloat: MotionValue<number>; current: number; go: (spread: number) => void }) {
  const t = useTransform(pageFloat, (v) => clamp01((v - index - 0.18) / 0.64));
  const rotateY = useTransform(t, (x) => -180 * x * x * (3 - 2 * x));
  const zIndex = useTransform(t, (x) => (x <= 0 ? 50 - index : x >= 1 ? 50 + index : 100));
  const shade = useTransform(t, (x) => Math.sin(Math.PI * x) * 0.3);
  const tab = TABS.find((tb) => tb.spread === index);
  const tabIndex = tab ? TABS.indexOf(tab) : -1;
  const cover = index === 0;
  return (
    <m.div
      className={cn('absolute left-1/2 origin-left [transform-style:preserve-3d]', cover ? '-bottom-[14px] -top-[14px] w-[calc(50%_+_18px)]' : 'inset-y-0 w-1/2')}
      style={{ rotateY, zIndex, transformPerspective: 2600 }}
    >
      <div className="absolute inset-0 [backface-visibility:hidden]">
        <FaceView face={index * 2} side="right" active={current === index} go={go} />
        <m.div aria-hidden className="pointer-events-none absolute inset-0 rounded-r-[3px] bg-[linear-gradient(90deg,rgb(30_20_10/0.45),rgb(30_20_10/0.1))]" style={{ opacity: shade }} />
        {tab && <Tab tab={tab} slot={tabIndex} side="right" onClick={() => go(tab.spread)} />}
      </div>
      <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
        <FaceView face={index * 2 + 1} side="left" active={current === index + 1} go={go} />
        <m.div aria-hidden className="pointer-events-none absolute inset-0 rounded-l-[3px] bg-[linear-gradient(270deg,rgb(30_20_10/0.4),rgb(30_20_10/0.08))]" style={{ opacity: shade }} />
        {tab && <Tab tab={tab} slot={tabIndex} side="left" onClick={() => go(tab.spread)} />}
      </div>
    </m.div>
  );
}

/** A coloured plastic divider tab with a typed paper insert. */
function Tab({ tab, slot, side, onClick }: { tab: (typeof TABS)[number]; slot: number; side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Turn to ${tab.label}`}
      className={cn(
        'absolute flex h-[12.5%] w-[calc(var(--pw)*0.075)] min-w-8 cursor-pointer items-center justify-center shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-[filter] hover:brightness-110',
        side === 'right' ? '-right-[calc(var(--pw)*0.075)] rounded-r-[6px]' : '-left-[calc(var(--pw)*0.075)] rounded-l-[6px]',
      )}
      style={{ top: `${7 + slot * 16.5}%`, background: `linear-gradient(${side === 'right' ? 90 : 270}deg, ${tab.color}f0, ${tab.color}c8)` }}
    >
      <span className="rotate-180 rounded-[2px] bg-paper px-[3px] py-2 font-print-label text-[11px] font-bold uppercase tracking-[0.14em] text-toner/85 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)] [writing-mode:vertical-rl]">{tab.label}</span>
    </button>
  );
}

/** Draws a face: the vinyl cover, an inside cover, or a punched paper page with its spine-side holes and gutter shadow. */
function FaceView({ face, side, active, go, stacked }: { face: number; side: 'left' | 'right'; active: boolean; go: (spread: number) => void; stacked?: boolean }) {
  const f = FACES[face];
  const body = f.render({ active, go });
  const frame = stacked ? 'relative' : 'absolute inset-0';
  const inert = !stacked && !active;
  if (f.kind === 'cover')
    return (
      <div inert={inert} className={cn('lk-page lk-vinyl overflow-hidden rounded-[4px_14px_14px_4px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]', frame, stacked && 'rounded-[12px] shadow-[0_24px_40px_-20px_rgb(40_30_20/0.6)]')}>
        <span aria-hidden className="pointer-events-none absolute inset-[2.2cqw] rounded-[10px] border border-dashed border-white/15" />
        {body}
      </div>
    );
  if (f.kind === 'inside')
    return (
      <div inert={inert} className={cn('lk-page lk-vinyl', frame, side === 'right' ? 'rounded-r-[10px]' : 'rounded-l-[10px]', stacked && 'rounded-[12px] shadow-[0_24px_40px_-20px_rgb(40_30_20/0.6)]')}>
        {body}
      </div>
    );
  return (
    <div inert={inert} className={cn('lk-page paper-grain bg-paper', frame, side === 'right' ? 'rounded-r-[3px]' : 'rounded-l-[3px]', stacked && 'rounded-[3px] shadow-[0_1px_1px_rgb(0_0_0/0.08),0_18px_36px_-12px_rgb(60_45_30/0.4)]')}>
      <span aria-hidden className={cn('pointer-events-none absolute inset-y-0 w-[10%]', side === 'right' ? 'left-0 bg-[linear-gradient(90deg,rgb(60_45_30/0.14),transparent)]' : 'right-0 bg-[linear-gradient(270deg,rgb(60_45_30/0.14),transparent)]')} />
      {HOLE_Y.map((y) => (
        <span key={y} aria-hidden className={cn('absolute size-[2.6cqw] min-h-3 min-w-3 -translate-y-1/2 rounded-full bg-[#cbc2b3] shadow-[inset_0_1.5px_2px_rgb(60_45_30/0.5)]', side === 'right' ? 'left-[3.4cqw]' : 'right-[3.4cqw]')} style={{ top: y }} />
      ))}
      <div className={cn('relative flex h-full flex-col py-[6.5cqw]', side === 'right' ? 'pl-[11cqw] pr-[7cqw]' : 'pl-[7cqw] pr-[11cqw]')}>
        {body}
        <div className="mt-auto flex items-end justify-between gap-4 pt-[3cqw] font-print lk-t-xs text-toner/45">
          <span>Lokus · Study file</span>
          <span>Page {face - 1} of 10</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- small screens */

function PageStack() {
  const go = (spread: number) => document.getElementById(`face-${spread * 2}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-10 px-4 pb-10 pt-8">
      {FACES.map((_, i) => (
        <StackedFace key={i} index={i} go={go} />
      ))}
    </div>
  );
}

function StackedFace({ index, go }: { index: number; go: (spread: number) => void }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const tab = TABS.find((t) => t.spread * 2 === index);
  return (
    <div ref={ref} id={`face-${index}`} className="relative scroll-mt-24">
      {tab && (
        <span className="absolute -top-7 right-6 rounded-t-[6px] px-4 pb-2 pt-1.5 font-print-label text-[12px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_-1px_2px_rgb(0_0_0/0.15)]" style={{ background: tab.color }}>
          {tab.label}
        </span>
      )}
      <FaceView face={index} side="right" active={seen} go={go} stacked />
    </div>
  );
}

/* ---------------------------------------------------------------- shared page parts */

function SectionHead({ n, label }: { n: string; label: string }) {
  return (
    <p className="flex items-center gap-[2cqw] border-b border-toner/15 pb-[2cqw] font-print-label lk-t-xs font-semibold uppercase tracking-[0.24em] text-toner/55">
      <span className="text-copper">§ {n}</span>
      {label}
    </p>
  );
}

function LMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#a04e35" />
      <path d="M11 8v16h11" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------------------------------------------------------- faces */

function CoverFace({ go }: FaceProps) {
  return (
    <div className="relative flex h-full flex-col p-[6cqw]">
      {/* The cover sheet, in the clear sleeve on the front. */}
      <div className="paper-grain relative flex flex-1 flex-col rounded-[3px] bg-paper px-[6cqw] py-[6cqw] shadow-[0_1px_2px_rgb(0_0_0/0.35)]">
        <p className="flex justify-between font-print-label lk-t-xs font-semibold uppercase tracking-[0.3em] text-toner/55">
          <span>Study file</span>
          <span>Vol. 1</span>
        </p>
        <div className="mt-[6cqw] flex items-center gap-[2.5cqw]">
          <LMark className="size-[9cqw] min-h-9 min-w-9" />
          <span className="lk-t-2xl font-bold tracking-tight">Lokus</span>
        </div>
        <p className="mt-[1.5cqw] lk-t-sm text-toner/65">Work-simulation assessments for clinical research</p>
        <div className="my-[5cqw] h-px bg-toner/20" />
        <h1 className="font-serif lk-t-3xl leading-[1.04] tracking-[-0.01em]">See how candidates actually work, before you hire them.</h1>
        <div className="mt-[5cqw] flex flex-wrap gap-[2.4cqw]">
          <Key to="/signup" arrow>
            Create a candidate account
          </Key>
          <Key tone="paper" onClick={() => go(4)}>
            I&rsquo;m hiring
          </Key>
        </div>
        <div className="mt-auto flex items-end justify-between gap-4 pt-[4cqw]">
          <dl className="grid grid-cols-[auto_1fr] gap-x-[2.5cqw] gap-y-[0.6cqw] font-print lk-t-xs text-toner/70">
            <dt className="text-toner/45">Role</dt>
            <dd>Clinical Trial Associate</dd>
            <dt className="text-toner/45">Format</dt>
            <dd>Two workdays, in the browser</dd>
            <dt className="text-toner/45">Scoring</dt>
            <dd>Published rubric · blind review</dd>
          </dl>
          <Barcode seed="LOKUS-SF1" className="h-[6cqw] w-[22cqw]" />
        </div>
      </div>
      {/* The sleeve's glare. */}
      <span aria-hidden className="pointer-events-none absolute inset-[4.5cqw] rounded-[6px] bg-[linear-gradient(115deg,rgb(255_255_255/0.3)_0%,rgb(255_255_255/0.06)_26%,transparent_42%,transparent_72%,rgb(255_255_255/0.1)_86%,transparent)] ring-1 ring-white/25" />
      <StickyNote className="absolute bottom-[22cqw] right-[3cqw] w-[30cqw] rotate-[7deg] p-[3cqw] lk-t-lg">scroll to open ↓</StickyNote>
    </div>
  );
}

function ContentsFace({ go, active }: FaceProps) {
  return (
    <div className="relative flex h-full flex-col gap-[5cqw] p-[7cqw]">
      <div className="paper-grain relative rounded-[3px] bg-paper p-[6cqw] shadow-[0_1px_2px_rgb(0_0_0/0.35)]">
        <p className="font-print-label lk-t-xs font-semibold uppercase tracking-[0.28em] text-toner/55">Contents</p>
        <ol className="mt-[3cqw] flex flex-col">
          {TABS.map((t) => (
            <li key={t.label}>
              <button type="button" onClick={() => go(t.spread)} className="group flex w-full cursor-pointer items-baseline gap-[2cqw] py-[1.5cqw] text-left font-serif lk-t-lg">
                <span className="size-[2.2cqw] min-h-2.5 min-w-2.5 shrink-0 rounded-[2px]" style={{ background: t.color }} />
                <span className="group-hover:underline group-hover:decoration-pen group-hover:underline-offset-4">{t.label}</span>
                <span className="flex-1 -translate-y-[0.25em] border-b border-dotted border-toner/35" />
                <span className="font-print lk-t-sm text-toner/60">{pageOf(t.spread)}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-[3cqw] text-right">
          <Handwriting play={active} delay={0.8} className="lk-t-xl">
            or use the tabs →
          </Handwriting>
        </p>
      </div>
      {/* The business card in its slot. */}
      <div className="relative mt-auto self-start">
        <div className="paper-grain relative w-[56cqw] rotate-[-2deg] rounded-[3px] bg-[#fdfcf8] p-[4cqw] shadow-[0_1px_2px_rgb(0_0_0/0.35)]">
          <div className="flex items-center gap-[2cqw]">
            <LMark className="size-[6cqw] min-h-6 min-w-6" />
            <span className="lk-t-lg font-bold">Lokus</span>
          </div>
          <p className="mt-[2cqw] lk-t-xs text-toner/65">Work-simulation assessments for clinical research hiring</p>
          <p className="mt-[3cqw] font-print lk-t-xs text-toner/75">hello@lokus.example</p>
        </div>
        <span aria-hidden className="absolute -left-[1.5cqw] -top-[1.5cqw] size-[7cqw] bg-[linear-gradient(135deg,rgb(255_255_255/0.16)_50%,transparent_50%)]" />
        <span aria-hidden className="absolute -bottom-[1.5cqw] -right-[1.5cqw] size-[7cqw] bg-[linear-gradient(315deg,rgb(255_255_255/0.16)_50%,transparent_50%)]" />
      </div>
    </div>
  );
}

function OverviewPage({ active, go }: FaceProps) {
  return (
    <>
      <SectionHead n="1" label="Overview" />
      <h2 className="mt-[4.5cqw] font-serif lk-t-3xl leading-[1.04] tracking-[-0.01em]">
        See how candidates{' '}
        <span className="relative whitespace-nowrap">
          <em>actually</em> work
          <InkStroke ink={INK.underline} play={active} delay={0.6} duration={0.6} width={3} className="absolute -bottom-[0.12em] left-0 h-[0.25em] w-full" />
        </span>
        , before you hire them.
      </h2>
      <p className="mt-[4cqw] lk-t-base leading-relaxed text-ink-2">
        Lokus places candidates in a Clinical Trial Associate role for two realistic workdays. Every action is recorded,{' '}
        <Marker play={active} delay={900}>
          scored against a published rubric
        </Marker>{' '}
        and checked by trained assessors.
      </p>
      <div className="mt-[5cqw] flex flex-wrap gap-[2.4cqw]">
        <Key to="/signup" arrow>
          Create a candidate account
        </Key>
        <Key tone="paper" onClick={() => go(4)}>
          I&rsquo;m hiring
        </Key>
      </div>
      <p className="mt-[3.5cqw] flex items-center gap-2 lk-t-sm text-muted">
        <Lock className="size-4 shrink-0" aria-hidden /> Candidates decide who sees their results.
      </p>
      <table className="mt-[5cqw] w-full border-collapse border-y-[1.5px] border-toner font-print">
        <tbody>
          <tr className="divide-x divide-toner/25">
            {[
              ['2', 'simulated workdays'],
              ['12', 'participant records'],
              ['0', 'AI in scoring'],
            ].map(([n, l]) => (
              <td key={l} className="px-[2cqw] py-[2cqw] align-top">
                <span className="block font-serif lk-t-2xl leading-none text-toner">{n}</span>
                <span className="mt-[1cqw] block lk-t-xs text-toner/60">{l}</span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </>
  );
}

function Workday1Page({ active }: FaceProps) {
  return (
    <>
      <SectionHead n="2" label="The workdays" />
      <h2 className="mt-[4cqw] font-serif lk-t-2xl leading-tight">Workday 1 · Data review</h2>
      <p className="font-print lk-t-sm text-toner/55">About an hour</p>
      <p className="mt-[2.5cqw] lk-t-base leading-relaxed text-ink-2">Your first morning on the study team. Review each participant&rsquo;s case report form against the study documents, and log what you find.</p>
      <div className="relative mt-[4cqw] -rotate-[0.8deg] rounded-[2px] border border-paper-line bg-[#fffefb] p-[3cqw] shadow-[0_1px_2px_rgb(60_45_30/0.15)]">
        <SpecimenCrf className="text-[max(8px,1.75cqw)]" annotate={{ play: active, delay: 0.5, pen: true }} />
        <Paperclip className="absolute -top-[4cqw] left-[6cqw] h-[11cqw] w-[4cqw] rotate-[5deg]" />
      </div>
      <p className="mt-[3.5cqw] font-print lk-t-xs leading-relaxed text-toner/60">In the package: protocol extract · informed consent form · data dictionary · case report forms for 12 participants</p>
    </>
  );
}

function Workday2Page({ active }: FaceProps) {
  return (
    <>
      <h2 className="font-serif lk-t-2xl leading-tight">Workday 2 · The inbox</h2>
      <p className="font-print lk-t-sm text-toner/55">About thirty minutes</p>
      <p className="mt-[2.5cqw] lk-t-base leading-relaxed text-ink-2">A morning inbox and a difficult request from the sponsor. Read it, decide, and reply in your own words. Your writing is what the assessors read.</p>
      <div className="relative mt-[4cqw] h-[42cqw]">
        {[0, 1].map((i) => (
          <m.div
            key={i}
            className="absolute w-[78%] rounded-[2px] bg-[#fffefb] p-[3cqw] shadow-[0_1px_2px_rgb(60_45_30/0.2),0_10px_16px_-10px_rgb(60_45_30/0.35)]"
            style={{ left: `${i * 18}%`, top: `${i * 18}%` }}
            initial={{ rotate: 0, opacity: 0, y: -12 }}
            animate={active ? { rotate: i ? 2 : -2.5, opacity: 1, y: 0 } : undefined}
            transition={{ delay: 0.4 + i * 0.3, duration: 0.6 }}
          >
            <EmailPrintout index={i} className="text-[max(8px,1.7cqw)]" />
          </m.div>
        ))}
      </div>
      <div className="mt-[4cqw] flex items-center gap-[3cqw]">
        <StampDown play={active} delay={1.2} rotate={-6} className="relative! shrink-0 lk-t-base">
          <Stamp tone="red" sub="Every workday">
            Proctored
          </Stamp>
        </StampDown>
        <p className="lk-t-sm leading-relaxed text-ink-2">Full screen, with copy and paste switched off. Leaving the window is recorded.</p>
      </div>
      <Handwriting play={active} delay={1.8} className="mt-[3cqw] lk-t-xl">
        progress is saved between workdays
      </Handwriting>
    </>
  );
}

function StepLine({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-[3cqw]">
      <span className="font-hand lk-t-3xl font-semibold leading-none text-pen">{n}</span>
      <div>
        <p className="font-serif lk-t-xl leading-tight">{title}</p>
        <p className="mt-[1cqw] lk-t-sm leading-relaxed text-ink-2">{children}</p>
      </div>
    </div>
  );
}

function ScoringPage({ active }: FaceProps) {
  return (
    <>
      <SectionHead n="3" label="How it is scored" />
      <h2 className="mt-[4cqw] font-serif lk-t-2xl leading-tight">How a result is made.</h2>
      <div className="mt-[4.5cqw] grid grid-cols-[1fr_auto] items-start gap-[4cqw]">
        <div className="flex flex-col gap-[5cqw]">
          <StepLine n="1" title="Recorded">
            Every action is written to an append-only record, each entry chained to the one before. Nothing can be quietly changed.
          </StepLine>
          <StepLine n="2" title="Scored">
            A deterministic engine applies the published rubric. Same work, same score, every time. No AI makes the call.
          </StepLine>
        </div>
        <div className="w-[40cqw] rotate-[2.5deg]">
          <Receipt play={active} className="text-[max(7.5px,1.85cqw)]" />
        </div>
      </div>
      <div className="mt-[5cqw] flex gap-[2.5cqw]">
        {[1, 2, 3].map((run, i) => (
          <m.div
            key={run}
            className={cn('flex-1 rounded-[2px] p-[2.4cqw] shadow-[0_1px_2px_rgb(60_45_30/0.18)]', ['bg-[#fffefb]', 'bg-[#fdf2b5]', 'bg-[#f9e0df]'][i])}
            initial={{ y: 10, opacity: 0 }}
            animate={active ? { y: 0, opacity: 1, rotate: [-1.5, 1, -0.5][i] } : undefined}
            transition={{ delay: 0.6 + i * 0.2, duration: 0.5 }}
          >
            <p className="font-print-label lk-t-xs font-semibold uppercase tracking-[0.16em] text-toner/55">Run {run}</p>
            <div className="mt-[1.5cqw] flex gap-[1cqw]">
              {[true, true, false, true, true, true].map((ok, k) => (
                <span key={k} className="relative inline-flex size-[2.6cqw] min-h-2.5 min-w-2.5 border border-toner/45">
                  {ok && <InkStroke ink={INK.check} play={active} delay={1 + k * 0.12} duration={0.2} color={i ? '#5a3d8c' : 'var(--lk-pen)'} width={3} className="absolute -top-[45%] left-0 h-[150%] w-[150%]" />}
                </span>
              ))}
            </div>
            <p className="mt-[1.5cqw] font-print lk-t-xs text-toner/60">5 of 6 met</p>
          </m.div>
        ))}
      </div>
    </>
  );
}

function ReviewedPage({ active }: FaceProps) {
  return (
    <>
      <StepLine n="3" title="Reviewed, blind">
        Trained assessors rate the written work without seeing who wrote it.
      </StepLine>
      <div className="relative mt-[4cqw] rotate-[1deg] rounded-[2px] border border-paper-line bg-[#fffefb] p-[4cqw] shadow-[0_1px_2px_rgb(60_45_30/0.15)]">
        <p className="font-print-label lk-t-xs font-semibold uppercase tracking-[0.2em] text-toner/55">Written response · Workday 2</p>
        <p className="mt-[2cqw] flex items-center gap-[2cqw] font-print lk-t-sm">
          <span className="text-toner/55">Candidate</span>
          <span className="relative">
            Alex Morgan
            <m.span className="absolute -inset-x-1 -inset-y-0.5 origin-left rounded-[2px] bg-[#111]" initial={{ scaleX: 0 }} animate={active ? { scaleX: 1 } : undefined} transition={{ delay: 0.5, duration: 0.6, ease: 'linear' }} />
          </span>
        </p>
        <div className="mt-[3cqw] flex flex-col gap-[1.6cqw]">
          {[96, 90, 98, 84, 0, 94, 88, 60].map((w, k) => (w ? <span key={k} className="h-[1.1cqw] min-h-1 rounded-full bg-toner/20" style={{ width: `${w}%` }} /> : <span key={k} className="h-[1cqw]" />))}
        </div>
        <div className="mt-[3cqw] flex items-end justify-between">
          <Handwriting play={active} delay={1.2} className="lk-t-lg">
            rated blind · A3
          </Handwriting>
          <StampDown play={active} delay={1.6} rotate={-5} className="relative! lk-t-sm">
            <Stamp tone="pen">Assessed</Stamp>
          </StampDown>
        </div>
      </div>
      <div className="mt-[6cqw] rounded-[4px] border-[1.5px] border-dashed border-toner/30 p-[4cqw]">
        <p className="font-print-label lk-t-xs font-semibold uppercase tracking-[0.2em] text-toner/55">Then, the result</p>
        <div className="mt-[2.5cqw] flex items-center gap-[4cqw]">
          <StampDown play={active} delay={2.2} rotate={-7} className="relative! shrink-0 lk-t-base">
            <Stamp tone="green" sub="Final result">
              Meets bar
            </Stamp>
          </StampDown>
          <p className="lk-t-sm leading-relaxed text-ink-2">Critical failures are flagged on their own, whatever the overall score. A strong average never hides them.</p>
        </div>
      </div>
    </>
  );
}

function ReportPage({ active }: FaceProps) {
  return (
    <>
      <SectionHead n="4" label="For employers" />
      <p className="mt-[3cqw] font-print lk-t-xs text-toner/55">Specimen: what an employer receives for each candidate.</p>
      <div className="relative mt-[3cqw] rounded-[2px] border border-paper-line bg-[#fffefb] p-[5cqw] shadow-[0_1px_2px_rgb(60_45_30/0.15)]">
        <ResultReport play={active} className="text-[max(10.5px,2.45cqw)]" />
      </div>
    </>
  );
}

const BENEFITS = [
  { icon: <FileSearch />, title: 'Evidence you can inspect', body: 'Every score links back to what the candidate did.' },
  { icon: <Scale />, title: 'Consistent and fair', body: 'The same workdays and the same rubric for everyone.' },
  { icon: <ShieldCheck />, title: 'Integrity built in', body: 'Critical failures are flagged on their own.' },
  { icon: <Users />, title: 'Your team, your candidates', body: 'Invite in bulk, follow progress, compare side by side.' },
];

function EmployersPage({ active }: FaceProps) {
  return (
    <>
      <h2 className="font-serif lk-t-3xl leading-[1.05]">Hiring decisions you can explain.</h2>
      <p className="mt-[3cqw] lk-t-base leading-relaxed text-ink-2">Each result shows the outcome, a score for each workday, the competencies behind it and links to the candidate&rsquo;s actual work, so you can see why two candidates differ.</p>
      <ul className="mt-[4.5cqw] flex flex-col gap-[3.2cqw]">
        {BENEFITS.map((b) => (
          <li key={b.title} className="flex gap-[3cqw]">
            <DrawnIcon className="mt-[0.4cqw] [&_svg]:size-[max(18px,4.2cqw)]">{b.icon}</DrawnIcon>
            <div>
              <p className="font-hand lk-t-xl font-semibold leading-none text-pen">{b.title}</p>
              <p className="mt-[0.8cqw] lk-t-sm text-ink-2">{b.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-[5cqw]">
        <Key to="/request-access">
          <Mail className="size-4" aria-hidden /> Request employer access
        </Key>
      </div>
    </>
  );
}

function LetterPage({ active }: FaceProps) {
  return (
    <>
      <SectionHead n="5" label="For candidates" />
      <p className="mt-[4cqw] font-hand lk-t-2xl font-semibold leading-none text-pen">Dear candidate,</p>
      <p className="mt-[3cqw] font-serif lk-t-lg leading-relaxed text-toner/90">You&rsquo;ll spend two workdays as a Clinical Trial Associate at a fictional contract research organisation. There are no trick questions, only the kind of work the job involves.</p>
      <ul className="mt-[4cqw] flex flex-col gap-[2.6cqw] lk-t-sm leading-relaxed text-ink-2">
        {[
          ['At your own pace.', 'About an hour, then about thirty minutes. Progress is saved in between.'],
          ['Your result, your call.', 'Invited? That employer sees it. Otherwise it is listed in the talent pool, where employers can find you.'],
          ['Everything is inside.', 'The protocol, data dictionary, consent form and your team’s inbox.'],
        ].map(([title, body], i) => (
          <li key={title} className="flex gap-[2.4cqw]">
            <span className="relative mt-[0.5cqw] inline-flex size-[3cqw] min-h-3.5 min-w-3.5 shrink-0 border border-toner/60">
              <InkStroke ink={INK.check} play={active} delay={0.4 + i * 0.3} duration={0.3} className="absolute -top-[40%] left-0 h-[140%] w-[150%]" />
            </span>
            <span>
              <span className="font-semibold text-toner">{title}</span> {body}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-[5cqw] font-serif lk-t-base text-toner/80">Good luck,</p>
      <Handwriting play={active} delay={1.4} duration={1.3} className="lk-t-3xl leading-none">
        The Lokus team
      </Handwriting>
    </>
  );
}

const COMPETENCIES = [
  ['Safety awareness', 'Recognising when something could affect the people taking part in a study, and acting on it.'],
  ['Integrity', 'Doing the right thing for the study and its participants, even when it is inconvenient.'],
  ['Data quality', 'Careful, well-documented review of study records against the study documents.'],
  ['Professional communication', 'Clear, neutral and courteous writing with colleagues, sites and sponsors.'],
];

function CompetenciesPage(_: FaceProps) {
  return (
    <>
      <h2 className="font-serif lk-t-3xl leading-[1.05]">Show the work, not just the CV.</h2>
      <p className="mt-[3cqw] font-print-label lk-t-xs font-semibold uppercase tracking-[0.22em] text-toner/55">What the simulation looks at</p>
      <dl className="mt-[2cqw] divide-y divide-toner/15 border-y-[1.5px] border-toner">
        {COMPETENCIES.map(([title, body], i) => (
          <div key={title} className="grid grid-cols-[auto_1fr] gap-x-[3cqw] py-[2.4cqw]">
            <dt className="font-print lk-t-sm text-toner/50">0{i + 1}</dt>
            <dd>
              <span className="block font-serif lk-t-lg leading-tight text-toner">{title}</span>
              <span className="mt-[0.6cqw] block lk-t-sm leading-relaxed text-ink-2">{body}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-[5cqw]">
        <Key to="/signup" arrow>
          Create your account
        </Key>
      </div>
    </>
  );
}

function StartPage({ active }: FaceProps) {
  return (
    <>
      <p className="font-print-label lk-t-xs font-semibold uppercase tracking-[0.24em] text-toner/55">Form LK-1 · Getting started</p>
      <h2 className="mt-[4cqw] font-serif lk-t-3xl leading-[1.04]">Ready to see the work?</h2>
      <p className="mt-[3cqw] lk-t-base leading-relaxed text-ink-2">Create an account in a minute, or talk to us about hiring with Lokus.</p>
      <div className="mt-[5cqw] flex flex-wrap gap-[2.4cqw]">
        <Key to="/signup" arrow>
          Create account
        </Key>
        <Key to="/request-access" tone="paper">
          Request employer access
        </Key>
      </div>
      <div className="relative mt-[10cqw]">
        <div className="relative h-[8cqw] border-b border-toner/40">
          <span className="absolute bottom-[0.5cqw] left-0 font-hand lk-t-xl text-toner/40">×</span>
        </div>
        <p className="mt-[1.2cqw] font-print lk-t-xs text-toner/50">Signature</p>
        <m.div
          aria-hidden
          className="absolute -top-[9cqw] right-[2cqw] flex h-[7.5cqw] min-h-8 items-center bg-[#e0453a] pl-[5cqw] pr-[3cqw] font-print-label lk-t-sm font-bold uppercase tracking-[0.16em] text-white shadow-[2px_3px_5px_rgb(60_45_30/0.35)] [clip-path:polygon(16%_0,100%_0,100%_100%,16%_100%,0_50%)]"
          initial={{ x: 40, opacity: 0 }}
          animate={active ? { x: 0, opacity: 1, rotate: -4 } : undefined}
          transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 18 }}
        >
          Sign here
        </m.div>
      </div>
    </>
  );
}

function BackCoverFace() {
  return (
    <div className="flex h-full flex-col justify-end p-[7cqw]">
      <div className="paper-grain rounded-[3px] bg-paper p-[6cqw] shadow-[0_1px_2px_rgb(0_0_0/0.35)]">
        <div className="flex items-center gap-[2cqw]">
          <LMark className="size-[6cqw] min-h-6 min-w-6" />
          <span className="lk-t-lg font-bold">Lokus</span>
        </div>
        <p className="mt-[3cqw] lk-t-sm leading-relaxed text-ink-2">Everything in this binder is drawn in code. No stock photography, and no content from the assessment itself.</p>
        <nav aria-label="Legal" className="mt-[4cqw] flex flex-wrap gap-x-[4cqw] gap-y-2 font-print lk-t-sm">
          <Link to="/legal/privacy" className="underline-offset-4 hover:underline">
            Privacy
          </Link>
          <Link to="/legal/terms" className="underline-offset-4 hover:underline">
            Terms
          </Link>
          <a href="mailto:hello@lokus.example" className="underline-offset-4 hover:underline">
            Contact
          </a>
        </nav>
      </div>
    </div>
  );
}
