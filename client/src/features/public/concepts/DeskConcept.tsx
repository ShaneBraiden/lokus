import { FileSearch, Lock, Mail, Scale, ShieldCheck, Users } from 'lucide-react';
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { cn } from '@/ui/cn';
import { Logo } from '@/ui/misc';
import { EASE_OUT, m } from '@/ui/motion';
import {
  AccountKeys,
  Barcode,
  BinderClip,
  ConceptSwitcher,
  DrawnIcon,
  EmailPrintout,
  Handwriting,
  INK,
  InkStroke,
  Key,
  Marker,
  Paperclip,
  PEN_APPROACH,
  PEN_DRAW,
  Receipt,
  ResultReport,
  Sheet,
  SpecimenCrf,
  Stamp,
  StampDown,
  StickyNote,
  Tape,
  useMedia,
  useSeen,
  useSvgId,
} from './materials';

/**
 * Concept A, "The Desk": the page is the reviewer's desk seen from above. Everything readable is printed on something
 * you could pick up, and some of it you can: papers, the badge and the coffee move with a mouse.
 */
export function DeskConcept() {
  return (
    <div className="lk-real desk-surface min-h-dvh overflow-x-clip text-toner">
      <DeskHeader />
      <main>
        <Hero />
        <Facts />
        <Workdays />
        <HowScored />
        <Employers />
        <Candidates />
        <Competencies />
        <SignHere />
      </main>
      <DeskFooter />
      <ConceptSwitcher current="desk" />
    </div>
  );
}

/* ---------------------------------------------------------------- helpers */

/** Picks a desk object up with a mouse or pen and moves it; touch keeps scrolling the page. */
function useDeskDrag() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [held, setHeld] = useState(false);
  const start = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const end = () => {
    start.current = null;
    setHeld(false);
  };
  return {
    x,
    y,
    held,
    bind: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'touch' || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { px: e.clientX, py: e.clientY, x: x.get(), y: y.get() };
        setHeld(true);
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const s = start.current;
        if (!s) return;
        x.set(s.x + e.clientX - s.px);
        y.set(s.y + e.clientY - s.py);
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}

/** Something lying on the desk: it drops into place on load and can be moved about. */
function DeskObject({ children, className, rotate = 0, delay = 0, label }: { children: (held: boolean) => ReactNode; className?: string; rotate?: number; delay?: number; label?: string }) {
  const { x, y, held, bind } = useDeskDrag();
  const landed = useRef(false);
  return (
    <m.div
      className={cn('absolute select-none [@media(pointer:fine)]:cursor-grab', held && 'z-30 [@media(pointer:fine)]:cursor-grabbing', className)}
      style={{ x, y, rotate }}
      initial={{ opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: held ? 1.03 : 1 }}
      transition={{ delay: landed.current ? 0 : delay, duration: 0.55, ease: EASE_OUT }}
      onAnimationComplete={() => (landed.current = true)}
      title={label ? `${label} (drag to move)` : undefined}
      {...bind}
    >
      {children(held)}
    </m.div>
  );
}

const JITTER = [0, -0.6, 0.4, -0.3, 0.6, -0.4, 0.2, 0.5, -0.5, 0.3];
const DYMO = {
  black: 'bg-[linear-gradient(180deg,#2e2f33_0%,#151618_48%,#0b0b0c_100%)]',
  red: 'bg-[linear-gradient(180deg,#d0473a_0%,#a52a1f_52%,#861f16_100%)]',
  blue: 'bg-[linear-gradient(180deg,#3567b8_0%,#21488c_52%,#173670_100%)]',
} as const;

/** Embossed label-maker tape. The letters are punched in one by one when it scrolls into view. */
export function Dymo({ children, tone = 'black', className }: { children: string; tone?: keyof typeof DYMO; className?: string }) {
  const [ref, seen] = useSeen<HTMLSpanElement>();
  return (
    <span ref={ref} className={cn('relative inline-flex select-none items-center rounded-[3px] px-3 py-[5px] shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_2px_3px_rgb(0_0_0/0.35),0_6px_10px_-6px_rgb(0_0_0/0.4)]', DYMO[tone], className)}>
      <span className="sr-only">{children}</span>
      <span aria-hidden className="flex font-print-label text-[15px] font-bold uppercase tracking-[0.18em] text-[#f3f2ec]">
        {[...children].map((ch, i) => (
          <m.span
            key={i}
            className="inline-block whitespace-pre [text-shadow:0_1px_0_rgb(0_0_0/0.6),0_-0.5px_0_rgb(255_255_255/0.3)]"
            style={{ translate: `0 ${JITTER[i % JITTER.length]}px` }}
            initial={{ opacity: 0 }}
            animate={seen ? { opacity: 1 } : undefined}
            transition={{ delay: 0.1 + i * 0.04, duration: 0.01 }}
          >
            {ch}
          </m.span>
        ))}
      </span>
    </span>
  );
}

/** A section heading punched on label tape, with its strap line printed on a strip of paper taped to the desk. */
function SectionLabel({ children, tone, sub, className }: { children: string; tone?: keyof typeof DYMO; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-start gap-4', className)}>
      <h2 className="relative z-10 -rotate-1">
        <Dymo tone={tone}>{children}</Dymo>
      </h2>
      {sub && (
        <div className="relative -mt-2 ml-3 max-w-2xl rotate-[0.5deg]">
          <Tape className="-left-6 top-1 w-16 -rotate-[38deg]" />
          <Sheet faceClassName="px-6 py-4 sm:px-8 sm:py-5">
            <p className="font-serif text-[28px] leading-[1.12] text-toner sm:text-[36px]">{sub}</p>
          </Sheet>
        </div>
      )}
    </div>
  );
}

/** A torn paper edge, generated once from a seed so it never jitters between renders. */
export function TornEdge({ className, flip, fill = 'var(--lk-paper)' }: { className?: string; flip?: boolean; fill?: string }) {
  const d = useRef<string>('');
  if (!d.current) {
    let s = 7;
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const pts = ['M0 0', 'H1600', 'V4'];
    for (let x = 1600; x >= 0; x -= 14 + rand() * 18) pts.push(`L${x.toFixed(1)} ${(3 + rand() * 7).toFixed(1)}`);
    pts.push('L0 5 Z');
    d.current = pts.join(' ');
  }
  return (
    <svg viewBox="0 0 1600 12" preserveAspectRatio="none" className={cn('pointer-events-none block h-2.5 w-full', flip && '-scale-y-100', className)} aria-hidden>
      <path d={d.current} fill={fill} />
    </svg>
  );
}

/* ---------------------------------------------------------------- header */

function DeskHeader() {
  return (
    <header className="sticky top-0 z-50 drop-shadow-[0_6px_8px_rgb(60_45_30/0.22)]">
      <div className="paper-grain bg-paper">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-7 font-print-label text-[13px] font-semibold uppercase tracking-[0.16em] text-toner/65 md:flex">
            {[
              ['#workdays', 'Workdays'],
              ['#scoring', 'Scoring'],
              ['#employers', 'Employers'],
              ['#candidates', 'Candidates'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="relative py-1 transition-colors hover:text-toner">
                {label}
              </a>
            ))}
          </nav>
          <AccountKeys />
        </div>
      </div>
      <TornEdge />
    </header>
  );
}

/* ---------------------------------------------------------------- hero */

function Hero() {
  const reduce = useReducedMotion();
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 lg:min-h-[790px] lg:pt-14">
      {/* The memo carries the message. It stays put so its keys are easy to press. */}
      <m.div className="relative z-10 lg:w-[57%]" initial={{ opacity: 0, y: -14, scale: 1.03 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
        <Sheet className="-rotate-[0.6deg]" faceClassName="px-6 pb-9 pt-7 sm:px-11 sm:pb-11 sm:pt-9">
          <div className="flex items-center justify-between font-print-label text-[11px] font-semibold uppercase tracking-[0.24em] text-toner/50">
            <span>Memorandum</span>
            <span>Lokus · No. 01</span>
          </div>
          <dl className="mt-4 grid grid-cols-[3.4rem_1fr] gap-y-1 border-b border-toner/15 pb-4 font-print text-[13px] text-toner/75">
            <dt className="text-toner/45">To</dt>
            <dd>Anyone hiring in clinical research</dd>
            <dt className="text-toner/45">From</dt>
            <dd>Lokus</dd>
            <dt className="text-toner/45">Re</dt>
            <dd>Work-simulation assessments</dd>
          </dl>
          <h1 className="mt-7 font-serif text-[42px] leading-[1.03] tracking-[-0.015em] text-toner sm:text-[60px]">
            See how candidates{' '}
            <span className="relative inline-block whitespace-nowrap">
              <em>actually</em> work
              <InkStroke ink={INK.underline} play delay={1.0} duration={0.7} width={3} className="absolute bottom-0.5 left-0 h-3.5 w-full" />
            </span>
            , before you hire them.
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2">
            Lokus places candidates in a Clinical Trial Associate role for two realistic workdays. Every action is recorded,{' '}
            <Marker play delay={1500}>
              scored against a published rubric
            </Marker>{' '}
            and checked by trained assessors.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Key to="/signup" size="lg" arrow>
              Create a candidate account
            </Key>
            <Key to="#employers" size="lg" tone="paper">
              I&rsquo;m hiring
            </Key>
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm text-muted">
            <Lock className="size-4" aria-hidden /> Candidates decide who sees their results.
          </p>
          <span aria-hidden className="pointer-events-none absolute right-8 top-14 hidden rotate-[6deg] lg:block">
            <Handwriting play delay={2.2} className="text-[26px] leading-none">
              two real workdays
            </Handwriting>
            <InkStroke ink={INK.arrowRight} play delay={2.9} duration={0.5} className="ml-24 mt-1 h-8 w-24" />
          </span>
        </Sheet>
      </m.div>

      {/* The rest of the desk: a printed form under review, the badge, the sticky note and a coffee. */}
      <div className="relative mt-10 h-[470px] sm:h-[560px] lg:absolute lg:right-0 lg:top-8 lg:mt-0 lg:h-[740px] lg:w-[46%]">
        <DeskObject className="left-[2%] top-[6%] w-[94%] max-w-[470px] lg:left-[10%] lg:top-[9%] lg:w-[88%]" rotate={3} delay={0.15} label="Case report form">
          {(held) => (
            <div className="relative">
              <Sheet stack lifted={held} faceClassName="px-5 py-6 sm:px-7 sm:py-8">
                <SpecimenCrf className="text-[10.5px] sm:text-[12px]" annotate={{ play: true, delay: 1.2, pen: !reduce }} />
                <StampDown play delay={1.2 + PEN_APPROACH + PEN_DRAW + 1.2} rotate={-9} className="bottom-[2%] left-[6%] text-[15px] sm:text-[17px]">
                  <Stamp sub="Data review copy">Reviewed</Stamp>
                </StampDown>
              </Sheet>
              <Paperclip className="absolute -top-5 left-8 h-16 w-6 rotate-[4deg]" />
            </div>
          )}
        </DeskObject>

        <DeskObject className="left-[52%] top-[62%] hidden w-52 sm:block lg:left-[56%] lg:top-[66%]" rotate={5} delay={0.4} label="Sticky note">
          {() => (
            <StickyNote className="w-52 text-[21px]">
              Workday 1 ≈ 1 hr
              <br />
              Workday 2 ≈ 30 min
              <br />
              <span className="text-pen">saves as you go ✓</span>
            </StickyNote>
          )}
        </DeskObject>

        <DeskObject className="left-[6%] top-[73%] hidden lg:block" rotate={-14} delay={0.55} label="Visitor badge">
          {() => <Badge />}
        </DeskObject>

        <DeskObject className="right-[0%] top-[0%] hidden sm:block lg:-right-6 lg:-top-4" delay={0.3} label="Coffee">
          {() => <Mug />}
        </DeskObject>
      </div>
    </section>
  );
}

function Mug() {
  return (
    <div className="relative size-28" aria-hidden>
      <div className="absolute -right-5 top-1/2 h-11 w-10 -translate-y-1/2 rounded-r-full border-[7px] border-l-0 border-[#efe9df] shadow-[3px_4px_5px_rgb(60_45_30/0.3)]" />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff,#ece6dc_58%,#d6cdbf)] shadow-[8px_12px_18px_-6px_rgb(60_45_30/0.5),0_2px_4px_rgb(60_45_30/0.25)]" />
      <div className="absolute inset-[11%] rounded-full bg-[radial-gradient(circle_at_50%_45%,#6e4127_0%,#4b2b18_55%,#2e180b_100%)] shadow-[inset_0_3px_7px_rgb(0_0_0/0.55)]" />
      <div className="absolute inset-[11%] rounded-full bg-[radial-gradient(circle,transparent_56%,rgb(210_165_120/0.28)_63%,transparent_72%)]" />
      <div className="absolute left-[30%] top-[25%] h-[13%] w-[26%] -rotate-[25deg] rounded-full bg-white/30 blur-[2px]" />
    </div>
  );
}

/** The new starter's visitor badge on its lanyard, lying where it was dropped. */
function Badge() {
  const id = useSvgId();
  const strap = 'M86 4 C 60 -50, -40 -40, -90 10 C -140 60, -120 160, -40 170 C 30 178, 96 80, 98 4';
  return (
    <div className="relative w-[180px]" aria-hidden>
      <svg className="pointer-events-none absolute left-0 top-0 size-px overflow-visible" aria-hidden>
        <defs>
          <path id={id} d={strap} />
        </defs>
        <path d={strap} fill="none" stroke="rgb(60 45 30 / 0.25)" strokeWidth="20" strokeLinecap="round" transform="translate(5 7)" style={{ filter: 'blur(3px)' }} />
        <path d={strap} fill="none" stroke="#8f4029" strokeWidth="19" strokeLinecap="round" />
        <path d={strap} fill="none" stroke="#b85f43" strokeWidth="15" strokeLinecap="round" />
        <text fontSize="8.5" fontWeight="700" letterSpacing="3" fill="#fff" fillOpacity=".8" dy="3">
          <textPath href={`#${id}`}>LOKUS • LOKUS • LOKUS • LOKUS • LOKUS • LOKUS • LOKUS • LOKUS • LOKUS •</textPath>
        </text>
      </svg>
      <div className="relative mx-auto -mb-1 h-6 w-9 rounded-t-md bg-[linear-gradient(90deg,#8d9298,#f2f3f4_50%,#8d9298)] shadow-[0_2px_2px_rgb(0_0_0/0.25)]" />
      <div className="relative overflow-hidden rounded-xl bg-[linear-gradient(160deg,#ffffff,#f1efea)] shadow-[0_2px_3px_rgb(0_0_0/0.15),10px_16px_22px_-10px_rgb(60_45_30/0.55)]">
        <div className="mx-auto mt-2 h-2 w-10 rounded-full bg-desk shadow-[inset_0_1px_2px_rgb(60_45_30/0.45)]" />
        <div className="mt-2 bg-copper px-3 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-white">Aurous Healthcare</div>
        <div className="flex gap-3 p-3">
          <svg viewBox="0 0 40 48" className="h-16 w-14 shrink-0 rounded-sm bg-[#e4e1db]">
            <circle cx="20" cy="18" r="8" fill="#b8b2a7" />
            <path d="M5 48 C 6 34, 34 34, 35 48 Z" fill="#b8b2a7" />
          </svg>
          <div className="min-w-0 text-toner">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-copper">New starter</p>
            <p className="mt-1 text-[12px] font-semibold leading-tight">Clinical Trial Associate</p>
            <p className="mt-1 text-[10px] text-toner/60">Workdays 1–2</p>
          </div>
        </div>
        <div className="flex items-end justify-between px-3 pb-3">
          <Barcode seed="CTA-NEW" className="h-6 w-24" />
          <span className="lk-holo size-7 rounded-full opacity-80" />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- facts */

function Facts() {
  const facts = [
    ['2', 'simulated workdays'],
    ['12', 'participant records'],
    ['0', 'AI in scoring'],
    ['1', 'published rubric'],
  ] as const;
  return (
    <section aria-label="At a glance" className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6">
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-5">
        {facts.map(([n, label], i) => (
          <li key={label} style={{ rotate: `${[-1.5, 1, -0.5, 1.5][i]}deg` }}>
            <Dymo tone={i === 2 ? 'red' : 'black'}>{`${n} ${label}`}</Dymo>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------- workdays */

const PACKAGE = [
  { title: 'Protocol extract', meta: 'Version 2.1', rotate: -3, x: -10, y: 0 },
  { title: 'Informed consent form', meta: 'Version 3.0 · draft', rotate: 2, x: 12, y: 74 },
  { title: 'Data dictionary', meta: 'Version 1.3', rotate: -1.5, x: -4, y: 148 },
];

function Workdays() {
  return (
    <section id="workdays" className="scroll-mt-24 px-4 pb-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionLabel sub="Two workdays in a real role. No trick questions, just the work.">The two workdays</SectionLabel>
        <div className="mt-14">
          <Folder />
        </div>
        <InboxTray />
      </div>
    </section>
  );
}

function FolderBrief({ play }: { play: boolean }) {
  const items = ['Protocol extract', 'Informed consent form', 'Data dictionary', 'Case report forms · 12 participants'];
  return (
    <Sheet className="w-full" faceClassName="px-7 py-8">
      <p className="font-print-label text-[11px] font-semibold uppercase tracking-[0.22em] text-toner/50">Workday 1 · Data review</p>
      <p className="mt-2 font-serif text-[30px] leading-tight">About an hour.</p>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">Your first morning on the study team. Review each participant&rsquo;s case report form against the study documents, and log what you find.</p>
      <p className="mt-6 font-print-label text-[11px] font-semibold uppercase tracking-[0.22em] text-toner/50">In this folder</p>
      <ul className="mt-2 flex flex-col gap-2 font-print text-[13px]">
        {items.map((t, i) => (
          <li key={t} className="flex items-center gap-3">
            <span className="relative inline-flex size-4 shrink-0 border border-toner/60">
              <InkStroke ink={INK.check} play={play} delay={1.7 + i * 0.3} duration={0.35} className="absolute -top-1.5 left-0 h-5 w-6" />
            </span>
            {t}
          </li>
        ))}
      </ul>
      <Paperclip className="absolute -top-5 right-10 h-16 w-6 -rotate-[6deg]" />
    </Sheet>
  );
}

function FolderDocs({ play }: { play: boolean }) {
  return (
    <div className="relative min-h-[590px]">
      {PACKAGE.map((d, i) => (
        <m.div key={d.title} className="absolute inset-x-[6%] top-[4%]" initial={{ rotate: 0, x: 0, y: 0 }} animate={play ? { rotate: d.rotate, x: d.x, y: d.y } : undefined} transition={{ delay: 1.1 + i * 0.12, duration: 0.8, ease: EASE_OUT }}>
          <Sheet tone={i === 1 ? 'ivory' : 'white'} faceClassName="h-[380px] px-6 py-5">
            <p className="font-print-label text-[11px] font-semibold uppercase tracking-[0.2em] text-toner/50">{d.meta}</p>
            <p className="mt-1 font-serif text-[22px]">{d.title}</p>
            <div className="mt-4 flex flex-col gap-2">
              {[92, 84, 96, 70, 0, 88, 94, 76, 62].map((w, k) => (w ? <span key={k} className="h-1.5 rounded-full bg-toner/15" style={{ width: `${w}%` }} /> : <span key={k} className="h-1" />))}
            </div>
          </Sheet>
        </m.div>
      ))}
      <m.div className="absolute inset-x-[2%] top-[2%]" initial={{ rotate: 0, y: 0 }} animate={play ? { rotate: 1.2, y: 226 } : undefined} transition={{ delay: 1.5, duration: 0.8, ease: EASE_OUT }}>
        <Sheet faceClassName="px-5 py-6">
          <SpecimenCrf className="text-[10px] xl:text-[11px]" />
        </Sheet>
      </m.div>
    </div>
  );
}

/** Workday 1 arrives as a manila folder that opens when you reach it. */
function Folder() {
  const [ref, seen] = useSeen<HTMLDivElement>('0px 0px -30% 0px');
  const manila = 'bg-[linear-gradient(160deg,#ecd09a,#e2c086_60%,#d9b679)] shadow-[0_1px_2px_rgb(60_45_30/0.25),0_24px_40px_-18px_rgb(60_45_30/0.55)]';
  const manilaInside = 'bg-[linear-gradient(200deg,#f0d9a8,#e7c993_60%,#dfbf86)] shadow-[0_1px_2px_rgb(60_45_30/0.25),0_24px_40px_-18px_rgb(60_45_30/0.55)]';
  return (
    <div ref={ref}>
      {/* Small screens: the folder lies open, its contents one under the other. */}
      <div className={cn('relative rounded-md p-4 md:hidden', manila)}>
        <FolderBrief play={seen} />
        <div className="mt-6">
          <FolderDocs play={seen} />
        </div>
      </div>

      <div className="relative hidden grid-cols-2 [perspective:2400px] md:grid">
        {/* Inside of the back panel, with its tab, holding the documents. */}
        <div className="col-start-2 row-start-1">
          <div className={cn('relative min-h-[640px] rounded-r-md rounded-bl-sm p-6', manila)}>
            <div className="absolute -top-8 right-10 flex h-9 w-56 items-center justify-center rounded-t-lg bg-[#e6c78e] shadow-[0_-1px_2px_rgb(60_45_30/0.15)]">
              <span className="rounded-[2px] bg-paper px-3 py-0.5 font-print text-[11px] uppercase tracking-[0.18em] text-toner/80 shadow-[0_1px_1px_rgb(0_0_0/0.1)]">Workday 1 · Data review</span>
            </div>
            <FolderDocs play={seen} />
          </div>
        </div>
        {/* The cover: closed over the documents, then turned over to the left on its fold. */}
        <m.div
          className="relative col-start-2 row-start-1 origin-left [transform-style:preserve-3d]"
          initial={{ rotateY: 0 }}
          animate={seen ? { rotateY: -178.5 } : undefined}
          transition={{ delay: 0.25, duration: 1.3, ease: [0.65, 0, 0.35, 1] }}
        >
          <div className={cn('absolute inset-0 flex flex-col items-center justify-center rounded-r-md [backface-visibility:hidden]', manila)}>
            <div className="rounded-[2px] bg-paper px-6 py-4 text-center shadow-[0_1px_2px_rgb(0_0_0/0.12)]">
              <p className="font-print-label text-[11px] font-semibold uppercase tracking-[0.24em] text-toner/55">Aurous Healthcare</p>
              <p className="mt-1 font-print text-[15px] uppercase tracking-[0.16em]">Study documents</p>
            </div>
            <p className="mt-6 font-hand text-[26px] text-pen">open me →</p>
          </div>
          <div className={cn('absolute inset-0 rounded-l-md p-6 [backface-visibility:hidden] [transform:rotateY(180deg)]', manilaInside)}>
            <FolderBrief play={seen} />
          </div>
        </m.div>
      </div>
    </div>
  );
}

/** Workday 2: the morning's mail lands in a wire tray. */
function InboxTray() {
  const [ref, seen] = useSeen<HTMLDivElement>('0px 0px -25% 0px');
  return (
    <div ref={ref} className="mt-20 grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="relative mx-auto aspect-[5/6] w-full max-w-[520px]">
        <div className="absolute inset-0 rounded-[10px] border-[5px] border-[#a3a9b0] bg-[linear-gradient(135deg,rgb(255_255_255/0.08),rgb(0_0_0/0.04))] shadow-[inset_0_0_0_2px_#d5d9dd,0_2px_2px_rgb(0_0_0/0.15),0_26px_40px_-20px_rgb(60_45_30/0.55)]">
          <div className="absolute inset-3 rounded-[6px] border-2 border-[#b9bec4]/80" />
          {[25, 50, 75].map((p) => (
            <span key={p} className="absolute inset-y-3 w-[2px] bg-[#b9bec4]/70" style={{ left: `${p}%` }} />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <m.div
            key={i}
            className="absolute inset-[7%]"
            initial={{ opacity: 0, y: -90, rotate: 0 }}
            animate={seen ? { opacity: 1, y: i * 6, rotate: [-2.5, 1.8, -0.6][i] } : undefined}
            transition={{ delay: 0.3 + i * 0.45, duration: 0.7, ease: EASE_OUT }}
          >
            <Sheet className="h-full" faceClassName="px-6 py-6">
              <EmailPrintout index={i} className="text-[13px]" />
            </Sheet>
          </m.div>
        ))}
        <m.div aria-hidden className="absolute -right-6 -top-5 z-10" initial={{ opacity: 0, scale: 1.1 }} animate={seen ? { opacity: 1, scale: 1, rotate: 6 } : undefined} transition={{ delay: 1.8, duration: 0.4, ease: EASE_OUT }}>
          <StickyNote tone="pink" className="w-28 px-3 pb-3 pt-4 text-[22px]">
            3 new
          </StickyNote>
        </m.div>
      </div>
      <Sheet holes className="rotate-[1deg]" faceClassName="py-9 pl-14 pr-8">
        <p className="font-print-label text-[11px] font-semibold uppercase tracking-[0.22em] text-toner/50">Workday 2 · The inbox</p>
        <p className="mt-2 font-serif text-[30px] leading-tight">About thirty minutes.</p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">A morning inbox and a difficult request from the sponsor. Read it, decide, and reply in your own words. Your writing is what the assessors read.</p>
        <Handwriting className="mt-6 text-[24px]">progress is saved between workdays</Handwriting>
      </Sheet>
    </div>
  );
}

/* ---------------------------------------------------------------- scoring */

function HowScored() {
  const [ref, seen] = useSeen<HTMLDivElement>('0px 0px -25% 0px');
  return (
    <section id="scoring" className="scroll-mt-24 px-4 pb-28 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionLabel tone="blue" sub="How a result is made: recorded, scored, then reviewed.">
          How it is scored
        </SectionLabel>
        <div ref={ref} className="mt-16 grid gap-14 lg:grid-cols-3 lg:gap-8">
          <Step n="1" title="Recorded" body="Every action is written to an append-only record, each entry chained to the one before. Nothing can be quietly changed.">
            <div className="mx-auto w-[270px] -rotate-2">
              <Receipt play={seen} className="text-[13px]" />
            </div>
          </Step>
          <Step n="2" title="Scored" body="A deterministic engine applies the published rubric. Same work, same score, every time. No AI makes the call.">
            <CarbonCopies play={seen} />
          </Step>
          <Step n="3" title="Reviewed" body="Trained assessors rate the written work without seeing who wrote it.">
            <Redaction play={seen} />
          </Step>
        </div>
      </div>
    </section>
  );
}

function Step({ n, title, body, children }: { n: string; title: string; body: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="flex min-h-[360px] items-end justify-center">{children}</div>
      <Sheet tone="ivory" className="mt-8 rotate-[0.6deg]" faceClassName="px-5 py-4">
        <p className="flex items-baseline gap-3">
          <span className="font-hand text-[34px] font-semibold leading-none text-pen">{n}</span>
          <span className="font-serif text-[24px]">{title}</span>
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{body}</p>
      </Sheet>
    </div>
  );
}

const CRITERIA = ['Criterion 01', 'Criterion 02', 'Criterion 03', 'Criterion 04', 'Criterion 05', 'Criterion 06'];
const TICKS = [true, true, false, true, true, true];

/** Three runs of the same work, fanned out like carbon copies: the same ticks on every sheet. */
function CarbonCopies({ play }: { play: boolean }) {
  const sheets = [
    { tone: 'pink' as const, rotate: 7, x: 70, ink: '#5a3d8c', run: 3 },
    { tone: 'yellow' as const, rotate: 3, x: 36, ink: '#5a3d8c', run: 2 },
    { tone: 'white' as const, rotate: -2, x: 0, ink: 'var(--lk-pen)', run: 1 },
  ];
  return (
    <div className="relative h-[360px] w-[300px]">
      {sheets.map((s, k) => (
        <m.div key={s.run} className="absolute left-0 top-4 w-[230px]" initial={{ rotate: 0, x: 0 }} animate={play ? { rotate: s.rotate, x: s.x } : undefined} transition={{ delay: 0.2 + k * 0.1, duration: 0.8, ease: EASE_OUT }}>
          <Sheet tone={s.tone} faceClassName="px-4 py-4">
            <p className="font-print-label text-[10px] font-semibold uppercase tracking-[0.2em] text-toner/55">Scoring run {s.run}</p>
            <ul className="mt-3 flex flex-col gap-2.5 font-print text-[11.5px]">
              {CRITERIA.map((c, i) => (
                <li key={c} className="flex items-center justify-between gap-3">
                  <span className="text-toner/75">{c}</span>
                  <span className="relative inline-flex size-4 border border-toner/50">
                    {TICKS[i] && (
                      <InkStroke ink={INK.check} play={play} delay={1.1 + i * 0.22} duration={0.25} color={s.ink} width={s.run === 1 ? 2.6 : 2.2} className={cn('absolute -top-1.5 left-0 h-5 w-6', s.run !== 1 && 'blur-[0.4px]')} />
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-dashed border-toner/25 pt-2 text-right font-print text-[11px] text-toner/60">5 of 6 met</p>
          </Sheet>
        </m.div>
      ))}
    </div>
  );
}

/** A written response: the assessor never sees the name, which goes under a black marker first. */
function Redaction({ play }: { play: boolean }) {
  return (
    <div className="relative w-[290px] rotate-[1.5deg]">
      <Sheet faceClassName="px-5 py-5">
        <p className="font-print-label text-[10px] font-semibold uppercase tracking-[0.2em] text-toner/55">Written response · Workday 2</p>
        <div className="mt-3 flex items-center gap-2 font-print text-[12px]">
          <span className="text-toner/55">Candidate</span>
          <span className="relative">
            Alex Morgan
            <m.span className="absolute -inset-x-1 -inset-y-0.5 origin-left rounded-[2px] bg-[#111]" initial={{ scaleX: 0 }} animate={play ? { scaleX: 1 } : undefined} transition={{ delay: 0.5, duration: 0.7, ease: 'linear' }} />
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {[96, 90, 98, 84, 0, 94, 88, 92, 60, 0, 86, 74].map((w, k) => (w ? <span key={k} className="h-1.5 rounded-full bg-toner/20" style={{ width: `${w}%` }} /> : <span key={k} className="h-1" />))}
        </div>
        <div className="mt-5 flex items-end justify-between">
          <Handwriting play={play} delay={1.6} className="text-[20px]">
            rated blind · A3
          </Handwriting>
          <StampDown play={play} delay={2.2} rotate={-6} className="relative! text-[12px]">
            <Stamp tone="pen">Assessed</Stamp>
          </StampDown>
        </div>
      </Sheet>
      {/* The marker, travelling along the name as it covers it. */}
      <m.div aria-hidden className="pointer-events-none absolute left-[93px] top-[56px] z-10" initial={{ x: -10, opacity: 0 }} animate={play ? { x: [0, 0, 104, 150], y: [-30, 0, 0, -40], opacity: [0, 1, 1, 0] } : undefined} transition={{ delay: 0.3, duration: 1.3, times: [0, 0.15, 0.7, 1], ease: 'linear' }}>
        <PermanentMarker />
      </m.div>
    </div>
  );
}

/** A black permanent marker from above, tip down at the origin. */
function PermanentMarker() {
  return (
    <svg viewBox="0 0 40 170" className="absolute left-[-20px] top-[-168px] h-[170px] w-10 rotate-[24deg] drop-shadow-[6px_8px_4px_rgb(60_45_30/0.35)]" style={{ transformOrigin: '50% 100%' }}>
      <path d="M17 168 L14 150 H26 L23 168 Z" fill="#111" />
      <rect x="9" y="96" width="22" height="56" rx="4" fill="#1b1b1d" />
      <rect x="8" y="10" width="24" height="92" rx="6" fill="#26272a" />
      <rect x="8" y="40" width="24" height="30" fill="#e8e6e0" />
      <text x="20" y="58" fontSize="6.5" fontWeight="800" textAnchor="middle" fill="#111" transform="rotate(-90 20 56)">
        PERMANENT
      </text>
      <rect x="12" y="12" width="3" height="86" rx="1.5" fill="#fff" opacity=".18" />
    </svg>
  );
}

/* ---------------------------------------------------------------- employers */

const BENEFITS = [
  { icon: <FileSearch />, title: 'Evidence you can inspect', body: 'Every score links back to what the candidate did: findings, escalations, replies and records.' },
  { icon: <Scale />, title: 'Consistent and fair', body: 'The same workdays and the same rubric for everyone. Written work is rated by trained assessors.' },
  { icon: <ShieldCheck />, title: 'Integrity built in', body: 'Critical failures are flagged on their own. A strong average never hides them.' },
  { icon: <Users />, title: 'Your team, your candidates', body: 'Invite one by one or in bulk, follow progress and compare results side by side.' },
];
const FLAGS = ['bg-[#f9c74f]', 'bg-[#90be6d]', 'bg-[#f3a0b5]', 'bg-[#7cc6f0]'];

function Employers() {
  const [ref, seen] = useSeen<HTMLDivElement>('0px 0px -25% 0px');
  const [hover, setHover] = useState<number | null>(null);
  return (
    <section id="employers" className="scroll-mt-24 px-4 pb-28 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionLabel tone="red" sub="Hiring decisions you can explain.">
          For employers
        </SectionLabel>
        <div ref={ref} className="mt-14 grid items-start gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          {/* The report, stapled, with evidence flags down the side. Point at a flag to find its line. */}
          <div className="relative mx-auto w-full max-w-[540px] -rotate-[1.2deg] pr-10">
            <Sheet stack className="z-10" faceClassName="px-7 py-8 sm:px-9">
              <ResultReport play={seen} highlight={hover} className="text-[14px] sm:text-[15.5px]" />
            </Sheet>
            <span aria-hidden className="absolute left-5 top-4 z-20 h-1.5 w-7 rotate-[-38deg] rounded-full bg-[linear-gradient(180deg,#f2f3f4,#8d9298)] shadow-[0_1px_1px_rgb(0_0_0/0.3)]" />
            {/* Flags start under the report's edge, so only their ends show. */}
            <ul className="absolute right-0 top-[38%] z-0 flex flex-col gap-2">
              {FLAGS.map((c, i) => (
                <li key={c}>
                  <button
                    type="button"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className={cn('flex h-8 w-14 cursor-pointer items-center justify-end rounded-r-[3px] pr-2 font-hand text-[18px] font-semibold text-toner/80 shadow-[2px_2px_3px_rgb(60_45_30/0.25)] transition-transform hover:translate-x-1.5 focus-visible:translate-x-1.5', c)}
                    aria-label={`Show evidence note ${i + 1}`}
                  >
                    {i + 1}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* A legal pad of notes for hiring managers. */}
          <div className="mx-auto w-full max-w-[470px] rotate-[1.4deg]">
            <div className="overflow-hidden rounded-[3px] shadow-[0_1px_2px_rgb(0_0_0/0.12),0_22px_36px_-18px_rgb(60_45_30/0.55)]">
              <div className="h-9 bg-[linear-gradient(180deg,#9b3330,#6e1f1d)] shadow-[inset_0_-2px_0_rgb(0_0_0/0.25)]" />
              <div className="paper-grain relative bg-[#fdf5bf] pb-8 pl-14 pr-6 pt-[22px]">
                <span aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(180deg,transparent_0_31px,rgb(80_130_200/0.32)_31px_32px)] bg-[position:0_22px]" />
                <span aria-hidden className="absolute inset-y-0 left-10 w-px bg-[#e05a5a]/60" />
                <span aria-hidden className="absolute inset-y-0 left-[42px] w-px bg-[#e05a5a]/40" />
                <ul className="flex flex-col">
                  {BENEFITS.map((b) => (
                    <li key={b.title} className="relative pb-8">
                      <DrawnIcon className="absolute -left-10 top-1 [&_svg]:size-[22px]">{b.icon}</DrawnIcon>
                      <p className="font-hand text-[27px] font-semibold leading-8 text-pen">{b.title}</p>
                      <p className="text-[15px] leading-8 text-toner/85">{b.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Key to="/request-access" size="lg">
                <Mail className="size-4" aria-hidden /> Request employer access
              </Key>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- candidates */

function Candidates() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 90%', 'start 25%'] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.6 });
  const letterX = useTransform(p, [0, 1], [90, 0]);
  const letterY = useTransform(p, [0, 1], [260, 0]);
  const letterRotate = useTransform(p, [0, 1], [9, -1]);
  const [signRef, signed] = useSeen<HTMLDivElement>('0px 0px -20% 0px');
  return (
    <section id="candidates" className="scroll-mt-24 px-4 pb-28 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionLabel sub="Show the work, not just the CV.">For candidates</SectionLabel>
        <div ref={ref} className="relative mx-auto mt-14 max-w-[760px] pb-24">
          {/* The envelope it came in. */}
          <div aria-hidden className="absolute -right-2 bottom-0 h-[230px] w-[380px] rotate-[7deg] rounded-[3px] bg-[linear-gradient(170deg,#f6efe2,#ebe0cc)] shadow-[0_1px_2px_rgb(0_0_0/0.12),0_22px_32px_-16px_rgb(60_45_30/0.5)] sm:-right-36">
            <svg viewBox="0 0 380 230" preserveAspectRatio="none" className="absolute inset-0 size-full">
              <path d="M0 0 L190 128 L380 0" fill="none" stroke="#d8cbb3" strokeWidth="2" />
              <path d="M0 230 L160 112 M380 230 L220 112" fill="none" stroke="#ded3bd" strokeWidth="1.5" />
            </svg>
            <div className="absolute right-6 top-5 bg-[radial-gradient(circle,transparent_2.5px,#fbf7ef_3px)] bg-[length:8px_8px] bg-[position:-4px_-4px] p-1.5 shadow-[0_1px_1px_rgb(0_0_0/0.15)]">
              <div className="flex h-14 w-12 flex-col items-center justify-center bg-copper text-white">
                <span className="text-[8px] font-bold tracking-[0.2em]">LOKUS</span>
                <span className="font-serif text-[18px] leading-none">L</span>
              </div>
            </div>
            <span className="absolute right-14 top-11 size-16 rounded-full border-2 border-[#3b4a6b]/50 mix-blend-multiply" />
            <p className="absolute bottom-10 left-10 font-hand text-[22px] text-toner/75">To: the candidate</p>
          </div>

          {/* The letter, slid out of the envelope as you scroll to it. */}
          <m.div style={reduce ? undefined : { x: letterX, y: letterY, rotate: letterRotate }} className="relative">
            <Sheet faceClassName="px-7 py-9 sm:px-12 sm:py-12">
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-[linear-gradient(90deg,transparent,rgb(60_45_30/0.12),transparent)] shadow-[0_1px_0_rgb(255_255_255/0.7)]" />
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-[linear-gradient(90deg,transparent,rgb(60_45_30/0.12),transparent)] shadow-[0_1px_0_rgb(255_255_255/0.7)]" />
              <div className="flex items-start justify-between gap-4">
                <Logo />
                <p className="font-print text-[12px] text-toner/55">hello@lokus.example</p>
              </div>
              <p className="mt-8 font-hand text-[34px] leading-none text-pen">Dear candidate,</p>
              <p className="mt-5 font-serif text-[19px] leading-relaxed text-toner/90">
                You&rsquo;ll spend two workdays as a Clinical Trial Associate at a fictional contract research organisation. There are no trick questions, only the kind of work the job involves.
              </p>
              <ul className="mt-6 flex flex-col gap-4 text-[15px] leading-relaxed text-ink-2">
                {[
                  ['At your own pace.', 'Workday 1 takes about an hour; Workday 2 about thirty minutes. Your progress is saved in between.'],
                  ['Your result, your call.', 'Invited by an employer? They see your result for that invitation. Otherwise it is listed in the Lokus talent pool, where employers can find you.'],
                  ['Everything is inside.', 'The protocol, the data dictionary, the consent form and your team’s inbox are all part of the simulation.'],
                  ['Fair for everyone.', 'Every workday is proctored: full screen, with copy and paste switched off.'],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="relative mt-1 inline-flex size-4 shrink-0 border border-toner/60">
                      <InkStroke ink={INK.check} delay={0.2 + i * 0.25} duration={0.3} className="absolute -top-1.5 left-0 h-5 w-6" />
                    </span>
                    <span>
                      <span className="font-semibold text-toner">{title}</span> {body}
                    </span>
                  </li>
                ))}
              </ul>
              <div ref={signRef} className="mt-9">
                <p className="font-serif text-[17px] text-toner/80">Good luck,</p>
                <Handwriting play={signed} delay={0.3} duration={1.4} className="mt-1 text-[44px] leading-none">
                  The Lokus team
                </Handwriting>
              </div>
              <div className="mt-9 flex flex-wrap gap-3">
                <Key to="/signup" size="lg" arrow>
                  Create your account
                </Key>
              </div>
            </Sheet>
          </m.div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- competencies */

const COMPETENCIES = [
  ['Safety awareness', 'Recognising when something could affect the people taking part in a study, and acting on it.'],
  ['Integrity', 'Doing the right thing for the study and its participants, even when it is inconvenient.'],
  ['Data quality', 'Careful, well-documented review of study records against the study documents.'],
  ['Professional communication', 'Clear, neutral and courteous writing with colleagues, sites and sponsors.'],
];

/** Index cards, dealt out of a clipped stack once they are in view. Point at one to lift it. */
function Competencies() {
  const [ref, seen] = useSeen<HTMLDivElement>('0px 0px -25% 0px');
  const wide = useMedia('(min-width: 1024px)');
  const deal = [
    { rotate: -4, x: -414, y: 22 },
    { rotate: 1.5, x: -138, y: 0 },
    { rotate: -1, x: 138, y: 8 },
    { rotate: 3.5, x: 414, y: 26 },
  ];
  return (
    <section className="px-4 pb-28 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionLabel sub="What the Clinical Trial Associate simulation looks at.">Four competencies</SectionLabel>
        <div ref={ref} className="relative mt-16 grid gap-6 sm:grid-cols-2 lg:block lg:h-[380px]">
          <m.div aria-hidden className="absolute left-1/2 top-[-30px] z-20 hidden -translate-x-1/2 lg:block" initial={false} animate={wide && seen ? { opacity: 0, y: -20 } : { opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <BinderClip className="w-24" />
          </m.div>
          {COMPETENCIES.map(([title, body], i) => (
            <m.div
              key={title}
              className="group relative lg:absolute lg:left-1/2 lg:top-0 lg:-ml-[132px] lg:w-[264px] lg:hover:z-10"
              initial={false}
              animate={wide && seen ? deal[i] : { rotate: wide ? [-2, 1, -1, 2][i] : 0, x: 0, y: 0 }}
              transition={{ delay: 0.35 + i * 0.12, duration: 0.9, ease: EASE_OUT }}
            >
              <div className="rounded-[2px] bg-[#fffefa] bg-[linear-gradient(180deg,transparent_46px,rgb(224_90_90/0.55)_46px,rgb(224_90_90/0.55)_47.5px,transparent_47.5px),repeating-linear-gradient(180deg,transparent_0_25px,rgb(80_130_200/0.25)_25px_26px)] bg-[position:0_0,0_47px] px-5 pb-6 pt-3 shadow-[0_1px_2px_rgb(0_0_0/0.12),0_16px_24px_-14px_rgb(60_45_30/0.5)] transition-[translate,box-shadow] duration-300 lg:min-h-[250px] lg:group-hover:-translate-y-6 lg:group-hover:shadow-[0_1px_2px_rgb(0_0_0/0.12),0_30px_40px_-18px_rgb(60_45_30/0.55)]">
                <p className="flex items-baseline justify-between font-print text-[11px] uppercase tracking-[0.18em] text-toner/50">
                  <span>LKS-0{i + 1}</span>
                  <span>Competency</span>
                </p>
                <p className="mt-3 font-print text-[17px] font-semibold leading-[26px] text-toner">{title}</p>
                <p className="mt-[26px] font-print text-[13px] leading-[26px] text-toner/75">{body}</p>
              </div>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- close */

function SignHere() {
  const [ref, seen] = useSeen<HTMLDivElement>('0px 0px -20% 0px');
  return (
    <section className="px-4 pb-28 sm:px-6">
      <div ref={ref} className="relative mx-auto max-w-3xl">
        <Sheet className="-rotate-[0.5deg]" faceClassName="px-7 py-10 sm:px-14 sm:py-14">
          <p className="font-print-label text-[11px] font-semibold uppercase tracking-[0.24em] text-toner/50">Form LK-1 · Getting started</p>
          <h2 className="mt-3 font-serif text-[40px] leading-[1.05] sm:text-[52px]">Ready to see the work?</h2>
          <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-ink-2">Create an account in a minute, or talk to us about hiring with Lokus.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Key to="/signup" size="lg" arrow>
              Create account
            </Key>
            <Key to="/request-access" size="lg" tone="paper">
              Request employer access
            </Key>
          </div>
          <div className="mt-12 grid gap-8 font-print text-[12px] text-toner/55 sm:grid-cols-[1.6fr_1fr]">
            <div>
              <div className="relative h-10 border-b border-toner/40">
                <span className="absolute bottom-1 left-0 font-hand text-[26px] text-toner/40">×</span>
              </div>
              <p className="mt-1.5">Signature</p>
            </div>
            <div>
              <div className="h-10 border-b border-toner/40" />
              <p className="mt-1.5">Date</p>
            </div>
          </div>
        </Sheet>
        {/* The "sign here" flag, stuck on as it comes into view. */}
        <m.div aria-hidden className="absolute -right-3 top-[44%] hidden sm:block" initial={{ x: 60, opacity: 0, rotate: 0 }} animate={seen ? { x: 0, opacity: 1, rotate: -4 } : undefined} transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 18 }}>
          <div className="flex h-11 items-center bg-[#e0453a] pl-7 pr-4 font-print-label text-[14px] font-bold uppercase tracking-[0.16em] text-white shadow-[2px_3px_5px_rgb(60_45_30/0.35)] [clip-path:polygon(18px_0,100%_0,100%_100%,18px_100%,0_50%)]">Sign here</div>
        </m.div>
        <Tape className="-top-3 left-12 -rotate-6" />
        <Tape className="-top-3 right-12 rotate-[5deg]" />
      </div>
    </section>
  );
}

function DeskFooter() {
  return (
    <footer className="pb-20">
      <TornEdge flip />
      <div className="paper-grain bg-paper">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span>Everything on this desk is drawn in code. No stock photography.</span>
          </div>
          <nav className="flex gap-5" aria-label="Legal">
            <Link to="/legal/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link to="/legal/terms" className="hover:text-ink">
              Terms
            </Link>
            <a href="mailto:hello@lokus.example" className="hover:text-ink">
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
