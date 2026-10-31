import { Clock, Layers, Mail } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/ui/cn';
import { Logo } from '@/ui/misc';
import { EASE_OUT, m } from '@/ui/motion';
import { AccountKeys, DrawnIcon, Handwriting, Key, Stamp, StampDown, StickyNote, useSeen } from './concepts/materials';
import { Wallpaper } from './concepts/Wallpaper';
import { AUDIENCES, BENEFITS, COMPETENCIES, FIELDS, HERO, MISSION, PACKAGE, SIMULATIONS, STATS, STEPS, type Simulation } from './concepts/story';

/**
 * The landing page (catalogue option 3, "The Workday"): the front door to every Lokus simulation, told in a staff room
 * and kept spare. A doodle wallpaper of lab and clinic tools runs behind every section; the shelf holds the paperwork of
 * healthcare work and the cork board is the jobs board, one posting per simulation.
 */
export function Landing() {
  return (
    <div className="lk-real min-h-dvh overflow-x-clip bg-[#2b2622] text-toner">
      <header className="sticky top-0 z-50 border-b border-black/10 bg-[#f4efe6]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-6 font-print text-[12px] uppercase tracking-[0.16em] text-toner/60 md:flex">
            <a href="#simulations" className="hover:text-toner">
              Simulations
            </a>
            <a href="#how" className="hover:text-toner">
              How it works
            </a>
            <a href="#employers" className="hover:text-toner">
              Employers
            </a>
          </nav>
          <AccountKeys />
        </div>
      </header>
      <main>
        <Wall />
        <Shelf />
        <JobsBoard />
        <TheDay />
        <Calendar />
        <Pinboard />
      </main>
      <footer className="py-10 text-center font-print text-[12px] text-white/50">
        © {new Date().getFullYear()} Lokus ·{' '}
        <Link to="/legal/privacy" className="hover:text-white">
          Privacy
        </Link>{' '}
        ·{' '}
        <Link to="/legal/terms" className="hover:text-white">
          Terms
        </Link>
      </footer>
    </div>
  );
}

function Pin({ className, color = '#c0281c' }: { className?: string; color?: string }) {
  return <span aria-hidden className={cn('absolute z-10 size-4 rounded-full shadow-[2px_4px_3px_rgb(0_0_0/0.4)]', className)} style={{ background: `radial-gradient(circle at 35% 35%, #fff8, ${color} 45%, #0006)` }} />;
}

/** A cork board in its frame. */
function Cork({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="mx-auto max-w-6xl rounded-[8px] bg-[#8a6748] p-3 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)]">
      <div className={cn('lk-cork relative rounded-[4px] px-5 py-12 shadow-[inset_0_3px_10px_rgb(0_0_0/0.4)] sm:px-10', className)}>{children}</div>
    </div>
  );
}

/** A printed notice pinned to the board. */
function Notice({ children, className, pin }: { children: ReactNode; className?: string; pin?: string }) {
  return (
    <div className="relative">
      <Pin className="left-1/2 -top-2 -translate-x-1/2" color={pin} />
      <div className={cn('paper-grain rounded-[2px] bg-paper px-7 py-6 shadow-[0_14px_24px_-12px_rgb(0_0_0/0.6)]', className)}>{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- the wall */

function Wall() {
  return (
    <Wallpaper className="bg-[#efeae2]">
      <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-36">
        <m.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
          <p className="font-print text-[12px] uppercase tracking-[0.2em] text-copper">{HERO.eyebrow}</p>
          <h1 className="mt-5 font-serif text-[46px] leading-[1.02] tracking-[-0.015em] sm:text-[78px]">
            {HERO.lines[0]}
            <br />
            <span className="text-copper">{HERO.lines[1]}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2">{HERO.body}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Key to="/signup" size="lg" arrow>
              Get started
            </Key>
            <Key to="#employers" size="lg" tone="paper">
              I&rsquo;m hiring
            </Key>
          </div>
        </m.div>
      </div>
    </Wallpaper>
  );
}

/* ---------------------------------------------------------------- the shelf */

/** Flat warm greys with one copper spine, so the row reads as a single quiet shape. */
const SPINES = ['#5a4f47', '#6e6259', '#7d7068', '#b85f43', '#665a52', '#4f4640'];

/** Where a catalogue site puts its partner logos: one plain binder spine per document in the package, on a thin shelf. */
function Shelf() {
  return (
    <Wallpaper tone="dark" className="bg-[#3a312a] px-4 pt-16 sm:px-6">
      <p className="text-center font-print text-[12px] uppercase tracking-[0.18em] text-white/55">Built from the everyday paperwork of healthcare</p>
      <div className="mx-auto mt-10 flex max-w-3xl items-end justify-center gap-2 sm:gap-3">
        {PACKAGE.map((p, i) => (
          <div key={p} className="flex h-52 w-11 items-start justify-center rounded-t-[4px] pt-5 sm:h-60 sm:w-14" style={{ backgroundColor: SPINES[i] }}>
            <span className="whitespace-nowrap font-print-label text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85 [writing-mode:vertical-rl]">{p}</span>
          </div>
        ))}
      </div>
      <div aria-hidden className="mx-auto h-[2px] max-w-md rounded-full bg-white/25" />
    </Wallpaper>
  );
}

/* ---------------------------------------------------------------- the jobs board */

function JobsBoard() {
  const [ref, seen] = useSeen<HTMLDivElement>('0px 0px -15% 0px');
  const [field, setField] = useState<string | null>(null);
  const shown = field ? SIMULATIONS.filter((s) => s.field === field) : SIMULATIONS;
  return (
    <Wallpaper tone="dark" id="simulations" className="scroll-mt-16 bg-[#3a312a] px-4 py-20 sm:px-6">
      <Cork>
        <div ref={ref}>
          <Notice className="mx-auto max-w-xl text-center">
            <p className="font-print text-[11px] uppercase tracking-[0.2em] text-copper">Jobs board</p>
            <h2 className="mt-2 font-serif text-[34px] leading-tight sm:text-[42px]">Explore the simulations</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">Roles from across healthcare, each built with people who do the job.</p>
          </Notice>
          <div role="group" aria-label="Filter by field" className="mt-10 flex flex-wrap justify-center gap-2">
            {[null, ...FIELDS].map((f) => (
              <button
                key={f ?? 'all'}
                type="button"
                aria-pressed={field === f}
                onClick={() => setField(f)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 font-print text-[12px] uppercase tracking-[0.12em] shadow-[0_4px_8px_-4px_rgb(0_0_0/0.5)] transition-colors',
                  field === f ? 'bg-[#1d1f23] text-white' : 'bg-paper/90 text-toner/75 hover:bg-paper',
                )}
              >
                {f ?? 'All fields'}
              </button>
            ))}
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((s, i) => (
              <m.div
                key={s.code}
                initial={{ opacity: 0, y: -24 }}
                animate={seen ? { opacity: 1, y: 0, rotate: [-2, 1.5, -1, 2.5][i % 4] } : undefined}
                transition={{ delay: 0.15 + i * 0.08, type: 'spring', stiffness: 260, damping: 20 }}
              >
                <Posting sim={s} seen={seen} />
              </m.div>
            ))}
          </div>
          <p className="mt-12 text-center font-print text-[13px] text-white/75">New simulations are added to the board as they open. Create an account to hear first.</p>
        </div>
      </Cork>
    </Wallpaper>
  );
}

function Posting({ sim, seen }: { sim: Simulation; seen: boolean }) {
  if (sim.kind === 'planned')
    return (
      <div className="relative h-full">
        <Pin className="left-1/2 -top-2 -translate-x-1/2" color="#9ca3af" />
        <div className="flex h-full flex-col rounded-[2px] border-2 border-dashed border-white/50 bg-white/15 px-5 py-6 text-[#2b2118]">
          <p className="font-print text-[11px] uppercase tracking-[0.18em] opacity-60">{sim.format}</p>
          <p className="mt-2 font-serif text-[22px] leading-tight">{sim.title}</p>
          <p className="mt-1 font-print text-[11.5px] uppercase tracking-[0.1em] opacity-60">{sim.field}</p>
          <p className="mt-3 text-[14px] leading-relaxed opacity-80">{sim.body}</p>
        </div>
      </div>
    );
  return (
    <div className="relative h-full">
      <Pin className="left-1/2 -top-2 -translate-x-1/2" color={sim.kind === 'role' ? '#c0281c' : '#2563eb'} />
      <div className="paper-grain flex h-full flex-col rounded-[2px] bg-paper px-5 py-6 shadow-[0_14px_22px_-12px_rgb(0_0_0/0.6)]">
        <p className="font-print text-[11px] uppercase tracking-[0.18em] text-copper">{sim.kind === 'role' ? 'Now hiring' : 'Part of the role'}</p>
        <p className="mt-2 font-serif text-[22px] leading-tight">{sim.title}</p>
        <p className="mt-1 font-print text-[11.5px] uppercase tracking-[0.1em] text-toner/50">{sim.field}</p>
        <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-2">{sim.body}</p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-dashed border-toner/25 pt-3 font-print text-[12px] text-toner/70">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="size-3.5" aria-hidden /> {sim.format}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden /> {sim.duration}
          </span>
        </div>
        {sim.kind === 'role' && (
          <>
            <div className="mt-5">
              <Key to="/signup" size="sm" arrow>
                Start the simulation
              </Key>
            </div>
            <StampDown play={seen} delay={0.9} rotate={-10} className="-right-3 top-10 text-[11px]">
              <Stamp tone="red">Open now</Stamp>
            </StampDown>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- the day */

const TIMES = ['08:55', '09:00', '15:30', '16:00'];

function TheDay() {
  const [ref, seen] = useSeen<HTMLOListElement>();
  return (
    <Wallpaper id="how" className="scroll-mt-16 bg-[#efeae2] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-center font-print text-[12px] uppercase tracking-[0.2em] text-copper">How Lokus works</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-center font-serif text-[34px] leading-[1.1] sm:text-[44px]">The bridge between what you can do and the job.</h2>
        <ol ref={ref} className="relative mt-14 grid gap-10 lg:grid-cols-4 lg:gap-6">
          {/* The line the day runs along. */}
          <m.span aria-hidden className="absolute left-0 right-0 top-[27px] hidden h-[3px] origin-left rounded-full bg-copper/50 lg:block" initial={{ scaleX: 0 }} animate={seen ? { scaleX: 1 } : undefined} transition={{ duration: 1.4, ease: EASE_OUT }} />
          {STEPS.map((s, i) => (
            <m.li key={s.title} className="relative" initial={{ opacity: 0, y: 14 }} animate={seen ? { opacity: 1, y: 0 } : undefined} transition={{ delay: 0.2 + i * 0.25, duration: 0.45, ease: EASE_OUT }}>
              <span className="relative z-10 inline-flex h-14 items-center rounded-full bg-[#1d1f23] px-5 font-print text-[18px] font-semibold text-white shadow-[0_8px_14px_-6px_rgb(0_0_0/0.5)]">{TIMES[i]}</span>
              <p className="mt-5 font-print text-[11px] uppercase tracking-[0.18em] text-toner/50">Step {i + 1}</p>
              <p className="mt-1 font-serif text-[24px] leading-tight">{s.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
            </m.li>
          ))}
        </ol>
      </div>
    </Wallpaper>
  );
}

/* ---------------------------------------------------------------- the calendar */

/** The figures as pages of a tear-off desk calendar. */
function Calendar() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <Wallpaper tone="dark" className="bg-[#2b2622] px-4 py-20 sm:px-6">
      <div ref={ref} className="mx-auto grid max-w-4xl gap-10 sm:grid-cols-3 sm:gap-6">
        {STATS.map((s, i) => (
          <m.div key={s.unit} className="relative mx-auto w-full max-w-64" initial={{ opacity: 0, y: 20 }} animate={seen ? { opacity: 1, y: 0, rotate: [-1.5, 0.5, 1.5][i] } : undefined} transition={{ delay: i * 0.15, duration: 0.5, ease: EASE_OUT }}>
            {/* Spiral binding along the top. */}
            <div aria-hidden className="absolute -top-2 inset-x-6 z-10 flex justify-between">
              {Array.from({ length: 9 }, (_, k) => (
                <span key={k} className="h-4 w-1.5 rounded-full bg-[linear-gradient(90deg,#8d9298,#f2f3f4,#8d9298)]" />
              ))}
            </div>
            <div className="overflow-hidden rounded-[4px] bg-paper text-center shadow-[0_2px_0_#e2dbcf,0_4px_0_#d7cfc2,0_20px_30px_-12px_rgb(0_0_0/0.6)]">
              <p className="bg-copper py-2 font-print-label text-[12px] font-bold uppercase tracking-[0.22em] text-white">{s.unit}</p>
              <p className="pt-5 font-serif text-[84px] leading-none">{s.value}</p>
              <p className="px-5 pb-6 pt-3 font-print text-[12.5px] leading-5 text-toner/65">{s.body}</p>
            </div>
          </m.div>
        ))}
      </div>
      <p className="mt-12 text-center font-print text-[13px] text-white/60">Every score links back to what the candidate did.</p>
    </Wallpaper>
  );
}

/* ---------------------------------------------------------------- the pinboard */

function Pinboard() {
  const [ref, seen] = useSeen<HTMLDivElement>('0px 0px -15% 0px');
  const pinned = (i: number) => ({
    initial: { opacity: 0, y: -24, rotate: 0 },
    animate: seen ? { opacity: 1, y: 0, rotate: [-2, 1.5, -1, 2.5, -1.5, 1, -0.5][i % 7] } : undefined,
    transition: { delay: 0.1 + i * 0.12, type: 'spring' as const, stiffness: 260, damping: 20 },
  });
  return (
    <Wallpaper tone="dark" id="employers" className="scroll-mt-16 bg-[#2b2622] px-4 pb-20 sm:px-6">
      <Cork>
        <div ref={ref}>
          <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
            <m.div {...pinned(0)}>
              <Notice pin="#2563eb">
                <p className="font-print text-[11px] uppercase tracking-[0.2em] text-copper">For employers</p>
                <p className="mt-2 font-serif text-[30px] leading-tight">Built for teams hiring in healthcare.</p>
                <p className="mt-2 font-print text-[12px] text-toner/60">{AUDIENCES.join(' · ')}</p>
                <ul className="mt-6 flex flex-col gap-4">
                  {BENEFITS.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="flex gap-3">
                      <DrawnIcon className="mt-1 [&_svg]:size-5">
                        <Icon />
                      </DrawnIcon>
                      <span>
                        <span className="block font-hand text-[24px] font-semibold leading-none text-pen">{title}</span>
                        <span className="text-[14px] text-ink-2">{body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Key to="/request-access">
                    <Mail className="size-4" aria-hidden /> Request employer access
                  </Key>
                </div>
              </Notice>
            </m.div>
            <div className="grid gap-8 sm:grid-cols-2">
              {COMPETENCIES.map((c, i) => (
                <m.div key={c.title} {...pinned(i + 1)} className="relative">
                  <Pin className="left-1/2 -top-2 -translate-x-1/2" color={['#c0281c', '#2563eb', '#16a34a', '#d97706'][i]} />
                  <div className="h-full rounded-[2px] bg-[#fffefa] bg-[linear-gradient(180deg,transparent_42px,rgb(224_90_90/0.5)_42px,rgb(224_90_90/0.5)_43.5px,transparent_43.5px),repeating-linear-gradient(180deg,transparent_0_23px,rgb(80_130_200/0.22)_23px_24px)] bg-[position:0_0,0_43px] px-5 pb-6 pt-3 shadow-[0_14px_22px_-12px_rgb(0_0_0/0.6)]">
                    <p className="font-print text-[11px] uppercase tracking-[0.18em] text-toner/50">What we look at · 0{i + 1}</p>
                    <p className="mt-2 font-print text-[15px] font-semibold leading-6">{c.title}</p>
                    <p className="mt-3 font-print text-[12.5px] leading-6 text-toner/75">{c.body}</p>
                  </div>
                </m.div>
              ))}
            </div>
          </div>

          <m.div {...pinned(6)} className="mx-auto mt-14 max-w-2xl">
            <Notice className="px-8 py-9 text-center">
              <h2 className="font-serif text-[30px] leading-[1.1] sm:text-[38px]">{MISSION.title}</h2>
              <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-2">{MISSION.body}</p>
              <div className="mt-7 flex justify-center">
                <Key to="/signup" size="lg" arrow>
                  Create your account
                </Key>
              </div>
            </Notice>
          </m.div>
          <m.div {...pinned(7)} className="mx-auto mt-8 w-fit">
            <StickyNote className="w-64 text-center text-[24px]">
              <Handwriting play={seen} delay={1.4}>
                Good luck! – the Lokus team
              </Handwriting>
            </StickyNote>
          </m.div>
        </div>
      </Cork>
    </Wallpaper>
  );
}
