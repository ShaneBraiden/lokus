import { Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/ui/cn';
import { Logo } from '@/ui/misc';
import { EASE_OUT, m } from '@/ui/motion';
import { AccountKeys, Barcode, ConceptSwitcher, DrawnIcon, INK, InkStroke, Key, Marker, Sheet, Stamp, useSeen } from './materials';
import { AUDIENCES, BENEFITS, COMPETENCIES, HERO, MISSION, PACKAGE, SIMULATIONS, STATS, STEPS } from './story';

/**
 * Catalogue option 2, "The Study Binder": a vinyl binder cover, then one punched page per section, each behind its own
 * coloured divider tab. The tabs down the right edge of the page jump to their section.
 */
export function CatalogBinder() {
  return (
    <div className="lk-real desk-surface min-h-dvh overflow-x-clip text-toner">
      <header className="sticky top-0 z-50 border-b border-[#cfc6b8] bg-[#e6e0d6]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="hidden font-print text-[12px] uppercase tracking-[0.18em] text-toner/55 lg:inline">Study file · Simulation catalogue</span>
          </div>
          <AccountKeys />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:pr-32">
        <Cover />
        <Contents />
        <Divided id="simulations" n={1} tab="Simulations">
          <Catalogue />
        </Divided>
        <Divided id="how" n={2} tab="How it works">
          <HowItWorks />
        </Divided>
        <Divided id="figures" n={3} tab="Key figures">
          <Figures />
        </Divided>
        <Divided id="employers" n={4} tab="Employers">
          <ForEmployers />
        </Divided>
        <Divided id="criteria" n={5} tab="Criteria">
          <Criteria />
        </Divided>
        <BackCover />
      </main>
      <footer className="pb-24 pt-4 text-center font-print text-[12px] text-toner/55">
        © {new Date().getFullYear()} Lokus ·{' '}
        <Link to="/legal/privacy" className="hover:text-toner">
          Privacy
        </Link>{' '}
        ·{' '}
        <Link to="/legal/terms" className="hover:text-toner">
          Terms
        </Link>
      </footer>
      <ConceptSwitcher current="catalog-binder" />
    </div>
  );
}

const TABS = [
  { id: 'simulations', label: 'Simulations', color: '#c96a4a' },
  { id: 'how', label: 'How it works', color: '#3f73c4' },
  { id: 'figures', label: 'Key figures', color: '#3f9a6b' },
  { id: 'employers', label: 'Employers', color: '#c44b5a' },
  { id: 'criteria', label: 'Criteria', color: '#d9a92e' },
];

/* ---------------------------------------------------------------- cover */

function Cover() {
  return (
    <section className="pt-10 sm:pt-14">
      <m.div className="lk-vinyl relative overflow-hidden rounded-[10px] px-6 pb-14 pt-12 text-center text-white shadow-[0_2px_3px_rgb(0_0_0/0.3),0_30px_50px_-20px_rgb(20_25_35/0.75)] sm:px-14 sm:pb-20 sm:pt-16" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
        {/* The spine and its rivets. */}
        <span aria-hidden className="absolute inset-y-0 left-0 w-7 bg-[linear-gradient(90deg,rgb(0_0_0/0.35),rgb(255_255_255/0.06)_60%,rgb(0_0_0/0.2))]" />
        <span aria-hidden className="absolute left-9 top-6 size-2.5 rounded-full bg-[radial-gradient(circle_at_35%_35%,#f2f3f4,#8d9298)]" />
        <span aria-hidden className="absolute bottom-6 left-9 size-2.5 rounded-full bg-[radial-gradient(circle_at_35%_35%,#f2f3f4,#8d9298)]" />
        {/* The clear sleeve with the printed insert. */}
        <div className="relative mx-auto max-w-3xl rounded-[4px] bg-white/[0.06] p-2 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14)]">
          <div className="paper-grain rounded-[2px] bg-paper px-6 pb-10 pt-8 text-toner sm:px-12 sm:pb-12 sm:pt-10">
            <p className="font-print-label text-[11px] font-semibold uppercase tracking-[0.24em] text-toner/50">{HERO.eyebrow}</p>
            <h1 className="mt-5 font-serif text-[42px] leading-[1.03] tracking-[-0.015em] sm:text-[68px]">
              {HERO.lines[0]}
              <br />
              <Marker delay={700}>{HERO.lines[1]}</Marker>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[16.5px] leading-relaxed text-ink-2">{HERO.body}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Key to="/signup" size="lg" arrow>
                Get started
              </Key>
              <Key to="#employers" size="lg" tone="paper">
                I&rsquo;m hiring
              </Key>
            </div>
          </div>
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[4px] bg-[linear-gradient(120deg,rgb(255_255_255/0.22),transparent_30%,transparent_70%,rgb(255_255_255/0.08))]" />
        </div>
        <p className="mt-8 font-print text-[11px] uppercase tracking-[0.22em] text-white/55">Volume 1 · Clinical research</p>
      </m.div>
    </section>
  );
}

/** Where a catalogue site lists its partners: the contents of the review package, as an index. */
function Contents() {
  return (
    <section className="mx-auto mt-12 max-w-3xl">
      <Sheet holes faceClassName="px-8 py-8 sm:pl-16 sm:pr-12">
        <p className="font-print-label text-[11px] font-semibold uppercase tracking-[0.24em] text-toner/50">In the review package</p>
        <ol className="mt-4 flex flex-col gap-2 font-print text-[13.5px]">
          {PACKAGE.map((p, i) => (
            <li key={p} className="flex items-baseline gap-2">
              <span className="text-toner/45">{String.fromCharCode(65 + i)}.</span>
              <span>{p}</span>
              <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-toner/30" />
              <span className="text-toner/55">{i === 4 ? 'Workday 2' : 'Workday 1'}</span>
            </li>
          ))}
        </ol>
      </Sheet>
    </section>
  );
}

/* ---------------------------------------------------------------- divided pages */

/** One section of the binder: a punched page, its divider tab on the right edge, and the full set of tabs to jump with. */
function Divided({ id, n, tab, children }: { id: string; n: number; tab: string; children: ReactNode }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const color = TABS[n - 1].color;
  return (
    <section id={id} className="relative mt-14 scroll-mt-24">
      <m.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={seen ? { opacity: 1, y: 0 } : undefined} transition={{ duration: 0.5, ease: EASE_OUT }}>
        <Sheet holes faceClassName="px-6 pb-10 pt-8 sm:pl-16 sm:pr-12 sm:pt-10">
          <div className="flex items-center gap-3 border-b border-toner/15 pb-4">
            <span className="inline-flex size-8 items-center justify-center rounded-full font-print-label text-[14px] font-bold text-white" style={{ backgroundColor: color }}>
              {n}
            </span>
            <p className="font-print-label text-[12px] font-semibold uppercase tracking-[0.24em] text-toner/60">Section {n} · {tab}</p>
          </div>
          <div className="pt-8">{children}</div>
        </Sheet>
        {/* The tabs stand off the page's right edge; this section's own tab sits forward. */}
        <nav aria-label="Sections" className="absolute left-full top-10 hidden flex-col gap-1.5 lg:flex">
          {TABS.map((t, i) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              aria-current={t.id === id ? 'true' : undefined}
              className={cn(
                'flex h-9 items-center whitespace-nowrap rounded-r-[6px] pl-3 font-print-label text-[11px] font-bold uppercase tracking-[0.08em] text-white shadow-[2px_2px_3px_rgb(60_45_30/0.3)] transition-[width,opacity]',
                t.id === id ? 'w-28' : 'w-24 opacity-55 hover:opacity-100',
              )}
              style={{ backgroundColor: t.color, zIndex: t.id === id ? 10 : TABS.length - i }}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </m.div>
    </section>
  );
}

function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <h2 className="font-serif text-[30px] leading-[1.1] sm:text-[40px]">{children}</h2>
      {sub && <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">{sub}</p>}
    </>
  );
}

/* ---------------------------------------------------------------- sections */

function Catalogue() {
  return (
    <>
      <PageTitle sub="Self-paced and saved as you go. Everything you need is inside the simulation.">Explore the simulations</PageTitle>
      <div className="mt-8 overflow-hidden rounded-[2px] border-[1.5px] border-toner">
        <div className="hidden grid-cols-[5rem_1fr_9rem_9rem] bg-copper font-print-label text-[12px] font-bold uppercase tracking-[0.12em] text-white md:grid">
          {['Ref.', 'Simulation', 'Format', 'Time'].map((h) => (
            <span key={h} className="border-r border-toner/60 px-3 py-2 last:border-r-0">
              {h}
            </span>
          ))}
        </div>
        {SIMULATIONS.map((s) => (
          <div key={s.code} className={cn('grid gap-x-0 border-t border-toner/60 first:border-t-0 md:grid-cols-[5rem_1fr_9rem_9rem] md:first:border-t', s.kind === 'planned' && 'bg-toner/[0.04] text-toner/60', s.kind === 'role' && 'bg-[#fbf3e8]')}>
            <span className="px-3 pt-3 font-print-label text-[13px] font-bold md:border-r md:border-toner/40 md:py-4">{s.code}</span>
            <div className="px-3 py-2 md:border-r md:border-toner/40 md:py-4">
              <p className={cn('font-serif leading-tight', s.kind === 'role' ? 'text-[24px]' : 'text-[19px]', s.kind === 'task' && 'md:pl-4')}>{s.title}</p>
              <p className={cn('mt-1 text-[13.5px] leading-relaxed text-ink-2', s.kind === 'task' && 'md:pl-4')}>{s.body}</p>
              {s.kind === 'role' && (
                <div className="mt-4">
                  <Key to="/signup" size="sm" arrow>
                    Start the simulation
                  </Key>
                </div>
              )}
            </div>
            <span className="px-3 font-print text-[12.5px] md:border-r md:border-toner/40 md:py-4">{s.format}</span>
            <span className="px-3 pb-3 font-print text-[12.5px] md:py-4">{s.duration || '—'}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function HowItWorks() {
  const [ref, seen] = useSeen<HTMLOListElement>();
  return (
    <>
      <PageTitle sub="Standard operating procedure for candidates. Four steps, in order.">How Lokus works</PageTitle>
      <ol ref={ref} className="mt-8 flex flex-col">
        {STEPS.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[2.5rem_1fr_2rem] items-start gap-4 border-t border-dashed border-toner/25 py-5 first:border-t-0">
            <span className="font-print-label text-[26px] font-bold leading-none text-copper">{String(i + 1).padStart(2, '0')}</span>
            <span>
              <span className="block font-print-label text-[17px] font-bold uppercase tracking-[0.06em]">{s.title}</span>
              <span className="mt-1 block text-[15px] leading-relaxed text-ink-2">{s.body}</span>
            </span>
            <span className="relative mt-1 inline-flex size-6 border-[1.5px] border-toner/60">
              <InkStroke ink={INK.check} play={seen} delay={0.3 + i * 0.35} duration={0.35} className="absolute -left-0.5 -top-2 h-7 w-8" />
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function Figures() {
  return (
    <>
      <PageTitle>Key figures</PageTitle>
      <table className="mt-8 w-full border-collapse font-print text-[14px]">
        <tbody>
          {STATS.map((s, i) => (
            <tr key={s.unit} className="border-t border-toner/20 first:border-t-0">
              <th scope="row" className="w-28 py-5 pr-4 sm:w-40 text-left align-baseline">
                <span className="font-serif text-[52px] font-normal leading-none sm:text-[64px]">
                  <Marker delay={i * 200}>{s.value}</Marker>
                </span>
              </th>
              <td className="py-5 align-baseline">
                <span className="block font-print-label text-[16px] font-bold uppercase tracking-[0.08em]">{s.unit}</span>
                <span className="text-toner/70">{s.body}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 border-t border-toner/20 pt-4 text-[14.5px] text-ink-2">Every score links back to what the candidate did.</p>
    </>
  );
}

function ForEmployers() {
  return (
    <>
      <PageTitle sub={`Built for ${AUDIENCES.slice(0, -1).join(', ').toLowerCase()} and ${AUDIENCES.at(-1)?.toLowerCase()}.`}>Hiring decisions you can explain.</PageTitle>
      <ul className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2">
        {BENEFITS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <DrawnIcon className="mt-1 [&_svg]:size-5">
              <Icon />
            </DrawnIcon>
            <span>
              <span className="block font-print-label text-[16px] font-bold">{title}</span>
              <span className="mt-0.5 block text-[14.5px] text-ink-2">{body}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-9">
        <Key to="/request-access">
          <Mail className="size-4" aria-hidden /> Request employer access
        </Key>
      </div>
    </>
  );
}

function Criteria() {
  return (
    <>
      <PageTitle sub="Scored by a deterministic engine against a published rubric, with the writing rated blind by trained assessors.">Assessment criteria</PageTitle>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {COMPETENCIES.map((c, i) => (
          <div key={c.title} className="rounded-[3px] border-l-4 bg-[#fbf6ec] px-5 py-4" style={{ borderColor: TABS[i].color }}>
            <p className="font-print text-[11px] uppercase tracking-[0.18em] text-toner/50">Criterion 0{i + 1}</p>
            <p className="mt-1 font-serif text-[21px] leading-tight">{c.title}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{c.body}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function BackCover() {
  const [ref, seen] = useSeen<HTMLDivElement>('0px 0px -20% 0px');
  return (
    <section className="mt-16">
      <div ref={ref} className="lk-vinyl relative overflow-hidden rounded-[10px] px-6 py-14 text-center text-white shadow-[0_30px_50px_-20px_rgb(20_25_35/0.75)] sm:px-14 sm:py-20">
        <span aria-hidden className="absolute inset-y-0 right-0 w-7 bg-[linear-gradient(270deg,rgb(0_0_0/0.35),rgb(255_255_255/0.06)_60%,rgb(0_0_0/0.2))]" />
        <h2 className="mx-auto max-w-2xl font-serif text-[32px] leading-[1.1] sm:text-[44px]">{MISSION.title}</h2>
        <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-white/70">{MISSION.body}</p>
        <div className="mt-9 flex justify-center">
          <Key to="/signup" size="lg" tone="paper" arrow>
            Create your account
          </Key>
        </div>
        {/* A printed sticker on the vinyl, since ink would not show on it. */}
        <m.span
          aria-hidden
          className="absolute right-8 top-8 hidden rotate-6 rounded-[4px] bg-paper px-3 py-2 sm:block"
          initial={{ opacity: 0, scale: 1.3 }}
          animate={seen ? { opacity: 1, scale: 1 } : undefined}
          transition={{ delay: 0.5, type: 'spring', stiffness: 400, damping: 22 }}
        >
          <Stamp tone="copper" sub="Lokus" className="text-[12px]">
            Merit first
          </Stamp>
        </m.span>
        <Barcode seed="LOKUS-01" className="mx-auto mt-10 h-8 w-40 invert" />
      </div>
    </section>
  );
}
