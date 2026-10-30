import { Check } from 'lucide-react';
import { EASE_OUT, m } from '@/ui/motion';

const CRF_ROWS = [
  [70, 55, 62, 48],
  [52, 66, 44, 58],
  [64, 40, 70, 52],
  [46, 60, 50, 66],
  [58, 48, 62, 40],
];
const BARS = [
  ['Safety awareness', 88],
  ['Integrity', 76],
  ['Data quality', 92],
  ['Communication', 70],
] as const;

const enter = (delay: number, rotate = 0) => ({
  initial: { opacity: 0, y: 28, rotate },
  animate: { opacity: 1, y: 0, rotate },
  transition: { delay, duration: 0.8, ease: EASE_OUT },
});

/** Landing-page product illustration: a form under review, an inbox and a result report. Pure SVG/CSS, no photos. */
export function HeroShowcase() {
  return (
    <div className="relative aspect-[5/4] w-full select-none" role="img" aria-label="Illustration of Lokus: a case report form under review, an inbox, and a result report with competency bars">
      <div aria-hidden className="absolute inset-0 overflow-hidden rounded-[28px] border border-line bg-surface">
        <div className="dot-grid absolute inset-0" />
        <div className="absolute -left-20 -top-20 size-80 rounded-full bg-accent-soft blur-3xl animate-drift" />
        <div className="absolute -bottom-24 -right-16 size-96 rounded-full bg-[#efe6da] blur-3xl animate-drift [animation-delay:-7s]" />
      </div>

      {/* Case report form under review: a highlight walks from value to value. */}
      <m.div aria-hidden className="absolute left-[5%] top-[7%] w-[60%] rounded-2xl border border-paper-line bg-paper p-4 shadow-pop" {...enter(0.15, -2)}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Case report form</span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">Under review</span>
        </div>
        <div className="relative mt-3 grid grid-cols-4 gap-x-2 gap-y-2">
          {CRF_ROWS.flatMap((row, r) =>
            row.map((w, c) => (
              <div key={`${r}-${c}`} className="flex h-[22px] items-center rounded-[5px] border border-paper-line bg-surface/80 px-1.5">
                <div className="h-1.5 rounded-full bg-line-strong/70" style={{ width: `${w}%` }} />
              </div>
            )),
          )}
          <m.div
            className="pointer-events-none absolute h-[22px] w-[calc(25%-6px)] rounded-[5px] ring-2 ring-copper/80"
            animate={{ left: ['0%', '25.5%', '76.5%', '51%', '0%'], top: [0, 60, 30, 90, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
          />
        </div>
      </m.div>

      {/* Inbox with an unread message. */}
      <m.div aria-hidden className="absolute right-[4%] top-[20%] w-[42%] rounded-2xl border border-line bg-surface p-3.5 shadow-pop" {...enter(0.35, 2)}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-ink">Inbox</span>
          <span className="text-[10px] font-medium text-muted">3 new</span>
        </div>
        <div className="mt-2.5 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-line/70 bg-canvas/70 p-2">
              <span className={`size-6 shrink-0 rounded-full ${['bg-accent-soft', 'bg-[#e7ecf3]', 'bg-[#eaf3ee]'][i]}`} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="h-1.5 rounded-full bg-ink/25" style={{ width: `${[70, 56, 64][i]}%` }} />
                <span className="h-1.5 rounded-full bg-line-strong/70" style={{ width: `${[88, 74, 80][i]}%` }} />
              </span>
              {i === 0 && <span className="size-2 shrink-0 rounded-full bg-copper animate-pulse-ring" />}
            </div>
          ))}
        </div>
      </m.div>

      {/* Result report: competency bars fill in. */}
      <m.div aria-hidden className="absolute bottom-[6%] left-[14%] w-[54%] rounded-2xl border border-line bg-surface p-4 shadow-pop" {...enter(0.55)}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-ink">Result report</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
            <Check className="size-3" /> Meets bar
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {BARS.map(([label, value], i) => (
            <div key={label} className="grid grid-cols-[92px_1fr] items-center gap-2">
              <span className="truncate text-[10px] text-muted">{label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-subtle">
                <m.span className="block h-full rounded-full bg-gradient-to-r from-accent to-copper" initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ delay: 0.9 + i * 0.12, duration: 0.9, ease: EASE_OUT }} />
              </span>
            </div>
          ))}
        </div>
      </m.div>

      <m.div
        aria-hidden
        className="absolute right-[6%] top-[6%] flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[11px] font-semibold text-ink shadow-pop"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.4, duration: 0.5, ease: EASE_OUT }}
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="size-3" />
        </span>
        <span className="animate-float">Every action saved</span>
      </m.div>
    </div>
  );
}
