import { EASE_OUT, m } from '@/ui/motion';

const ACTIVITY = [
  ['08:30', 'Signed in'],
  ['08:34', 'Record reviewed'],
  ['08:47', 'Document opened'],
  ['09:02', 'Draft saved'],
];

/** Right-hand panel of the sign-in pages: drawn rings, a drifting glow and a live-looking activity card. */
export function AuthArt() {
  return (
    <div className="relative hidden overflow-hidden bg-ink lg:block" aria-hidden>
      <div className="absolute -right-24 -top-24 size-[30rem] rounded-full bg-copper/35 blur-3xl animate-drift" />
      <div className="absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-[#40536b]/70 blur-3xl animate-drift [animation-delay:-9s]" />
      <svg viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id="auth-ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#e8cfc5" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {Array.from({ length: 9 }, (_, i) => (
          <m.circle
            key={i}
            cx="440"
            cy="230"
            r={46 + i * 44}
            fill="none"
            stroke="url(#auth-ring)"
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 - i * 0.09 }}
            transition={{ delay: 0.15 + i * 0.09, duration: 1.8, ease: EASE_OUT }}
          />
        ))}
        <m.circle cx="440" cy="230" r="4" fill="#e8cfc5" animate={{ r: [4, 7, 4], opacity: [0.9, 0.4, 0.9] }} transition={{ duration: 3, repeat: Infinity }} />
      </svg>

      <m.div
        className="absolute left-12 top-14 w-72 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.7, ease: EASE_OUT }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Activity</p>
        <ol className="mt-3 flex flex-col gap-2.5">
          {ACTIVITY.map(([time, label], i) => (
            <m.li key={label} className="flex items-center gap-3 text-sm text-white/85" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.18, duration: 0.5, ease: EASE_OUT }}>
              <span className="w-10 text-xs tabular text-white/45">{time}</span>
              <span className={`size-1.5 rounded-full ${i === ACTIVITY.length - 1 ? 'bg-copper animate-pulse-ring' : 'bg-white/40'}`} />
              {label}
            </m.li>
          ))}
        </ol>
      </m.div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/70 to-transparent p-12 pt-24 text-white">
        <p className="max-w-md font-serif text-[30px] leading-snug">Judge the work, not the interview.</p>
        <p className="mt-3 max-w-md text-sm text-white/75">Realistic clinical-research workdays, scored against a published rubric and reviewed by trained assessors.</p>
      </div>
    </div>
  );
}
