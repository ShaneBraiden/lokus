import { Link } from 'react-router';
import { Alert } from '@/ui/Alert';
import { buttonVariants } from '@/ui/Button';

const SECTIONS = {
  privacy: {
    title: 'Privacy notice',
    body: [
      ['What we collect', 'Your account details (name, email, password hash), the profile details you add, and everything you do inside a simulation: what you open, the findings, messages and records you write, and when.'],
      ['Why', 'To run the assessment, to score your work against the published rubric, and to let trained Lokus assessors review it. Scoring is automated and deterministic; no AI model scores or reviews your work.'],
      ['Who sees your result', 'If an employer invited you, that employer sees your result for that invitation. A later employer sees an existing result only if you approve it. If you joined on your own, your result stays private unless you opt in to the talent pool. Candidates never see scores.'],
      ['Your choices', 'You can leave the talent pool or revoke an employer’s access at any time from Privacy & sharing. Contact us to export or delete your account data.'],
      ['Retention', 'Assessment evidence is kept for as long as it is needed to support hiring decisions made with it, and is protected against alteration.'],
    ],
  },
  terms: {
    title: 'Terms of use',
    body: [
      ['The simulation', 'NorthrSim is fictional training material. Study AHS-DM-026, the organisations and the people in it are invented. Nothing in it is medical advice.'],
      ['Your attempt', 'Complete the assessment yourself, without help from others. Each candidate takes a given simulation version once; Lokus may grant a retake.'],
      ['Confidentiality', 'Do not copy or share the simulation content.'],
      ['Accounts', 'Keep your password secure. Lokus staff accounts use two-step sign-in.'],
    ],
  },
} as const;

export function Legal({ page }: { page: keyof typeof SECTIONS }) {
  const s = SECTIONS[page];
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{s.title}</h1>
      <Alert tone="warning" className="mt-6">
        Draft wording for review by legal counsel before launch.
      </Alert>
      <div className="mt-8 flex flex-col gap-7">
        {s.body.map(([h, p]) => (
          <section key={h}>
            <h2 className="font-semibold text-ink">{h}</h2>
            <p className="mt-1.5 leading-relaxed text-ink-2">{p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-serif text-6xl text-copper">404</p>
      <h1 className="mt-4 text-xl font-semibold text-ink">We couldn&rsquo;t find that page</h1>
      <p className="mt-2 text-sm text-muted">The link may be old, or the page may have moved.</p>
      <Link to="/" className={buttonVariants({ className: 'mt-6' })}>
        Go to the home page
      </Link>
    </div>
  );
}
