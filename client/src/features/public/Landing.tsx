import { ArrowRight, ClipboardList, FileSearch, Lock, Mail, Scale, ShieldCheck, Timer, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/ui/Button';
import { Reveal, Stagger, StaggerItem } from '@/ui/motion';
import { CountUp } from '@/visuals/CountUp';
import { HeroShowcase } from '@/visuals/HeroShowcase';

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <StaggerItem className="flex gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent [&_svg]:size-5">{icon}</div>
      <div>
        <h3 className="font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
      </div>
    </StaggerItem>
  );
}

const STEPS = [
  { n: '01', title: 'Invite or sign up', body: 'Employers invite candidates by email. Candidates can also create an account and take the simulation on their own.' },
  { n: '02', title: 'Work two realistic days', body: 'In the browser, candidates review case report forms and study documents, then handle a difficult sponsor request — saving as they go.' },
  { n: '03', title: 'Scored, then reviewed', body: 'Recorded actions are scored against a published rubric. Trained assessors rate the written work before any result is released.' },
];

// Public, candidate-readable descriptions: deliberately general so they never hint at what the simulation contains.
const COMPETENCIES = [
  ['Safety awareness', 'Recognising when something could affect the people taking part in a study, and acting on it.'],
  ['Integrity', 'Doing the right thing for the study and its participants, even when it is inconvenient.'],
  ['Data quality', 'Careful, well-documented review of study records against the study documents.'],
  ['Professional communication', 'Clear, neutral and courteous writing with colleagues, sites and sponsors.'],
];

export function Landing() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Work-simulation assessments for clinical research</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">See how candidates actually work — before you hire them.</h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
            Lokus places candidates in a realistic Clinical Trial Associate role for two workdays. Every action is recorded, scored against a published rubric and checked by trained assessors.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/signup">
                Create a candidate account <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#employers">I&rsquo;m hiring</a>
            </Button>
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm text-muted">
            <Lock className="size-4" aria-hidden /> Candidates decide who sees their results.
          </p>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-6">
            {(
              [
                [2, 'simulated workdays'],
                [12, 'participant records'],
                [0, 'AI in scoring'],
              ] as const
            ).map(([v, l]) => (
              <div key={l} className="flex flex-col-reverse">
                <dt className="text-xs leading-tight text-muted">{l}</dt>
                <dd className="text-2xl font-semibold text-ink tabular">
                  <CountUp to={v} />
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
        <div className="relative">
          <HeroShowcase />
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">How it works</h2>
          </Reveal>
          <Stagger as="ol" inView className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <StaggerItem as="li" key={s.n} className="rounded-xl border border-line bg-canvas p-6 transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-pop">
                <p className="font-serif text-2xl text-copper">{s.n}</p>
                <h3 className="mt-3 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section id="employers" className="mx-auto grid max-w-6xl scroll-mt-20 gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">For employers</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Hiring decisions you can explain.</h2>
          <p className="mt-4 text-ink-2">Each result shows the outcome, a score for each workday, the competencies behind it and links to the candidate&rsquo;s actual work — so you can see why two candidates differ.</p>
          <Button asChild className="mt-8" size="lg">
            <a href="mailto:hello@lokus.example?subject=Lokus%20access">
              <Mail /> Request employer access
            </a>
          </Button>
        </Reveal>
        <Stagger inView className="grid gap-7">
          <Feature icon={<FileSearch />} title="Evidence you can inspect">
            Every score links back to what the candidate did: their findings, escalations, replies and records.
          </Feature>
          <Feature icon={<Scale />} title="Consistent and fair">
            Every candidate gets the same workdays and the same rubric. Automated criteria are deterministic; written work is rated by trained assessors.
          </Feature>
          <Feature icon={<ShieldCheck />} title="Integrity built in">
            Critical failures are flagged on their own, whatever the overall score — a strong average never hides them.
          </Feature>
          <Feature icon={<Users />} title="Your team, your candidates">
            Invite candidates individually or in bulk, follow their progress and compare results side by side.
          </Feature>
        </Stagger>
      </section>

      <section id="candidates" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <Reveal className="lg:order-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">For candidates</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Show the work, not just the CV.</h2>
            <p className="mt-4 text-ink-2">Step into a Clinical Trial Associate role at a fictional CRO. There are no trick questions — just the kind of work the job involves.</p>
            <Button asChild className="mt-8" size="lg">
              <Link to="/signup">
                Create your account <ArrowRight />
              </Link>
            </Button>
          </Reveal>
          <Stagger inView className="grid gap-7 lg:order-1">
            <Feature icon={<Timer />} title="At your own pace">
              Workday 1 takes about an hour; Workday 2 about thirty minutes. Your progress is saved, so you can take a break between them.
            </Feature>
            <Feature icon={<UserRound />} title="You control your result">
              Invited by an employer? They see your result for that invitation. Otherwise it stays private unless you choose to join the talent pool.
            </Feature>
            <Feature icon={<ClipboardList />} title="Everything you need is inside">
              The protocol, the data dictionary, the consent form and your team&rsquo;s inbox are all part of the simulation.
            </Feature>
          </Stagger>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">What the Clinical Trial Associate simulation looks at</h2>
        </Reveal>
        <Stagger inView className="mt-8 grid gap-4 sm:grid-cols-2">
          {COMPETENCIES.map(([title, body]) => (
            <StaggerItem key={title} className="rounded-xl border border-line bg-surface p-6 transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-pop">
              <h3 className="font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="px-4 pb-20 sm:px-6">
        <Reveal className="relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 overflow-hidden rounded-2xl bg-ink px-8 py-10 text-white sm:flex-row sm:items-center">
          <div aria-hidden className="absolute -right-16 -top-24 size-72 rounded-full bg-copper/30 blur-3xl animate-drift" />
          <div className="relative">
            <h2 className="text-2xl font-semibold tracking-tight">Ready to see the work?</h2>
            <p className="mt-1.5 text-white/75">Create an account in a minute, or talk to us about hiring with Lokus.</p>
          </div>
          <div className="relative flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/signup">Create account</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
              <a href="mailto:hello@lokus.example?subject=Lokus%20access">Contact us</a>
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
