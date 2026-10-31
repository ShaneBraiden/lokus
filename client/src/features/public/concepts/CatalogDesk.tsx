import { Clock, Layers, Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/ui/cn';
import { Logo } from '@/ui/misc';
import { EASE_OUT, m } from '@/ui/motion';
import { Dymo, TornEdge } from './DeskConcept';
import { AccountKeys, ConceptSwitcher, DrawnIcon, Handwriting, INK, InkStroke, Key, Paperclip, Pen, Sheet, Stamp, StampDown, StickyNote, Tape, useSeen } from './materials';
import { AUDIENCES, BENEFITS, COMPETENCIES, HERO, MISSION, PACKAGE, SIMULATIONS, STATS, STEPS, type Simulation } from './story';

/**
 * Catalogue option 1, "The Desk": the catalogue page laid out on the reviewer's desk. Each section is something you
 * could pick up: a memo, label-maker tape, manila folders, sticky notes, index cards.
 */
export function CatalogDesk() {
  return (
    <div className="lk-real desk-surface min-h-dvh overflow-x-clip text-toner">
      <header className="sticky top-0 z-50 drop-shadow-[0_6px_8px_rgb(60_45_30/0.22)]">
        <div className="paper-grain bg-paper">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <Logo />
            <nav aria-label="Main" className="hidden items-center gap-7 font-print-label text-[13px] font-semibold uppercase tracking-[0.16em] text-toner/65 md:flex">
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
        </div>
        <TornEdge />
      </header>
      <main>
        <Hero />
        <PackageStrip />
        <Catalogue />
        <HowItWorks />
        <Figures />
        <ForEmployers />
        <WhatWeLookAt />
        <Mission />
      </main>
      <footer className="pb-20">
        <TornEdge flip />
        <div className="paper-grain bg-paper">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Logo />
            <nav className="flex gap-5" aria-label="Legal">
              <Link to="/legal/privacy" className="hover:text-ink">
                Privacy
              </Link>
              <Link to="/legal/terms" className="hover:text-ink">
                Terms
              </Link>
            </nav>
          </div>
        </div>
      </footer>
      <ConceptSwitcher current="catalog-desk" />
    </div>
  );
}

/** Label-maker title with an optional line of print under it. */
function Heading({ label, title, tone, center }: { label: string; title: ReactNode; tone?: 'black' | 'red' | 'blue'; center?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-4', center ? 'items-center text-center' : 'items-start')}>
      <h2 className="-rotate-1">
        <Dymo tone={tone}>{label}</Dymo>
      </h2>
      <p className="max-w-2xl font-serif text-[30px] leading-[1.1] sm:text-[40px]">{title}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="relative mx-auto max-w-5xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16">
      <m.div className="relative" initial={{ opacity: 0, y: -14, scale: 1.03 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
        <Tape className="-top-3 left-10 -rotate-6" />
        <Tape className="-top-3 right-10 rotate-[5deg]" />
        <Sheet stack className="-rotate-[0.4deg]" faceClassName="px-6 pb-12 pt-9 text-center sm:px-14 sm:pb-16 sm:pt-12">
          <p className="font-print-label text-[11px] font-semibold uppercase tracking-[0.24em] text-toner/50">{HERO.eyebrow}</p>
          <h1 className="mt-6 font-serif text-[46px] leading-[1.02] tracking-[-0.015em] sm:text-[76px]">
            {HERO.lines[0]}
            <br />
            <span className="relative inline-block">
              {HERO.lines[1]}
              <InkStroke ink={INK.underline} play delay={0.9} duration={0.7} width={3} className="absolute -bottom-1 left-0 h-4 w-full" />
            </span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-ink-2">{HERO.body}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Key to="/signup" size="lg" arrow>
              Get started
            </Key>
            <Key to="#employers" size="lg" tone="paper">
              I&rsquo;m hiring
            </Key>
          </div>
          <StampDown play delay={1.3} rotate={10} className="right-5 top-6 hidden text-[13px] sm:block">
            <Stamp tone="green" sub="Two workdays">
              Now open
            </Stamp>
          </StampDown>
        </Sheet>
        <Paperclip className="absolute -top-6 left-[22%] h-20 w-7 rotate-[8deg]" />
        <Pen className="absolute -bottom-8 right-[-4%] hidden h-8 w-80 -rotate-[14deg] lg:block" />
      </m.div>
    </section>
  );
}

/** Where a catalogue site puts its employer logos: the labels on what the candidate is handed. */
function PackageStrip() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 text-center sm:px-6">
      <p className="font-print text-[12px] uppercase tracking-[0.18em] text-toner/55">Built from the real paperwork of the role</p>
      <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-4">
        {PACKAGE.map((p, i) => (
          <li key={p} style={{ rotate: `${[-1.5, 1, -0.5, 1.5, -1][i]}deg` }}>
            <Dymo tone={i === 4 ? 'blue' : 'black'}>{p}</Dymo>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------- catalogue */

function Catalogue() {
  return (
    <section id="simulations" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
      <Heading label="Explore the simulations" title="One role, two workdays, the real work of the job." />
      <div className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {SIMULATIONS.map((s, i) => (
          <Folder key={s.code} sim={s} index={i} />
        ))}
      </div>
    </section>
  );
}

/** A manila folder with its tab, the simulation's label stuck to the front. */
function Folder({ sim, index }: { sim: Simulation; index: number }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const planned = sim.kind === 'planned';
  return (
    <m.div
      ref={ref}
      className="relative"
      initial={{ opacity: 0, y: 18 }}
      animate={seen ? { opacity: 1, y: 0, rotate: [-1, 0.8, -0.4, 1.2][index] } : undefined}
      transition={{ delay: index * 0.1, duration: 0.5, ease: EASE_OUT }}
    >
      <span
        aria-hidden
        className={cn('absolute -top-5 left-4 h-6 w-28 rounded-t-[6px]', planned ? 'border-2 border-b-0 border-dashed border-toner/30' : 'bg-[linear-gradient(180deg,#ecd29a,#e2c48a)]')}
      />
      <div
        className={cn(
          'relative flex h-full flex-col rounded-[4px] rounded-tl-none p-5',
          planned ? 'border-2 border-dashed border-toner/30' : 'paper-grain bg-[linear-gradient(180deg,#e9cf98,#dfc28a)] shadow-[0_1px_1px_rgb(0_0_0/0.1),0_18px_30px_-14px_rgb(60_45_30/0.55)]',
        )}
      >
        <p className={cn('font-print-label text-[11px] font-bold uppercase tracking-[0.22em]', planned ? 'text-toner/45' : 'text-[#7a5a2a]')}>{sim.code}</p>
        <div className={cn('mt-3 rounded-[2px] px-3 py-3', !planned && 'bg-paper shadow-[0_1px_2px_rgb(60_45_30/0.25)]')}>
          <p className="font-serif text-[22px] leading-tight">{sim.title}</p>
          <p className="mt-1 font-print text-[11.5px] uppercase tracking-[0.1em] text-toner/55">{sim.field}</p>
        </div>
        <p className="mt-4 flex-1 text-[14px] leading-relaxed text-ink-2">{sim.body}</p>
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 font-print text-[12px] text-toner/70">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="size-3.5" aria-hidden /> {sim.format}
          </span>
          {sim.duration && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden /> {sim.duration}
            </span>
          )}
        </div>
        {sim.kind === 'role' && (
          <div className="mt-5">
            <Key to="/signup" size="sm" arrow>
              Start the simulation
            </Key>
          </div>
        )}
        {sim.kind === 'role' && (
          <StampDown play={seen} delay={0.6} rotate={-12} className="-right-3 -top-4 text-[11px]">
            <Stamp tone="red">Open now</Stamp>
          </StampDown>
        )}
      </div>
    </m.div>
  );
}

/* ---------------------------------------------------------------- how it works */

const NOTE_TONES = ['yellow', 'blue', 'pink', 'green'] as const;

function HowItWorks() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
      <Heading label="How Lokus works" title="The bridge between what you can do and the job." center />
      <div ref={ref} className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {STEPS.map((s, i) => (
          <div key={s.title} className="relative">
            <m.div initial={{ opacity: 0, y: -16, rotate: 0 }} animate={seen ? { opacity: 1, y: 0, rotate: [-2, 1.5, -1, 2][i] } : undefined} transition={{ delay: i * 0.18, type: 'spring', stiffness: 260, damping: 20 }}>
              <StickyNote tone={NOTE_TONES[i]} className="min-h-52">
                <span className="text-[40px] leading-none text-pen">{i + 1}</span>
                <span className="mt-2 block text-[26px]">{s.title}</span>
                <span className="mt-2 block font-sans text-[14px] font-normal leading-snug text-toner/75">{s.body}</span>
              </StickyNote>
            </m.div>
            {i < STEPS.length - 1 && <InkStroke ink={INK.arrowRight} play={seen} delay={0.5 + i * 0.25} className="absolute -right-9 top-1/2 z-10 hidden h-8 w-14 lg:block" />}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- figures */

function Figures() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div ref={ref} className="grid gap-8 sm:grid-cols-3">
        {STATS.map((s, i) => (
          <m.div key={s.unit} initial={{ opacity: 0, scale: 1.06 }} animate={seen ? { opacity: 1, scale: 1, rotate: [-1.2, 0.6, -0.4][i] } : undefined} transition={{ delay: i * 0.12, duration: 0.5, ease: EASE_OUT }}>
            {/* An index card: red rule under the heading, faint blue lines below. */}
            <div className="h-full rounded-[2px] bg-[#fffefa] bg-[linear-gradient(180deg,transparent_96px,rgb(224_90_90/0.5)_96px,rgb(224_90_90/0.5)_97.5px,transparent_97.5px),repeating-linear-gradient(180deg,transparent_0_23px,rgb(80_130_200/0.2)_23px_24px)] bg-[position:0_0,0_97px] px-6 pb-6 pt-4 shadow-[0_14px_22px_-12px_rgb(60_45_30/0.5)]">
              <p className="flex items-baseline gap-2">
                <span className="font-serif text-[64px] leading-none">{s.value}</span>
                <span className="font-hand text-[26px] font-semibold text-pen">{s.unit}</span>
              </p>
              <p className="mt-8 font-print text-[13px] leading-6 text-toner/75">{s.body}</p>
            </div>
          </m.div>
        ))}
      </div>
      <p className="mt-10 text-center">
        <Handwriting play={seen} delay={0.8} className="text-[28px]">
          …and every score links back to what you did.
        </Handwriting>
      </p>
      <div className="mt-8 flex justify-center">
        <Key to="#simulations" tone="ink">
          Find the simulation
        </Key>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- employers */

function ForEmployers() {
  return (
    <section id="employers" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
      <Heading label="For employers" tone="red" title="Built for teams hiring in clinical research." />
      <ul className="mt-8 flex flex-wrap gap-3">
        {AUDIENCES.map((a) => (
          <li key={a} className="rounded-full border border-toner/25 bg-paper/60 px-4 py-1.5 font-print text-[12.5px] text-toner/75">
            {a}
          </li>
        ))}
      </ul>
      <div className="relative mt-10">
        <Tape className="-top-3 left-1/2 -translate-x-1/2 rotate-2" />
        <Sheet holes faceClassName="px-8 py-9 sm:pl-16 sm:pr-12">
          <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <DrawnIcon className="mt-1 [&_svg]:size-5">
                  <Icon />
                </DrawnIcon>
                <span>
                  <span className="block font-hand text-[26px] font-semibold leading-none text-pen">{title}</span>
                  <span className="mt-1 block text-[14.5px] text-ink-2">{body}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-9">
            <Key to="/request-access">
              <Mail className="size-4" aria-hidden /> Request employer access
            </Key>
          </div>
        </Sheet>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- competencies */

function WhatWeLookAt() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Heading label="What we look at" tone="blue" title="Four competencies. One result, backed by evidence." center />
      <div ref={ref} className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {COMPETENCIES.map((c, i) => (
          <m.div key={c.title} className="relative" initial={{ opacity: 0, y: 20 }} animate={seen ? { opacity: 1, y: 0, rotate: [1, -1.5, 0.8, -0.6][i] } : undefined} transition={{ delay: i * 0.12, duration: 0.5, ease: EASE_OUT }}>
            <Paperclip className="absolute -top-5 left-6 z-10 h-14 w-5" />
            <Sheet tone="ivory" className="h-full" faceClassName="px-5 pb-6 pt-7">
              <p className="font-print text-[11px] uppercase tracking-[0.18em] text-toner/50">0{i + 1}</p>
              <p className="mt-2 font-serif text-[22px] leading-tight">{c.title}</p>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{c.body}</p>
            </Sheet>
          </m.div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- mission */

function Mission() {
  const [ref, seen] = useSeen<HTMLDivElement>('0px 0px -20% 0px');
  return (
    <section className="px-4 pb-28 pt-10 sm:px-6">
      <div ref={ref} className="relative mx-auto max-w-3xl">
        <Sheet className="-rotate-[0.5deg]" faceClassName="px-7 py-12 text-center sm:px-14 sm:py-16">
          <h2 className="font-serif text-[34px] leading-[1.08] sm:text-[46px]">{MISSION.title}</h2>
          <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-ink-2">{MISSION.body}</p>
          <div className="mt-9 flex justify-center">
            <Key to="/signup" size="lg" arrow>
              Create your account
            </Key>
          </div>
          <StampDown play={seen} delay={0.5} rotate={-8} className="bottom-6 left-6 hidden text-[12px] sm:block">
            <Stamp tone="copper" sub="Lokus">
              Merit first
            </Stamp>
          </StampDown>
        </Sheet>
        <Tape className="-top-3 left-12 -rotate-6" />
        <Tape className="-top-3 right-12 rotate-[5deg]" />
      </div>
    </section>
  );
}
