import { BellRing, Check, FileSearch, Link2, Lock, Mail, Scale, ShieldCheck, Users } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useMotionTemplate, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react';
import { cn } from '@/ui/cn';
import { Logo } from '@/ui/misc';
import { AnimatePresence, EASE_OUT, m } from '@/ui/motion';
import { AccountKeys, ConceptSwitcher, DrawnIcon, Handwriting, Key, SpecimenCrf, Stamp, StickyNote, useSeen } from './materials';

/**
 * Concept C, "A Day in the Role": an eye-level view of the new starter's desk. Scrolling moves the wall clock through the
 * day, the light in the room changes with it, and the monitor, printer and phone react to what is happening.
 */
export function WorkdayConcept() {
  return (
    <div className="lk-real min-h-dvh overflow-x-clip bg-[#2b2622] text-toner">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#f4efe6]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-6 font-print text-[12px] uppercase tracking-[0.16em] text-toner/60 md:flex">
            <a href="#day" className="hover:text-toner">
              The workday
            </a>
            <a href="#pinboard" className="hover:text-toner">
              What it measures
            </a>
          </nav>
          <AccountKeys />
        </div>
      </header>
      <main>
        <Day />
        <Pinboard />
      </main>
      <footer className="bg-[#2b2622] pb-24 pt-10 text-center font-print text-[12px] text-white/50">
        © {new Date().getFullYear()} Lokus · The whole room is drawn in code ·{' '}
        <Link to="/legal/privacy" className="hover:text-white">
          Privacy
        </Link>{' '}
        ·{' '}
        <Link to="/legal/terms" className="hover:text-white">
          Terms
        </Link>
      </footer>
      <ConceptSwitcher current="workday" />
    </div>
  );
}

/* ---------------------------------------------------------------- the story */

type Screen = 'welcome' | 'review' | 'log' | 'saved' | 'inbox' | 'lockdown' | 'done' | 'report';
type Chapter = { at: number; label: string; title: string; body: string; screen: Screen; cta?: 'hero' | 'employer' };

/** Minutes since Monday 00:00. The night between the last two chapters passes as you scroll. */
const CHAPTERS: Chapter[] = [
  {
    at: 535,
    label: 'Monday · 08:55',
    title: 'See how candidates actually work, before you hire them.',
    body: 'Lokus places candidates in a Clinical Trial Associate role for two realistic workdays. Scroll through the day.',
    screen: 'welcome',
    cta: 'hero',
  },
  {
    at: 540,
    label: '09:00 · Workday 1',
    title: 'The review package is waiting.',
    body: 'Case report forms for 12 participants, the protocol, the data dictionary and the consent form. Review them the way the job is done, and log what you find.',
    screen: 'review',
  },
  {
    at: 580,
    label: '09:40 · On the record',
    title: 'Every action is recorded.',
    body: 'Each record opened, finding logged and message sent goes into an append-only record, every entry chained to the one before.',
    screen: 'log',
  },
  {
    at: 600,
    label: '10:00 · Saved',
    title: 'About an hour, then a break.',
    body: 'Progress is saved as you go. Workday 2 takes about thirty minutes and opens whenever you are ready.',
    screen: 'saved',
  },
  {
    at: 930,
    label: '15:30 · Workday 2',
    title: 'Then the inbox fills up.',
    body: 'A morning inbox and a difficult request from the sponsor. Read it, decide, and reply in your own words.',
    screen: 'inbox',
  },
  {
    at: 945,
    label: '15:45 · Proctored',
    title: 'Fair for everyone.',
    body: 'Every workday is proctored: full screen, with copy and paste switched off. Leaving the window is recorded.',
    screen: 'lockdown',
  },
  {
    at: 960,
    label: '16:00 · Submitted',
    title: 'Done. You decide who sees it.',
    body: 'Invited by an employer? They see your result for that invitation. Otherwise it is listed in the Lokus talent pool, where employers can find you.',
    screen: 'done',
  },
  {
    at: 1440 + 550,
    label: 'Tuesday · 09:10 · The employer',
    title: 'Hiring decisions you can explain.',
    body: 'A deterministic engine scores the work against a published rubric, and trained assessors rate the writing blind. Every score links back to the evidence.',
    screen: 'report',
    cta: 'employer',
  },
];
const LAST = CHAPTERS.length - 1;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Clock time for a scroll position: it rests on each chapter's time and moves between them. */
function timeAt(v: number) {
  const i = Math.min(LAST - 1, Math.max(0, Math.floor(v)));
  const f = clamp01((v - i - 0.25) / 0.5);
  const e = f * f * (3 - 2 * f);
  return CHAPTERS[i].at + (CHAPTERS[i + 1].at - CHAPTERS[i].at) * e;
}

const DAY = [0, 330, 420, 480, 720, 960, 1050, 1110, 1200, 1440];
const WALL = ['#45414c', '#4f4a52', '#b9b0a6', '#e5dfd5', '#ece6dc', '#ebdfcb', '#dcc4a6', '#9a8c8a', '#504a55', '#45414c'];
const SKY_TOP = ['#0b1122', '#121a33', '#5d78ad', '#93bbe6', '#6fa6e3', '#7aa4d6', '#e5935f', '#5a4f7c', '#141a33', '#0b1122'];
const SKY_LOW = ['#18203a', '#2a2f55', '#f0b48c', '#f4e3cc', '#d8ecfa', '#f7dfb0', '#ffd49a', '#e0805f', '#2a2f55', '#18203a'];

function Day() {
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 32, mass: 0.5 });
  const chapterFloat = useTransform(smooth, (v) => v * LAST);
  const time = useTransform(chapterFloat, timeAt);
  const day = useTransform(time, (t) => ((t % 1440) + 1440) % 1440);
  const [chapter, setChapter] = useState(0);
  useMotionValueEvent(chapterFloat, 'change', (v) => setChapter(Math.round(v)));
  const c = CHAPTERS[chapter];

  return (
    <section id="day" ref={track} aria-label="A workday at Lokus" className="relative" style={{ height: `${LAST * 90 + 100}vh` }}>
      <div className="sticky top-0 h-dvh overflow-hidden">
        <Room day={day} time={time} chapter={chapter} />
        {/* Small screens: the chapter is told on a card under the scene. */}
        <div className="absolute inset-x-4 bottom-20 z-30 md:hidden">
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={chapter} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
              <div className="paper-grain rounded-[3px] bg-paper px-5 py-5 shadow-[0_18px_30px_-12px_rgb(0_0_0/0.5)]">
                <ChapterText chapter={c} size="sm" />
              </div>
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function ChapterText({ chapter: c, size }: { chapter: Chapter; size: 'sm' | 'lg' }) {
  const lg = size === 'lg';
  const Title = c.cta === 'hero' ? 'h1' : 'h2';
  return (
    <>
      <p className={cn('font-print uppercase tracking-[0.18em] text-copper', lg ? 'text-[max(10px,0.72cqw)]' : 'text-[11px]')}>{c.label}</p>
      <Title className={cn('mt-[0.5em] font-serif leading-[1.06] tracking-[-0.01em] text-toner', lg ? 'text-[max(22px,2.2cqw)]' : 'text-[24px]')}>{c.title}</Title>
      <p className={cn('mt-[0.8em] leading-relaxed text-ink-2', lg ? 'text-[max(13px,1.02cqw)]' : 'text-[14px]')}>{c.body}</p>
      {c.cta === 'hero' && (
        <>
          <div className={cn('flex flex-wrap gap-2.5', lg ? 'mt-[1.6cqw]' : 'mt-4')}>
            <Key to="/signup" arrow size={lg ? 'md' : 'sm'}>
              Create a candidate account
            </Key>
            <Key to="#pinboard" tone="paper" size={lg ? 'md' : 'sm'}>
              I&rsquo;m hiring
            </Key>
          </div>
          <p className={cn('flex items-center gap-2 text-muted', lg ? 'mt-[1.1cqw] text-[max(12px,0.85cqw)]' : 'mt-3 text-[12.5px]')}>
            <Lock className="size-3.5" aria-hidden /> Candidates decide who sees their results.
          </p>
        </>
      )}
      {c.cta === 'employer' && (
        <div className={cn('flex flex-wrap gap-2.5', lg ? 'mt-[1.6cqw]' : 'mt-4')}>
          <Key to="/request-access" size={lg ? 'md' : 'sm'}>
            <Mail className="size-4" aria-hidden /> Request employer access
          </Key>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- the room */

function Room({ day, time, chapter }: { day: MotionValue<number>; time: MotionValue<number>; chapter: number }) {
  const wall = useTransform(day, DAY, WALL);
  const dark = useTransform(day, [0, 330, 420, 1050, 1140, 1440], [1, 1, 0, 0, 1, 1]);
  const night = useTransform(dark, (d) => d * 0.5);
  const lampOn = useTransform(day, [0, 420, 470, 1060, 1120, 1440], [1, 1, 0, 0, 1, 1]);
  const lightLeft = useTransform(day, [450, 1060], ['58%', '8%']);
  const lightOpacity = useTransform(day, [430, 520, 1000, 1080], [0, 0.6, 0.6, 0]);
  const lightTint = useTransform(day, [480, 720, 960, 1050], ['#fff2d6', '#fffaf0', '#ffe2a8', '#ffc48a']);
  const steam = useTransform(day, [500, 560, 640, 700], [0, 0.9, 0.9, 0]);
  const screenGlow = useTransform(dark, (d) => 0.08 + d * 0.32);
  const c = CHAPTERS[chapter];

  return (
    <m.div className="lk-plaster absolute inset-0" style={{ backgroundColor: wall }}>
      {/* The stage keeps the room's proportions; the wall and the desk run on past it to the edges of the screen. */}
      <div className="absolute inset-x-0 bottom-0 top-16 [--sh:calc(var(--sw)_/_1.6)] [--st:calc((100cqh_-_var(--sh))_/_2)] [--sw:min(100cqw,160cqh)] [container-type:size] max-md:[--st:0px] max-md:[--sw:175cqw]">
        <div className="absolute inset-x-0 bottom-0 top-[calc(var(--st)_+_var(--sh)_*_0.68)]">
          <div className="lk-wood h-[calc(var(--sh)_*_0.036)] shadow-[inset_0_2px_0_rgb(255_240_215/0.35)]" />
          <div className="lk-wood h-[calc(var(--sh)_*_0.045)] brightness-[0.72] shadow-[0_10px_24px_rgb(0_0_0/0.45)]" />
          <div className="h-full bg-[linear-gradient(180deg,#5a4738,#3d3129_35%,#2b2622)]" />
        </div>

        <div className="absolute left-[calc(50cqw_-_var(--sw)_*_0.5)] top-[var(--st)] h-[var(--sh)] w-[var(--sw)] [container-type:inline-size] max-md:left-[calc(50cqw_-_var(--sw)_*_0.57)]">
          {/* Sunlight through the blinds of a window out of shot. */}
          <m.div
            aria-hidden
            className="pointer-events-none absolute top-[5%] h-[50%] w-[22%] -skew-x-[18deg] blur-[1.5px] mix-blend-soft-light"
            style={{ left: lightLeft, opacity: lightOpacity, backgroundColor: lightTint }}
          >
            <span className="absolute inset-0 bg-[repeating-linear-gradient(180deg,transparent_0_9%,rgb(0_0_0/0.85)_9%_12%)] mix-blend-multiply" />
          </m.div>

          <Window day={day} dark={dark} />
          <WallClock time={time} />
          <Corkboard chapter={chapter} />

          {/* Desk furniture. */}
          <Printer printed={chapter >= 1} />
          <PaperStack />
          <Monitor />
          <div aria-hidden className="absolute left-[45.5%] top-[66.3%] h-[1.9%] w-[19%] rounded-[3px] bg-[linear-gradient(180deg,#3a3d44,#23262c)] shadow-[0_6px_8px_-2px_rgb(0_0_0/0.45)]">
            <span className="absolute inset-x-[3%] top-[20%] h-[35%] rounded-[2px] bg-[repeating-linear-gradient(90deg,#4a4e57_0_5.5%,#2a2d33_5.5%_6.4%)]" />
          </div>
          <Phone time={time} buzzing={chapter === 4} />
          <Mug steam={steam} />
          <Lamp />

          {/* The room darkens at night; the screen, the note on the board and the lamp do not. */}
          <m.div aria-hidden className="pointer-events-none absolute -inset-[60%] bg-[#1b1733] mix-blend-multiply" style={{ opacity: night }} />
          <m.div aria-hidden className="pointer-events-none absolute left-[36%] top-[14%] h-[52%] w-[40%] rounded-[50%] bg-[#bcd2ff] mix-blend-screen blur-[60px]" style={{ opacity: screenGlow }} />
          <m.div aria-hidden className="pointer-events-none absolute left-[73%] top-[42%] h-[30%] w-[27%] bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgb(255_214_150/0.75),transparent_72%)] mix-blend-screen" style={{ opacity: lampOn }} />
          <m.div aria-hidden className="pointer-events-none absolute left-[76%] top-[64%] h-[7%] w-[22%] rounded-[50%] bg-[radial-gradient(ellipse,rgb(255_220_160/0.8),transparent_70%)] mix-blend-screen" style={{ opacity: lampOn }} />
          <MonitorScreen screen={c.screen} chapter={chapter} />
          <CorkNote chapter={chapter} />
        </div>
      </div>
    </m.div>
  );
}

function Window({ day, dark }: { day: MotionValue<number>; dark: MotionValue<number> }) {
  const top = useTransform(day, DAY, SKY_TOP);
  const low = useTransform(day, DAY, SKY_LOW);
  const sky = useMotionTemplate`linear-gradient(180deg, ${top}, ${low})`;
  const sunX = useTransform(day, [360, 1140], ['4%', '92%']);
  const sunY = useTransform(day, (d) => `${78 - 62 * Math.sin(Math.PI * clamp01((d - 360) / 780))}%`);
  const sunColor = useTransform(day, [380, 520, 720, 980, 1100], ['#ffb27a', '#fff3cf', '#fffbea', '#ffe1a0', '#ff9a5c']);
  const sunUp = useTransform(day, [360, 420, 1090, 1140], [0, 1, 1, 0]);
  return (
    <div aria-hidden className="absolute left-[69%] top-[5%] h-[40%] w-[27%]">
      <m.div className="absolute inset-[3.5%] overflow-hidden" style={{ backgroundImage: sky }}>
        <m.span className="absolute size-[11%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[1px]" style={{ left: sunX, top: sunY, opacity: sunUp, backgroundColor: sunColor, boxShadow: '0 0 40px 18px rgb(255 230 170 / 0.55)' }} />
        <span className="lk-cloud absolute left-0 top-[18%] h-[9%] w-[34%] rounded-full bg-white/60 blur-[6px]" />
        <span className="lk-cloud absolute left-0 top-[36%] h-[7%] w-[26%] rounded-full bg-white/45 blur-[6px] [animation-delay:-40s]" />
        <m.span className="absolute inset-0 bg-[radial-gradient(1px_1px_at_20%_20%,#fff,transparent),radial-gradient(1px_1px_at_60%_12%,#fff,transparent),radial-gradient(1px_1px_at_80%_30%,#fff,transparent),radial-gradient(1px_1px_at_35%_40%,#fff,transparent)]" style={{ opacity: dark }} />
        <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[42%] w-full">
          <path d="M0 120 V70 H30 V52 H58 V78 H80 V40 H112 V66 H140 V30 H160 V22 H178 V30 H196 V74 H230 V56 H262 V82 H290 V46 H322 V64 H350 V36 H380 V60 H400 V120 Z" fill="#5d6577" fillOpacity=".55" />
        </svg>
        <m.div className="absolute inset-x-0 bottom-0 h-[42%] bg-[radial-gradient(1.5px_1.5px_at_12%_70%,#ffd36e,transparent),radial-gradient(1.5px_1.5px_at_30%_62%,#ffd36e,transparent),radial-gradient(1.5px_1.5px_at_46%_40%,#ffd36e,transparent),radial-gradient(1.5px_1.5px_at_64%_78%,#ffd36e,transparent),radial-gradient(1.5px_1.5px_at_84%_55%,#ffd36e,transparent)]" style={{ opacity: dark }} />
      </m.div>
      {/* Painted frame, glazing bars and the sill. */}
      <div className="absolute inset-0 rounded-[2px] shadow-[inset_0_0_0_0.9cqw_#f3efe8,inset_0_0_0_calc(0.9cqw_+_1px)_rgb(0_0_0/0.12),0_6px_14px_-6px_rgb(0_0_0/0.35)]" />
      <div className="absolute inset-y-[3%] left-1/2 w-[0.6cqw] -translate-x-1/2 bg-[#f3efe8] shadow-[1px_0_2px_rgb(0_0_0/0.15)]" />
      <div className="absolute inset-x-[3%] top-[48%] h-[0.6cqw] bg-[#f3efe8] shadow-[0_1px_2px_rgb(0_0_0/0.15)]" />
      <div className="absolute -bottom-[4%] -left-[4%] -right-[4%] h-[5%] rounded-[2px] bg-[linear-gradient(180deg,#faf7f1,#ddd6ca)] shadow-[0_6px_10px_-4px_rgb(0_0_0/0.4)]" />
      <Plant />
    </div>
  );
}

function Plant() {
  return (
    <div className="absolute -bottom-[1%] right-[5%] h-[30%] w-[15%]">
      <svg viewBox="0 0 60 70" className="lk-sway absolute inset-x-0 bottom-[38%] h-[90%] w-full overflow-visible">
        <path d="M30 70 C 18 52, 6 40, 4 22 C 16 30, 26 44, 30 70" fill="#4f7a4a" />
        <path d="M30 70 C 34 46, 44 30, 58 18 C 56 36, 44 52, 30 70" fill="#5f8f56" />
        <path d="M30 70 C 26 44, 28 22, 34 2 C 40 22, 38 46, 30 70" fill="#6b9d5f" />
      </svg>
      <div className="absolute inset-x-[16%] bottom-[16%] h-[34%] bg-[linear-gradient(90deg,#9c5236,#c06d4a_45%,#934a30)] [clip-path:polygon(0_0,100%_0,86%_100%,14%_100%)]" />
    </div>
  );
}

function WallClock({ time }: { time: MotionValue<number> }) {
  const hour = useTransform(time, (t) => t * 0.5);
  const minute = useTransform(time, (t) => t * 6);
  return (
    <div aria-hidden className="absolute left-[50.5%] top-[4%] aspect-square w-[8.6%] rounded-full bg-[linear-gradient(145deg,#3a3d44,#16181c)] p-[0.45cqw] shadow-[0_10px_18px_-6px_rgb(0_0_0/0.5)]">
      <div className="relative size-full rounded-full bg-[radial-gradient(circle_at_40%_35%,#ffffff,#efebe4)] shadow-[inset_0_2px_6px_rgb(0_0_0/0.25)]">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="absolute left-1/2 top-[5%] h-[90%] w-[2.4%] -translate-x-1/2" style={{ rotate: `${i * 30}deg` }}>
            <span className={cn('block w-full bg-[#2a2c31]', i % 3 ? 'h-[6%]' : 'h-[11%]')} />
          </span>
        ))}
        <span className="absolute inset-x-0 top-[28%] text-center font-serif text-[0.62cqw] text-[#2a2c31]/70">Lokus</span>
        <m.span className="absolute bottom-1/2 left-1/2 h-[27%] w-[4.5%] -translate-x-1/2 origin-bottom rounded-full bg-[#1d1f23]" style={{ rotate: hour }} />
        <m.span className="absolute bottom-1/2 left-1/2 h-[38%] w-[3%] -translate-x-1/2 origin-bottom rounded-full bg-[#1d1f23]" style={{ rotate: minute }} />
        <span className="absolute inset-0">
          <span className="lk-tick absolute bottom-1/2 left-1/2 block h-[42%] w-[1.2%] -translate-x-1/2 origin-bottom bg-copper" />
        </span>
        <span className="absolute left-1/2 top-1/2 size-[7%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-copper" />
        <span className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(140deg,rgb(255_255_255/0.5),transparent_45%)]" />
      </div>
    </div>
  );
}

/** The cork board on the wall. The current chapter's note is drawn above the night shade (see CorkNote). */
function Corkboard({ chapter }: { chapter: number }) {
  return (
    <div aria-hidden className="absolute left-[3%] top-[5%] h-[52%] w-[37%] rounded-[4px] bg-[#8a6748] p-[0.7cqw] shadow-[0_14px_24px_-10px_rgb(0_0_0/0.5)] max-md:hidden">
      <div className="lk-cork relative size-full rounded-[2px] shadow-[inset_0_2px_6px_rgb(0_0_0/0.35)]">
        <div className="absolute bottom-[8%] right-[3%] w-[20%] rotate-[5deg]">
          <StickyNote tone="blue" className="p-[0.6cqw] text-[1cqw] leading-tight">
            Welcome to the team! – A.
          </StickyNote>
        </div>
        <div className="absolute right-[4%] top-[6%] w-[17%] -rotate-[3deg] rounded-[2px] bg-paper p-[0.5cqw] text-center shadow-[0_3px_5px_rgb(0_0_0/0.3)]">
          <p className="bg-copper py-[0.15cqw] font-print-label text-[0.6cqw] font-bold uppercase tracking-[0.2em] text-white">{chapter === LAST ? 'Tue' : 'Mon'}</p>
          <p className="font-serif text-[1.8cqw] leading-tight">{chapter === LAST ? '15' : '14'}</p>
        </div>
      </div>
    </div>
  );
}

function CorkNote({ chapter }: { chapter: number }) {
  const c = CHAPTERS[chapter];
  return (
    <div className="absolute left-[4.8%] top-[8.5%] w-[27.5%] max-md:hidden">
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={chapter}
          className="relative origin-top"
          initial={{ opacity: 0, y: -18, rotate: -3 }}
          animate={{ opacity: 1, y: 0, rotate: chapter % 2 ? 0.8 : -0.8 }}
          exit={{ opacity: 0, y: 26, rotate: 4 }}
          transition={{ duration: 0.32, ease: EASE_OUT }}
        >
          <div className="paper-grain rounded-[2px] bg-paper px-[2.1cqw] pb-[1.8cqw] pt-[2cqw] shadow-[0_2px_3px_rgb(0_0_0/0.25),0_16px_24px_-14px_rgb(0_0_0/0.55)]">
            <ChapterText chapter={c} size="lg" />
          </div>
          <span aria-hidden className="absolute left-1/2 top-[-0.5cqw] size-[1.3cqw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#ff7b6b,#c0281c_60%,#7d140d)] shadow-[0.3cqw_0.5cqw_0.4cqw_rgb(0_0_0/0.4)]" />
        </m.div>
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- desk objects */

function Monitor() {
  return (
    <div aria-hidden className="absolute left-[40.5%] top-[20%] h-[48.3%] w-[29%]">
      <div className="absolute inset-x-0 top-0 h-[68%] rounded-[0.7cqw] bg-[linear-gradient(180deg,#2c2f36,#17191d)] shadow-[0_18px_30px_-12px_rgb(0_0_0/0.6),inset_0_1px_0_rgb(255_255_255/0.08)]" />
      <div className="absolute left-1/2 top-[67%] h-[25%] w-[12%] -translate-x-1/2 bg-[linear-gradient(90deg,#26292f,#3c4048_50%,#24272c)]" />
      <div className="absolute bottom-0 left-1/2 h-[9%] w-[40%] -translate-x-1/2 rounded-[0.5cqw] bg-[linear-gradient(180deg,#3a3e46,#1f2226)] shadow-[0_6px_10px_-3px_rgb(0_0_0/0.55)]" />
    </div>
  );
}

/** What the monitor shows, crossfading from one chapter to the next. */
function MonitorScreen({ screen, chapter }: { screen: Screen; chapter: number }) {
  return (
    <div aria-hidden className="absolute left-[41.4%] top-[21.4%] h-[30.2%] w-[27.2%] overflow-hidden rounded-[0.3cqw] bg-[#0e1013] [container-type:inline-size]">
      <AnimatePresence initial={false}>
        <m.div key={screen} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          <ScreenView screen={screen} chapter={chapter} />
        </m.div>
      </AnimatePresence>
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgb(255_255_255/0.08)_0%,transparent_35%)]" />
    </div>
  );
}

function AppBar({ title }: { title: string }) {
  return (
    <div className="flex h-[8cqw] items-center justify-between border-b border-black/10 bg-white px-[2.5cqw] text-[2.6cqw]">
      <span className="flex items-center gap-[1.2cqw] font-semibold text-toner">
        <span className="inline-flex size-[3.6cqw] items-center justify-center rounded-[0.8cqw] bg-accent text-[2.2cqw] font-bold text-white">L</span>
        {title}
      </span>
      <span className="text-toner/50">NorthrSim</span>
    </div>
  );
}

function ScreenView({ screen, chapter }: { screen: Screen; chapter: number }) {
  if (screen === 'welcome')
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#f7f5f1] text-center">
        <span className="inline-flex size-[10cqw] items-center justify-center rounded-[2.2cqw] bg-accent text-[6cqw] font-bold text-white">L</span>
        <p className="mt-[3cqw] font-serif text-[6cqw] text-toner">Good morning.</p>
        <p className="mt-[0.5cqw] text-[3cqw] text-toner/60">Workday 1 · Data review · about an hour</p>
        <span className="mt-[4cqw] rounded-[1.4cqw] bg-copper px-[4cqw] py-[1.6cqw] text-[3cqw] font-semibold text-white shadow-[0_0.6cqw_0_#7a3925]">Start Workday 1</span>
      </div>
    );
  if (screen === 'review' || screen === 'log')
    return (
      <div className="flex h-full flex-col bg-[#ece7df]">
        <AppBar title="Workday 1 · Review" />
        <div className="flex min-h-0 flex-1">
          <div className="w-[23%] bg-white p-[1.8cqw] text-[2.3cqw]">
            <p className="font-semibold text-toner/60">Participants</p>
            {Array.from({ length: 7 }, (_, i) => (
              <p key={i} className={cn('mt-[1.2cqw] flex items-center justify-between rounded-[0.6cqw] px-[1cqw] py-[0.5cqw]', i === 2 && 'bg-accent-soft')}>
                <span className="font-print text-toner/80">SPC-0{i + 1}</span>
                {i < (screen === 'log' ? 4 : 2) && <Check className="size-[2.4cqw] text-success" />}
              </p>
            ))}
          </div>
          <div className="desk-surface flex-1 p-[2.2cqw]">
            <div className="paper-grain rounded-[0.4cqw] bg-paper p-[2cqw] shadow-[0_1cqw_2cqw_-1cqw_rgb(0_0_0/0.4)]">
              <SpecimenCrf className="text-[1.45cqw]" />
            </div>
          </div>
          <div className="w-[25%] bg-white p-[1.8cqw] text-[2.3cqw]">
            <p className="font-semibold text-toner/60">Findings</p>
            {[0, 1].slice(0, screen === 'log' ? 2 : 1).map((i) => (
              <m.div key={i} className="mt-[1.4cqw] rounded-[0.8cqw] border border-black/10 p-[1.2cqw]" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.4 }}>
                <p className="font-print font-semibold text-toner">F-00{i + 1}</p>
                <span className="mt-[0.8cqw] block h-[0.8cqw] w-[80%] rounded-full bg-toner/20" />
                <span className="mt-[0.6cqw] block h-[0.8cqw] w-[60%] rounded-full bg-toner/15" />
              </m.div>
            ))}
          </div>
        </div>
        {screen === 'log' && (
          <div className="absolute bottom-[3cqw] right-[3cqw] flex flex-col items-end gap-[1cqw] text-[2.4cqw]">
            {['Finding logged · 09:41', 'Saved · 09:41'].map((t, i) => (
              <m.span key={t} className="flex items-center gap-[1cqw] rounded-[1cqw] bg-[#1c2430] px-[2cqw] py-[1cqw] text-white shadow-[0_1cqw_2cqw_rgb(0_0_0/0.3)]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.35 }}>
                <Check className="size-[2.4cqw] text-[#6ee7b7]" /> {t}
              </m.span>
            ))}
          </div>
        )}
      </div>
    );
  if (screen === 'saved')
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#f7f5f1] text-center">
        <svg viewBox="0 0 120 120" className="size-[17cqw]">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#e7e2da" strokeWidth="9" />
          <m.circle cx="60" cy="60" r="50" fill="none" stroke="#b85f43" strokeWidth="9" strokeLinecap="round" transform="rotate(-90 60 60)" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: EASE_OUT }} />
          <m.path d="M40 61 l13 13 l27 -29" fill="none" stroke="#1c2430" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.9, duration: 0.4 }} />
        </svg>
        <p className="mt-[2.5cqw] font-serif text-[5cqw] text-toner">Workday 1 submitted</p>
        <p className="mt-[0.5cqw] text-[2.8cqw] text-toner/60">Progress saved. Workday 2 opens when you are ready.</p>
      </div>
    );
  if (screen === 'inbox' || screen === 'lockdown')
    return (
      <div className="relative flex h-full flex-col bg-white">
        <AppBar title="Workday 2 · Inbox" />
        <div className="flex min-h-0 flex-1">
          <div className="w-[38%] border-r border-black/10">
            {['Clinical project manager', 'Sponsor team', 'Site coordinator'].map((from, i) => (
              <m.div key={from} className={cn('border-b border-black/5 px-[2cqw] py-[1.6cqw] text-[2.3cqw]', i === 1 && 'bg-accent-soft/60')} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.3 }}>
                <p className="flex items-center justify-between font-semibold text-toner">
                  {from}
                  {i < 2 && <span className="size-[1.4cqw] rounded-full bg-copper" />}
                </p>
                <span className="mt-[0.8cqw] block h-[0.8cqw] w-[75%] rounded-full bg-toner/25" />
              </m.div>
            ))}
          </div>
          <div className="flex-1 p-[2.5cqw]">
            <span className="block h-[1.2cqw] w-[55%] rounded-full bg-toner/45" />
            {[92, 86, 95, 70].map((w, i) => (
              <span key={i} className="mt-[1.2cqw] block h-[0.8cqw] rounded-full bg-toner/18" style={{ width: `${w}%` }} />
            ))}
            <div className="mt-[3cqw] rounded-[1cqw] border border-black/15 p-[1.8cqw]">
              <p className="text-[2.2cqw] text-toner/50">Reply</p>
              {[80, 64].map((w, i) => (
                <m.span key={i} className="mt-[1cqw] block h-[0.8cqw] rounded-full bg-pen/50" initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ delay: 0.8 + i * 0.7, duration: 0.7, ease: 'linear' }} />
              ))}
            </div>
          </div>
        </div>
        {screen === 'lockdown' && (
          <m.div className="absolute inset-0 flex items-center justify-center bg-[#1c2430]/55 backdrop-blur-[1px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="w-[64%] rounded-[1.6cqw] bg-white p-[3cqw] text-center shadow-[0_2cqw_4cqw_rgb(0_0_0/0.4)]">
              <ShieldCheck className="mx-auto size-[6cqw] text-accent" />
              <p className="mt-[1.2cqw] font-serif text-[4.4cqw] text-toner">Proctored mode</p>
              <p className="mt-[0.8cqw] text-[2.5cqw] text-toner/65">Full screen · copy and paste off · leaving the window is recorded</p>
            </div>
          </m.div>
        )}
      </div>
    );
  if (screen === 'done')
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#f7f5f1] px-[6cqw] text-center">
        <p className="font-serif text-[5.6cqw] text-toner">Submitted. Thank you.</p>
        <div className="mt-[3cqw] w-full rounded-[1.4cqw] bg-white p-[2.6cqw] text-left text-[2.5cqw] shadow-[0_0.6cqw_1.6cqw_rgb(0_0_0/0.12)]">
          <p className="font-semibold text-toner/60">Who sees your result</p>
          {['The employer who invited you', 'Otherwise: the Lokus talent pool'].map((t, i) => (
            <p key={t} className="mt-[1.4cqw] flex items-center justify-between">
              <span className="text-toner">{t}</span>
              <span className={cn('relative h-[3cqw] w-[5.4cqw] rounded-full', i === 0 ? 'bg-success' : 'bg-toner/20')}>
                <span className={cn('absolute top-[0.4cqw] size-[2.2cqw] rounded-full bg-white', i === 0 ? 'right-[0.4cqw]' : 'left-[0.4cqw]')} />
              </span>
            </p>
          ))}
        </div>
        <p className="mt-[2cqw] text-[2.4cqw] text-toner/55">Candidates never see scores.</p>
      </div>
    );
  return (
    <div className="flex h-full flex-col bg-[#f4f2ee]">
      <AppBar title={`Result · Candidate ${chapter === LAST ? 'A' : ''}`} />
      <div className="flex min-h-0 flex-1 gap-[2cqw] p-[2.4cqw]">
        <div className="flex-1 rounded-[1.2cqw] bg-white p-[2.2cqw] text-[2.3cqw]">
          <p className="flex items-center justify-between">
            <span className="font-semibold text-toner">Clinical Trial Associate</span>
            <span className="rounded-full bg-success-soft px-[1.4cqw] py-[0.4cqw] font-semibold text-success">Meets bar</span>
          </p>
          {['Safety awareness', 'Integrity', 'Data quality', 'Communication'].map((l, i) => (
            <div key={l} className="mt-[1.6cqw] grid grid-cols-[38%_1fr] items-center gap-[1.4cqw]">
              <span className="truncate text-toner/70">{l}</span>
              <span className="h-[1cqw] overflow-hidden rounded-full bg-black/8">
                <m.span className="block h-full rounded-full bg-[linear-gradient(90deg,#a04e35,#b85f43)]" initial={{ width: 0 }} animate={{ width: `${[86, 78, 92, 72][i]}%` }} transition={{ delay: 0.3 + i * 0.12, duration: 0.8, ease: EASE_OUT }} />
              </span>
            </div>
          ))}
        </div>
        <div className="w-[36%] rounded-[1.2cqw] bg-white p-[2.2cqw] text-[2.2cqw]">
          <p className="font-semibold text-toner/60">Evidence</p>
          {['Finding log', 'Escalation', 'Reply to sponsor', 'Decisions'].map((e) => (
            <p key={e} className="mt-[1.4cqw] flex items-center gap-[1cqw] text-pen">
              <Link2 className="size-[2.4cqw]" /> {e}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function Printer({ printed }: { printed: boolean }) {
  return (
    <div aria-hidden className="absolute left-[21%] top-[53%] h-[15%] w-[14%]">
      <div className="absolute inset-x-0 top-0 h-[86%] rounded-[0.5cqw] bg-[linear-gradient(180deg,#f3f1ec,#d8d3ca_70%,#c9c3b8)] shadow-[inset_0_1px_0_#fff,0_8px_14px_-6px_rgb(0_0_0/0.45)]">
        <span className="absolute inset-x-[8%] top-[18%] h-[5%] rounded-full bg-[#2b2d31]" />
        <span className="absolute right-[7%] top-[33%] size-[0.45cqw] rounded-full bg-[#6ee7b7] shadow-[0_0_6px_#6ee7b7]" />
        <span className="absolute inset-x-[12%] top-[46%] h-[4%] rounded-full bg-[#3a3c41] shadow-[inset_0_1px_1px_rgb(0_0_0/0.6)]" />
      </div>
      <div className="absolute -inset-x-[3%] bottom-0 h-[16%] rounded-b-[0.4cqw] bg-[linear-gradient(180deg,#cfc9bf,#b4ada1)] shadow-[0_6px_10px_-3px_rgb(0_0_0/0.4)]" />
      <m.div
        className="paper-grain absolute left-[15%] top-[48%] w-[70%] origin-top rounded-[1px] bg-paper p-[0.35cqw] shadow-[0_6px_10px_-4px_rgb(0_0_0/0.45)]"
        initial={false}
        animate={printed ? { scaleY: 1, opacity: 1 } : { scaleY: 0, opacity: 0 }}
        transition={{ duration: 1.4, ease: EASE_OUT }}
      >
        <SpecimenCrf className="text-[0.36cqw]" />
      </m.div>
    </div>
  );
}

function PaperStack() {
  return (
    <div aria-hidden className="absolute left-[35.5%] top-[64.2%] h-[4%] w-[5%]">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="absolute inset-x-0 h-[22%] rounded-[1px] bg-[#f6f2ea] shadow-[0_1px_1px_rgb(0_0_0/0.2)]" style={{ bottom: `${i * 22}%`, translate: `${(i % 2) * 3 - 1}% 0` }} />
      ))}
      <span className="absolute -top-[30%] left-[10%] h-[22%] w-[60%] rounded-[1px] bg-[#e9cf9a] shadow-[0_1px_1px_rgb(0_0_0/0.2)]" />
    </div>
  );
}

function Phone({ time, buzzing }: { time: MotionValue<number>; buzzing: boolean }) {
  const clock = useTransform(time, (t) => {
    const d = ((t % 1440) + 1440) % 1440;
    return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(Math.floor(d % 60)).padStart(2, '0')}`;
  });
  return (
    <div aria-hidden className="absolute left-[72.5%] top-[53%] h-[15.5%] w-[4.6%]">
      <div key={buzzing ? 'buzz' : 'still'} className={cn('absolute inset-x-[4%] top-0 h-[86%] rounded-[0.6cqw] bg-[#121417] p-[0.25cqw] shadow-[0_8px_12px_-4px_rgb(0_0_0/0.55)]', buzzing && 'lk-buzz')}>
        <div className="relative size-full overflow-hidden rounded-[0.45cqw] bg-[linear-gradient(160deg,#2a3550,#141a2b)]">
          <m.p className="mt-[18%] text-center text-[0.95cqw] font-semibold text-white/90">{clock}</m.p>
          <AnimatePresence>
            {buzzing && (
              <m.div className="absolute inset-x-[6%] top-[46%] rounded-[0.3cqw] bg-white/90 p-[0.3cqw] text-[0.42cqw] leading-tight text-toner" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="flex items-center gap-[0.2cqw] font-semibold">
                  <BellRing className="size-[0.6cqw]" /> Lokus
                </span>
                Workday 2 is ready
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="absolute bottom-0 left-[10%] h-[18%] w-[80%] rounded-[0.3cqw] bg-[linear-gradient(180deg,#5b5f68,#33363c)]" />
    </div>
  );
}

function Mug({ steam }: { steam: MotionValue<number> }) {
  return (
    <div aria-hidden className="absolute left-[78.5%] top-[59.5%] h-[9%] w-[3.6%]">
      <m.div className="absolute -top-[70%] left-[15%] h-[70%] w-[70%]" style={{ opacity: steam }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="lk-steam absolute bottom-0 h-[60%] w-[30%] rounded-full bg-white/50 blur-[3px]" style={{ left: `${i * 32}%`, animationDelay: `${-i * 1.3}s` }} />
        ))}
      </m.div>
      <div className="absolute inset-0 rounded-b-[0.6cqw] rounded-t-[0.2cqw] bg-[linear-gradient(90deg,#d9d3c9,#ffffff_40%,#e2dcd2)] shadow-[0_6px_10px_-4px_rgb(0_0_0/0.45)]">
        <span className="absolute inset-x-0 top-0 h-[10%] rounded-[50%] bg-[#4a2b18]" />
        <span className="absolute left-[30%] top-[38%] font-print-label text-[0.55cqw] font-bold text-copper">L</span>
      </div>
      <div className="absolute -right-[38%] top-[22%] h-[46%] w-[45%] rounded-r-full border-[0.35cqw] border-l-0 border-[#ebe6dd]" />
    </div>
  );
}

function Lamp() {
  return (
    <svg aria-hidden viewBox="0 0 120 200" className="absolute left-[84%] top-[31%] h-[37.5%] w-[11.5%] overflow-visible drop-shadow-[0_8px_8px_rgb(0_0_0/0.35)]">
      <defs>
        <linearGradient id="lk-lamp" x1="0" x2="1">
          <stop offset="0" stopColor="#2b2e33" />
          <stop offset=".5" stopColor="#4b4f57" />
          <stop offset="1" stopColor="#25282c" />
        </linearGradient>
      </defs>
      <ellipse cx="78" cy="194" rx="30" ry="6" fill="url(#lk-lamp)" />
      <path d="M78 190 L 92 112" stroke="#3c4047" strokeWidth="5" strokeLinecap="round" />
      <circle cx="92" cy="112" r="5" fill="#2b2e33" />
      <path d="M92 112 L 46 52" stroke="#3c4047" strokeWidth="5" strokeLinecap="round" />
      <circle cx="46" cy="52" r="4.5" fill="#2b2e33" />
      <path d="M48 46 L 20 30 L 6 64 L 34 72 Z" fill="url(#lk-lamp)" />
      <ellipse cx="20" cy="68" rx="14" ry="4" fill="#ffe7b8" opacity=".85" transform="rotate(16 20 68)" />
    </svg>
  );
}

/* ---------------------------------------------------------------- after the day */

const COMPETENCIES = [
  ['Safety awareness', 'Recognising when something could affect the people taking part in a study, and acting on it.'],
  ['Integrity', 'Doing the right thing for the study and its participants, even when it is inconvenient.'],
  ['Data quality', 'Careful, well-documented review of study records against the study documents.'],
  ['Professional communication', 'Clear, neutral and courteous writing with colleagues, sites and sponsors.'],
];
const BENEFITS = [
  { icon: <FileSearch />, title: 'Evidence you can inspect', body: 'Every score links back to what the candidate did.' },
  { icon: <Scale />, title: 'Consistent and fair', body: 'The same workdays and the same rubric for everyone.' },
  { icon: <ShieldCheck />, title: 'Integrity built in', body: 'Critical failures are flagged on their own.' },
  { icon: <Users />, title: 'Your team, your candidates', body: 'Invite in bulk, follow progress, compare side by side.' },
];

function Pin({ className, color = '#c0281c' }: { className?: string; color?: string }) {
  return <span aria-hidden className={cn('absolute z-10 size-4 rounded-full shadow-[2px_4px_3px_rgb(0_0_0/0.4)]', className)} style={{ background: `radial-gradient(circle at 35% 35%, #fff8, ${color} 45%, #0006)` }} />;
}

/** The cork wall after the day: what the simulation looks at, and a note for each audience. */
function Pinboard() {
  const [ref, seen] = useSeen<HTMLDivElement>('0px 0px -15% 0px');
  const pinned = (i: number) => ({
    initial: { opacity: 0, y: -24, rotate: 0 },
    animate: seen ? { opacity: 1, y: 0, rotate: [-2, 1.5, -1, 2.5, -1.5, 1][i % 6] } : undefined,
    transition: { delay: 0.1 + i * 0.12, type: 'spring' as const, stiffness: 260, damping: 20 },
  });
  return (
    <section id="pinboard" className="scroll-mt-16 bg-[#2b2622] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl rounded-[8px] bg-[#8a6748] p-3 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)]">
        <div ref={ref} className="lk-cork relative rounded-[4px] px-5 py-12 shadow-[inset_0_3px_10px_rgb(0_0_0/0.4)] sm:px-10">
          <m.div {...pinned(0)} className="relative mx-auto max-w-xl">
            <Pin className="left-1/2 -top-2 -translate-x-1/2" />
            <div className="paper-grain rounded-[2px] bg-paper px-7 py-6 text-center shadow-[0_14px_24px_-12px_rgb(0_0_0/0.6)]">
              <p className="font-print text-[11px] uppercase tracking-[0.2em] text-copper">What the simulation looks at</p>
              <h2 className="mt-2 font-serif text-[34px] leading-tight sm:text-[42px]">Four competencies, one result backed by evidence.</h2>
            </div>
          </m.div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {COMPETENCIES.map(([title, body], i) => (
              <m.div key={title} {...pinned(i + 1)} className="relative">
                <Pin className="left-1/2 -top-2 -translate-x-1/2" color={['#c0281c', '#2563eb', '#16a34a', '#d97706'][i]} />
                <div className="h-full rounded-[2px] bg-[#fffefa] bg-[linear-gradient(180deg,transparent_42px,rgb(224_90_90/0.5)_42px,rgb(224_90_90/0.5)_43.5px,transparent_43.5px),repeating-linear-gradient(180deg,transparent_0_23px,rgb(80_130_200/0.22)_23px_24px)] bg-[position:0_0,0_43px] px-5 pb-6 pt-3 shadow-[0_14px_22px_-12px_rgb(0_0_0/0.6)]">
                  <p className="font-print text-[11px] uppercase tracking-[0.18em] text-toner/50">0{i + 1}</p>
                  <p className="mt-2 font-print text-[16px] font-semibold leading-6">{title}</p>
                  <p className="mt-4 font-print text-[13px] leading-6 text-toner/75">{body}</p>
                </div>
              </m.div>
            ))}
          </div>

          <div className="mt-14 grid items-start gap-10 lg:grid-cols-2">
            <m.div {...pinned(5)} className="relative">
              <Pin className="left-8 -top-2" color="#2563eb" />
              <div className="paper-grain rounded-[2px] bg-paper px-7 py-7 shadow-[0_14px_24px_-12px_rgb(0_0_0/0.6)]">
                <p className="font-print text-[11px] uppercase tracking-[0.2em] text-copper">For employers</p>
                <p className="mt-2 font-serif text-[30px] leading-tight">Hiring decisions you can explain.</p>
                <ul className="mt-5 flex flex-col gap-4">
                  {BENEFITS.map((b) => (
                    <li key={b.title} className="flex gap-3">
                      <DrawnIcon className="mt-1 [&_svg]:size-5">{b.icon}</DrawnIcon>
                      <span>
                        <span className="block font-hand text-[24px] font-semibold leading-none text-pen">{b.title}</span>
                        <span className="text-[14px] text-ink-2">{b.body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Key to="/request-access">
                    <Mail className="size-4" aria-hidden /> Request employer access
                  </Key>
                </div>
              </div>
            </m.div>
            <m.div {...pinned(6)} className="relative">
              <Pin className="right-8 -top-2" color="#16a34a" />
              <div className="paper-grain rounded-[2px] bg-paper px-7 py-7 shadow-[0_14px_24px_-12px_rgb(0_0_0/0.6)]">
                <p className="font-print text-[11px] uppercase tracking-[0.2em] text-copper">For candidates</p>
                <p className="mt-2 font-serif text-[30px] leading-tight">Show the work, not just the CV.</p>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-2">Two workdays as a Clinical Trial Associate at a fictional contract research organisation. No trick questions, only the kind of work the job involves. Everything you need is inside.</p>
                <Handwriting play={seen} delay={1.4} className="mt-4 text-[26px]">
                  Good luck! – the Lokus team
                </Handwriting>
                <div className="mt-6">
                  <Key to="/signup" arrow>
                    Create your account
                  </Key>
                </div>
              </div>
            </m.div>
          </div>

          <m.div {...pinned(7)} className="relative mx-auto mt-14 w-fit">
            <StickyNote className="w-72 text-center text-[26px]">
              Ready to see the work?
              <span className="mt-3 flex justify-center">
                <Stamp tone="copper" className="text-[13px]">
                  Start today
                </Stamp>
              </span>
            </StickyNote>
          </m.div>
        </div>
      </div>
    </section>
  );
}
