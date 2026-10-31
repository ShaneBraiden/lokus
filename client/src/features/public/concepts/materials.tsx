import { ArrowRight } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useInView, useReducedMotion } from 'motion/react';
import { homeFor, useMe } from '@/lib/auth';
import { cn } from '@/ui/cn';
import { EASE_OUT, m } from '@/ui/motion';
import './realism.css';

/**
 * Physical materials shared by the landing concepts: paper, ink, stamps, tape, a pen and keys that press. Illustrative
 * documents use invented, clearly labelled specimen content only, never anything from the assessment itself.
 */

type Margin = NonNullable<Parameters<typeof useInView>[1]>['margin'];

/** True once the element has scrolled into view. */
export function useSeen<T extends Element>(margin: Margin = '0px 0px -12% 0px') {
  const ref = useRef<T>(null);
  const seen = useInView(ref, { once: true, margin });
  return [ref, seen] as const;
}

/** Whether a media query matches, kept in step with the window. */
export function useMedia(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** SVG ids that are safe inside url(#…). */
export function useSvgId() {
  return useId().replace(/[^a-zA-Z0-9_-]/g, '');
}

export function useAccountHome(): string | null {
  const { data: me } = useMe();
  return me ? homeFor(me) : null;
}

type KeyTone = 'copper' | 'paper' | 'ink';
const KEY_TONE: Record<KeyTone, string> = {
  copper: 'bg-[linear-gradient(180deg,#c76c4d_0%,#a9553a_100%)] text-white [--key-edge:#7a3925]',
  paper: 'bg-[linear-gradient(180deg,#fffdf8_0%,#eee6d8_100%)] text-toner [--key-edge:#c7b9a3]',
  ink: 'bg-[linear-gradient(180deg,#343e4d_0%,#1c2430_100%)] text-white [--key-edge:#080b10]',
};

/** A call to action built like a physical key: it stands proud of the surface and travels when pressed. */
export function Key({
  to,
  onClick,
  children,
  tone = 'copper',
  size = 'md',
  arrow,
  className,
}: {
  to?: string;
  onClick?: () => void;
  children: ReactNode;
  tone?: KeyTone;
  size?: 'sm' | 'md' | 'lg';
  arrow?: boolean;
  className?: string;
}) {
  const cls = cn(
    'group/key relative inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap font-semibold',
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.32),0_4px_0_var(--key-edge),0_10px_16px_-6px_rgb(60_45_30/0.5)] transition-[translate,box-shadow] duration-100 ease-out',
    'hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.32),0_5px_0_var(--key-edge),0_14px_20px_-8px_rgb(60_45_30/0.5)]',
    'active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_0_var(--key-edge),0_3px_6px_-2px_rgb(60_45_30/0.4)]',
    { sm: 'h-8 rounded-[8px] px-3 text-[13px]', md: 'h-10 rounded-[10px] px-4 text-sm', lg: 'h-12 rounded-[11px] px-6 text-[15px]' }[size],
    KEY_TONE[tone],
    className,
  );
  const body = (
    <>
      {children}
      {arrow && <ArrowRight className="size-4 transition-transform duration-200 group-hover/key:translate-x-0.5" aria-hidden />}
    </>
  );
  if (!to)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  return to.startsWith('#') ? (
    <a href={to} className={cls}>
      {body}
    </a>
  ) : (
    <Link to={to} className={cls}>
      {body}
    </Link>
  );
}

/** Sign in and create account, or the way back to the dashboard. */
export function AccountKeys({ linkClassName }: { linkClassName?: string }) {
  const home = useAccountHome();
  if (home)
    return (
      <Key to={home} size="sm">
        Go to dashboard
      </Key>
    );
  return (
    <div className="flex items-center gap-1.5 sm:gap-2.5">
      <Link to="/login" className={cn('rounded-md px-2 py-1.5 text-sm font-semibold text-toner/75 hover:text-toner', linkClassName)}>
        Sign in
      </Link>
      <Key to="/signup" size="sm">
        Create account
      </Key>
    </div>
  );
}

const SHEET_TONE = {
  white: 'bg-paper',
  ivory: 'bg-[#fbf6ec]',
  yellow: 'bg-[#fdf2b5]',
  pink: 'bg-[#f9e0df]',
  thermal: 'bg-[#fbfbf7]',
} as const;
const RESTING = 'shadow-[0_1px_1px_rgb(0_0_0/0.08),0_2px_4px_rgb(60_45_30/0.1),0_18px_36px_-12px_rgb(60_45_30/0.4)]';
const LIFTED = 'shadow-[0_2px_4px_rgb(0_0_0/0.08),0_26px_30px_-12px_rgb(60_45_30/0.38),0_48px_70px_-24px_rgb(60_45_30/0.5)]';
const HOLES = ['top-[14%]', 'top-1/2', 'bottom-[14%]'];

/** A sheet of paper: grain, light falling across it, optional binder holes and the rest of the pile underneath. */
export function Sheet({
  children,
  className,
  faceClassName,
  tone = 'white',
  holes,
  stack,
  lifted,
  style,
}: {
  children?: ReactNode;
  className?: string;
  faceClassName?: string;
  tone?: keyof typeof SHEET_TONE;
  holes?: boolean;
  stack?: boolean;
  lifted?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div className={cn('relative', className)} style={style}>
      {stack && (
        <>
          <div aria-hidden className="absolute inset-x-2 -bottom-1.5 top-2 rotate-[0.8deg] rounded-[2px] bg-[#f4efe5] shadow-[0_1px_2px_rgb(0_0_0/0.12),0_8px_18px_-8px_rgb(60_45_30/0.35)]" />
          <div aria-hidden className="absolute inset-x-1 -bottom-0.5 top-1 -rotate-[0.5deg] rounded-[2px] bg-[#faf6ee] shadow-[0_1px_2px_rgb(0_0_0/0.1)]" />
        </>
      )}
      {/* No overflow clipping: a pen or a stamp may hang over the edge of the sheet. */}
      <div className={cn('paper-grain relative h-full rounded-[2px] transition-shadow duration-300', SHEET_TONE[tone], lifted ? LIFTED : RESTING, faceClassName)}>
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(115deg,rgb(255_255_255/0.16)_0%,transparent_28%,transparent_72%,rgb(120_95_60/0.06)_100%)]" />
        {holes &&
          HOLES.map((pos) => (
            <span key={pos} aria-hidden className={cn('absolute left-[3.2%] size-[1.1em] min-h-3 min-w-3 -translate-y-1/2 rounded-full bg-desk shadow-[inset_0_1.5px_2px_rgb(60_45_30/0.45)]', pos)} />
          ))}
        <div className="relative h-full">{children}</div>
      </div>
    </div>
  );
}

/** A strip of masking tape. Position it with className. */
export function Tape({ className }: { className?: string }) {
  return <span aria-hidden className={cn('lk-tape pointer-events-none absolute z-10 block h-6 w-24', className)} />;
}

export function Paperclip({ className }: { className?: string }) {
  const id = useSvgId();
  return (
    <svg viewBox="0 0 28 80" className={cn('pointer-events-none drop-shadow-[1px_2px_1.5px_rgb(60_45_30/0.35)]', className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor="#7f8389" />
          <stop offset=".45" stopColor="#f4f5f6" />
          <stop offset="1" stopColor="#959aa0" />
        </linearGradient>
      </defs>
      <path d="M9 62 V16 a7 7 0 0 1 14 0 V60 a10 10 0 0 1 -20 0 V20" fill="none" stroke={`url(#${id})`} strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

export function BinderClip({ className }: { className?: string }) {
  const id = useSvgId();
  return (
    <svg viewBox="0 0 90 70" className={cn('pointer-events-none drop-shadow-[2px_4px_3px_rgb(40_30_20/0.4)]', className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}w`} x1="0" x2="1">
          <stop offset="0" stopColor="#8d9298" />
          <stop offset=".5" stopColor="#f2f3f4" />
          <stop offset="1" stopColor="#8d9298" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3f47" />
          <stop offset="1" stopColor="#14171b" />
        </linearGradient>
      </defs>
      <path d="M22 34 L14 4 M68 34 L76 4 M14 4 L76 4" fill="none" stroke={`url(#${id}w)`} strokeWidth="3" strokeLinecap="round" />
      <path d="M10 30 H80 L86 66 H4 Z" fill={`url(#${id}b)`} />
      <path d="M12 33 H78" stroke="#fff" strokeOpacity=".18" strokeWidth="2" />
    </svg>
  );
}

/** A ballpoint pen seen from above, tip to the left. */
export function Pen({ className, style }: { className?: string; style?: CSSProperties }) {
  const id = useSvgId();
  return (
    <svg viewBox="0 0 300 30" className={cn('pointer-events-none drop-shadow-[6px_10px_5px_rgb(60_45_30/0.32)]', className)} style={style} aria-hidden>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4b68c6" />
          <stop offset=".38" stopColor="#2b4596" />
          <stop offset=".78" stopColor="#1a2c68" />
          <stop offset="1" stopColor="#0f1b44" />
        </linearGradient>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbfbfa" />
          <stop offset=".45" stopColor="#bdbdb8" />
          <stop offset=".62" stopColor="#85857f" />
          <stop offset="1" stopColor="#dadad5" />
        </linearGradient>
      </defs>
      <path d="M1 15 L21 10.5 L21 19.5 Z" fill={`url(#${id}m)`} />
      <circle cx="1.6" cy="15" r="1.3" fill="#1b1b1b" />
      <rect x="20" y="8.5" width="44" height="13" rx="2.5" fill="#22262e" />
      {[28, 34, 40, 46, 52].map((x) => (
        <rect key={x} x={x} y="9" width="1.6" height="12" fill="#3a3f49" />
      ))}
      <rect x="61" y="6" width="225" height="18" rx="4" fill={`url(#${id}b)`} />
      <rect x="282" y="7" width="17" height="16" rx="5" fill={`url(#${id}m)`} />
      <rect x="196" y="2" width="86" height="7" rx="3.5" fill={`url(#${id}m)`} />
      <rect x="67" y="9" width="212" height="2.2" rx="1.1" fill="#fff" opacity=".35" />
    </svg>
  );
}

type StampTone = 'copper' | 'green' | 'red' | 'pen';
const STAMP_TONE: Record<StampTone, string> = {
  copper: 'text-[#b4573a]',
  green: 'text-[#1f7a52]',
  red: 'text-[#b4261c]',
  pen: 'text-pen',
};

/** Rubber-stamp impression: double border, condensed capitals, uneven ink. Sizes in em, so set a font size. */
export function Stamp({ children, sub, tone = 'copper', className }: { children: ReactNode; sub?: ReactNode; tone?: StampTone; className?: string }) {
  return (
    <span
      className={cn(
        'lk-ink-grunge inline-flex flex-col items-center rounded-[0.35em] border-[0.17em] border-current px-[0.7em] py-[0.4em] font-print-label uppercase leading-none opacity-[0.88] shadow-[inset_0_0_0_0.14em_transparent,inset_0_0_0_0.24em_currentColor]',
        STAMP_TONE[tone],
        className,
      )}
    >
      <span className="font-bold tracking-[0.2em]">{children}</span>
      {sub && <span className="mt-[0.35em] w-full border-t-[0.09em] border-current pt-[0.3em] text-center text-[0.52em] font-semibold tracking-[0.3em]">{sub}</span>}
    </span>
  );
}

/** A stamp that comes down onto the page when `play` turns true. */
export function StampDown({ play, delay = 0, rotate = -8, className, children }: { play: boolean; delay?: number; rotate?: number; className?: string; children: ReactNode }) {
  return (
    <m.div
      aria-hidden
      className={cn('pointer-events-none absolute mix-blend-multiply', className)}
      initial={{ opacity: 0, scale: 2.3, rotate: rotate - 12 }}
      animate={play ? { opacity: 1, scale: 1, rotate } : undefined}
      transition={{ delay, type: 'spring', stiffness: 560, damping: 24, mass: 0.7 }}
    >
      {children}
    </m.div>
  );
}

/** Hand-drawn pen strokes, in their own viewBox. */
export const INK = {
  circle: { viewBox: '0 0 120 56', d: 'M14 30 C 8 15, 40 5, 70 7 C 100 9, 116 19, 112 32 C 108 46, 72 52, 44 49 C 20 46, 6 37, 16 22 C 20 16, 30 12, 42 10' },
  underline: { viewBox: '0 0 300 16', d: 'M4 10 C 60 4, 120 12, 180 7 S 262 5, 296 9' },
  check: { viewBox: '0 0 32 28', d: 'M3 15 C 6 17, 9 21, 12 24 C 16 16, 22 8, 30 3' },
  arrow: { viewBox: '0 0 120 70', d: ['M6 8 C 40 2, 88 14, 104 54', 'M90 46 L104 56 L110 39'] },
  arrowDown: { viewBox: '0 0 60 120', d: ['M30 4 C 18 40, 42 70, 28 110', 'M16 98 L28 112 L40 97'] },
  arrowRight: { viewBox: '0 0 120 40', d: ['M4 10 C 34 30, 74 32, 112 22', 'M98 12 L113 22 L100 33'] },
  box: { viewBox: '0 0 30 30', d: 'M3 4 L26 3 L27 26 L4 27 Z' },
} as const;

/** Pen strokes that draw themselves when `play` turns true (or when scrolled into view if `play` is not given). */
export function InkStroke({
  ink,
  className,
  delay = 0,
  duration = 0.8,
  play,
  linear,
  color = 'var(--lk-pen)',
  width = 2.6,
}: {
  ink: { viewBox: string; d: string | readonly string[] };
  className?: string;
  delay?: number;
  duration?: number;
  play?: boolean;
  /** Constant speed, for a stroke a drawn pen has to keep up with. */
  linear?: boolean;
  color?: string;
  width?: number;
}) {
  const [ref, seen] = useSeen<SVGSVGElement>();
  const go = play ?? seen;
  const paths = typeof ink.d === 'string' ? [ink.d] : ink.d;
  return (
    <svg ref={ref} viewBox={ink.viewBox} className={cn('pointer-events-none overflow-visible', className)} fill="none" aria-hidden>
      {paths.map((d, i) => (
        <m.path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={go ? { pathLength: 1, opacity: 1 } : undefined}
          transition={{
            pathLength: { delay: delay + i * duration * 0.9, duration: i === 0 ? duration : duration * 0.4, ease: linear ? 'linear' : [0.45, 0, 0.3, 1] },
            opacity: { delay: delay + i * duration * 0.9, duration: 0.01 },
          }}
        />
      ))}
    </svg>
  );
}

/** Points along INK.circle (cubic segments sampled evenly), as percentages of its viewBox, for a pen to follow. */
const CIRCLE_TRACE = (() => {
  const segs = [
    [[14, 30], [8, 15], [40, 5], [70, 7]],
    [[70, 7], [100, 9], [116, 19], [112, 32]],
    [[112, 32], [108, 46], [72, 52], [44, 49]],
    [[44, 49], [20, 46], [6, 37], [16, 22]],
    [[16, 22], [20, 16], [30, 12], [42, 10]],
  ];
  const at = (a: number, b: number, c: number, d: number, t: number) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
  const pts: [string, string][] = [];
  for (const [a, b, c, d] of segs) {
    for (let i = 0; i < 8; i++) {
      const t = i / 8;
      pts.push([`${(at(a[0], b[0], c[0], d[0], t) / 120) * 100}%`, `${(at(a[1], b[1], c[1], d[1], t) / 56) * 100}%`]);
    }
  }
  pts.push([`${(42 / 120) * 100}%`, `${(10 / 56) * 100}%`]);
  return pts;
})();
export const PEN_APPROACH = 0.55;
export const PEN_DRAW = 0.95;
const PEN_LEAVE = 0.75;

/** A pen that comes in, traces INK.circle in time with the ink, then is laid down. Sits in the circle's own box. */
function PenFollower({ play, delay }: { play: boolean; delay: number }) {
  const total = PEN_APPROACH + PEN_DRAW + PEN_LEAVE;
  const a = PEN_APPROACH / total;
  const b = (PEN_APPROACH + PEN_DRAW) / total;
  const times = [0, ...CIRCLE_TRACE.map((_, i) => a + ((b - a) * i) / (CIRCLE_TRACE.length - 1)), 1];
  const left = ['330%', ...CIRCLE_TRACE.map((p) => p[0]), '250%'];
  const top = ['-260%', ...CIRCLE_TRACE.map((p) => p[1]), '330%'];
  return (
    <m.span
      aria-hidden
      className="pointer-events-none absolute z-20 size-0"
      initial={{ left: left[0], top: top[0], opacity: 0 }}
      animate={play ? { left, top, opacity: 1 } : undefined}
      transition={{ delay, duration: total, ease: 'linear', times, opacity: { delay, duration: 0.2 } }}
    >
      <m.span className="absolute left-0 top-0 block origin-left" initial={{ rotate: -40 }} animate={play ? { rotate: [-40, -40, -40, -14] } : undefined} transition={{ delay, duration: total, times: [0, a, b, 1], ease: EASE_OUT }}>
        <Pen className="absolute left-0 top-0 h-[2.1em] w-[21em] -translate-y-1/2" />
      </m.span>
    </m.span>
  );
}

/** Handwriting that appears left to right, as if being written. */
export function Handwriting({ children, className, delay = 0, duration = 1.1, play }: { children: ReactNode; className?: string; delay?: number; duration?: number; play?: boolean }) {
  const [ref, seen] = useSeen<HTMLSpanElement>();
  const go = play ?? seen;
  return (
    <m.span
      ref={ref}
      className={cn('inline-block font-hand font-semibold text-pen', className)}
      initial={{ clipPath: 'inset(-30% 100% -30% 0%)' }}
      animate={go ? { clipPath: 'inset(-30% 0% -30% 0%)' } : undefined}
      transition={{ delay, duration, ease: 'linear' }}
    >
      {children}
    </m.span>
  );
}

/** A highlighter pass over the words. */
export function Marker({ children, delay = 0, play }: { children: ReactNode; delay?: number; play?: boolean }) {
  const [ref, seen] = useSeen<HTMLElement>();
  return (
    <mark ref={ref} data-on={play ?? seen} className="lk-marker" style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </mark>
  );
}

/** Line icons drawn on in pen once they are in view. */
export function DrawnIcon({ children, className }: { children: ReactNode; className?: string }) {
  const [ref, seen] = useSeen<HTMLSpanElement>();
  return (
    <span ref={ref} data-on={seen} className={cn('lk-draw inline-flex text-pen', className)} aria-hidden>
      {children}
    </span>
  );
}

const NOTE_TONE = {
  yellow: 'bg-[linear-gradient(180deg,#fff2a3_0%,#fde98a_16%,#fae07a_100%)]',
  pink: 'bg-[linear-gradient(180deg,#ffd6dc_0%,#fcc6cf_16%,#f9b9c4_100%)]',
  blue: 'bg-[linear-gradient(180deg,#d8ecfb_0%,#c6e2f8_16%,#b8daf4_100%)]',
  green: 'bg-[linear-gradient(180deg,#dcf3cf_0%,#cdecbd_16%,#c0e5ae_100%)]',
} as const;

/** A sticky note with its adhesive strip and a lifted bottom edge. */
export function StickyNote({ children, className, tone = 'yellow' }: { children: ReactNode; className?: string; tone?: keyof typeof NOTE_TONE }) {
  return (
    <div className={cn('relative px-4 pb-5 pt-6 font-hand text-[22px] font-semibold leading-[1.1] text-toner/85 shadow-[0_1px_1px_rgb(0_0_0/0.08),0_18px_14px_-14px_rgb(60_45_30/0.55)]', NOTE_TONE[tone], className)}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-5 bg-[linear-gradient(180deg,rgb(110_85_20/0.08),transparent)]" />
      <span aria-hidden className="absolute bottom-0 right-0 size-6 bg-[linear-gradient(135deg,transparent_48%,rgb(60_45_30/0.1)_50%,rgb(255_255_255/0.5)_62%,transparent_80%)]" />
      {children}
    </div>
  );
}

/** A printed barcode, deterministic for its seed. */
export function Barcode({ seed, className }: { seed: string; className?: string }) {
  const bars = useMemo(() => {
    const out: { x: number; w: number }[] = [];
    let x = 0;
    for (const ch of `*${seed}*`) {
      const c = ch.charCodeAt(0);
      for (let i = 0; i < 4; i++) {
        const w = ((c >> i) & 1) + 1;
        if (i % 2 === 0) out.push({ x, w });
        x += w + 1;
      }
    }
    return { out, width: x };
  }, [seed]);
  return (
    <svg viewBox={`0 0 ${bars.width} 20`} className={className} preserveAspectRatio="none" aria-hidden>
      {bars.out.map((b, i) => (
        <rect key={i} x={b.x} width={b.w} height="20" fill="var(--lk-toner)" />
      ))}
    </svg>
  );
}

/** The reviewer's pen circle and margin query on one printed value, optionally drawn by a visible pen. */
function CellAnnotation({ play, delay = 0, pen }: { play: boolean; delay?: number; pen?: boolean }) {
  const reduce = useReducedMotion();
  const withPen = pen && !reduce;
  const drawAt = withPen ? delay + PEN_APPROACH : delay;
  return (
    <span aria-hidden className="absolute -left-[0.6em] -top-[0.55em] z-10 h-[2.6em] w-[4.6em]">
      <InkStroke ink={INK.circle} play={play} delay={drawAt} duration={PEN_DRAW} linear={withPen} className="absolute inset-0 size-full" />
      <span className="absolute left-[150%] top-[-30%] z-10 whitespace-nowrap">
        <Handwriting play={play} delay={drawAt + PEN_DRAW + 0.05} duration={0.7} className="-rotate-6 text-[1.7em] leading-none">
          query?
        </Handwriting>
      </span>
      {withPen && <PenFollower play={play} delay={delay} />}
    </span>
  );
}

const SPECIMEN_ROWS = [
  ['Visit date', '04 Mar', '01 Apr', '29 Apr'],
  ['Height (cm)', '171', '171', '171'],
  ['Temperature (°C)', '36.6', '36.8', '36.7'],
  ['Pulse (bpm)', '72', '74', '—'],
  ['Resp. rate (/min)', '14', '15', '14'],
  ['Initials', 'MK', 'MK', 'MK'],
];

/**
 * A printed case report form, as a specimen: invented values, labelled as not from the assessment. Every size is in
 * em, so it scales with the font size it is given. `annotate` adds the reviewer's pen circle and margin query.
 */
export function SpecimenCrf({ className, annotate }: { className?: string; annotate?: { play: boolean; delay?: number; pen?: boolean } }) {
  return (
    <div className={cn('relative font-print text-toner', className)}>
      <div className="flex justify-between gap-[1em] border-b border-dashed border-toner/25 pb-[0.5em] text-[0.68em] uppercase tracking-[0.12em] text-toner/60">
        <span>Lokus · Specimen page</span>
        <span className="hidden sm:inline">Not from the assessment</span>
      </div>
      {/* With annotations the print leaves a right margin for the reviewer's notes. */}
      <div className={cn('mt-[0.9em] border-[0.12em] border-toner', annotate && 'w-[85%]')}>
        <div className="flex items-center justify-between gap-[0.6em] bg-[#f3e4da] px-[0.8em] py-[0.45em]">
          <span className="font-print-label text-[1.2em] font-bold tracking-wide">SPC-001</span>
          <span className="text-[0.72em] text-toner/70">Site 01 · Consent 02 Mar</span>
        </div>
        <table className="w-full table-fixed border-collapse text-[0.8em]">
          <colgroup>
            <col className="w-[38%]" />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr className="bg-copper text-white">
              {['Field', 'Visit 1', 'Visit 2', 'Visit 3'].map((h) => (
                <th key={h} scope="col" className="border border-toner px-[0.5em] py-[0.35em] text-left font-print-label font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SPECIMEN_ROWS.map(([label, ...values]) => (
              <tr key={label}>
                <th scope="row" className="border border-toner/70 px-[0.5em] py-[0.32em] text-left font-print-label font-semibold">
                  {label}
                </th>
                {values.map((v, i) => (
                  <td key={i} className="relative border border-toner/70 px-[0.5em] py-[0.32em]">
                    {v}
                    {annotate && label === 'Pulse (bpm)' && i === 2 && <CellAnnotation {...annotate} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-[0.9em] flex items-end justify-between gap-[1em] text-[0.68em] text-toner/60">
        <span>Illustrative values only</span>
        <span className="flex flex-col items-end gap-[0.3em]">
          <Barcode seed="SPC-001" className="h-[2em] w-[9em]" />
          Page 1 of 12
        </span>
      </div>
    </div>
  );
}

const REPORT_BARS = [
  ['Safety awareness', 86, '¹'],
  ['Integrity', 78, '²'],
  ['Data quality', 92, '³'],
  ['Communication', 72, '⁴'],
] as const;
const REPORT_NOTES = ['Workday 1 · escalation and finding log', 'Workday 2 · decisions, with reasons', 'Workday 1 · findings with references', 'Workday 2 · replies as written'];

/** The employer's result report, as a printed specimen. Sizes in em. */
export function ResultReport({ className, play, highlight }: { className?: string; play?: boolean; highlight?: number | null }) {
  return (
    <div className={cn('relative font-sans text-toner', className)}>
      <div className="flex items-start justify-between gap-[1em]">
        <div>
          <p className="font-print-label text-[0.7em] font-semibold uppercase tracking-[0.18em] text-toner/55">Result report · specimen</p>
          <p className="mt-[0.3em] font-serif text-[1.55em] leading-tight">Clinical Trial Associate</p>
          <p className="text-[0.75em] text-toner/60">Two workdays · scored and reviewed</p>
        </div>
        <StampDown play={play ?? true} delay={0.5} rotate={-9} className="relative! right-0 top-0 text-[1.05em]">
          <Stamp tone="green" sub="Final result">
            Meets bar
          </Stamp>
        </StampDown>
      </div>
      <div className="mt-[1.2em] border-t border-toner/20 pt-[0.9em]">
        <p className="font-print-label text-[0.68em] font-semibold uppercase tracking-[0.18em] text-toner/55">Competencies</p>
        <div className="mt-[0.6em] flex flex-col gap-[0.55em]">
          {REPORT_BARS.map(([label, value, mark], i) => (
            <div key={label} className={cn('grid grid-cols-[8.5em_1fr_1em] items-center gap-[0.7em] rounded-[0.2em] text-[0.8em] transition-colors', highlight === i && 'bg-[#fdf0b0]')}>
              <span className="truncate">{label}</span>
              <span className="h-[0.55em] overflow-hidden rounded-full bg-toner/10">
                <m.span className="block h-full rounded-full bg-[repeating-linear-gradient(135deg,#2a2a28_0_2px,#4a4945_2px_4px)]" initial={{ width: 0 }} animate={(play ?? true) ? { width: `${value}%` } : undefined} transition={{ delay: 0.3 + i * 0.12, duration: 1, ease: EASE_OUT }} />
              </span>
              <span className="font-semibold text-pen">{mark}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-[1em] flex items-center gap-[0.5em] text-[0.78em]">
        <span className="font-print-label text-[0.9em] font-semibold uppercase tracking-[0.14em] text-toner/55">Critical flags</span>
        <span className="relative inline-flex size-[1.1em] items-center justify-center border border-toner/60">
          <InkStroke ink={INK.check} play={play} delay={1.2} duration={0.4} className="absolute -top-[0.3em] left-[0.05em] h-[1.1em] w-[1.3em]" />
        </span>
        <span>None raised</span>
      </div>
      <ol className="mt-[1em] border-t border-dashed border-toner/25 pt-[0.7em] text-[0.7em] leading-relaxed text-toner/70">
        {REPORT_NOTES.map((n, i) => (
          <li key={n} className={cn('rounded-[0.2em] px-[0.2em] transition-colors', highlight === i && 'bg-[#fdf0b0] text-toner')}>
            <span className="font-semibold text-pen">{REPORT_BARS[i][2]}</span> {n}
          </li>
        ))}
      </ol>
    </div>
  );
}

const EMAILS = [
  { from: 'Clinical project manager', time: '09:12', subject: 62 },
  { from: 'Sponsor team', time: '09:26', subject: 54 },
  { from: 'Site coordinator', time: '09:41', subject: 70 },
];

/** A printed email. The subject and body are shown as print, not words: the inbox itself stays inside the assessment. */
export function EmailPrintout({ index = 0, className }: { index?: number; className?: string }) {
  const e = EMAILS[index % EMAILS.length];
  return (
    <div className={cn('font-print text-toner', className)}>
      <div className="grid grid-cols-[4.6em_1fr] gap-x-[0.6em] gap-y-[0.3em] border-b border-toner/20 pb-[0.6em] text-[0.74em]">
        <span className="text-toner/55">From</span>
        <span className="truncate font-semibold">{e.from}</span>
        <span className="text-toner/55">To</span>
        <span>Clinical Trial Associate</span>
        <span className="text-toner/55">Subject</span>
        <span className="flex items-center">
          <span className="h-[0.55em] rounded-full bg-toner/70" style={{ width: `${e.subject}%` }} />
        </span>
      </div>
      <div className="mt-[0.7em] flex flex-col gap-[0.45em]">
        {[94, 88, 97, 72, 0, 90, 84, 96, 58, 0, 92, 86, 64, 0, 40].map((w, i) => (w ? <span key={i} className="h-[0.42em] rounded-full bg-toner/25" style={{ width: `${w}%` }} /> : <span key={i} className="h-[0.3em]" />))}
      </div>
      <p className="mt-[0.8em] text-right text-[0.66em] text-toner/50">Printed {e.time} · 1 of 1</p>
    </div>
  );
}

export const RECEIPT_LINES = [
  ['09:00:04', 'Workday 1 opened', 'a1f3'],
  ['09:02:51', 'Record opened', '7c2e'],
  ['09:14:07', 'Document viewed', 'e90b'],
  ['09:31:48', 'Finding logged', '44d1'],
  ['09:47:20', 'Note added', 'b7a0'],
  ['10:03:12', 'Workday submitted', 'c51d'],
] as const;

/** The event record as a thermal till receipt that prints line by line. Sizes in em. */
export function Receipt({ play, className }: { play: boolean; className?: string }) {
  return (
    <div className={cn('lk-zigzag-b paper-grain bg-[#fbfbf7] px-[1.2em] pb-[1.8em] pt-[1.1em] font-print text-[#3b3b38] shadow-[0_1px_1px_rgb(0_0_0/0.08),0_14px_24px_-12px_rgb(60_45_30/0.45)]', className)}>
      <p className="text-center text-[0.8em] font-semibold tracking-[0.2em]">LOKUS · EVENT RECORD</p>
      <p className="text-center text-[0.66em] tracking-[0.14em] text-[#3b3b38]/60">SPECIMEN ATTEMPT</p>
      <p className="my-[0.6em] overflow-hidden whitespace-nowrap text-[0.7em] tracking-[0.3em] text-[#3b3b38]/40">- - - - - - - - - - - - - - - - - - - -</p>
      <ul className="flex flex-col gap-[0.35em] text-[0.7em]">
        {RECEIPT_LINES.map(([time, what, hash], i) => (
          <m.li key={time} className="grid grid-cols-[5.6em_1fr_auto] gap-[0.6em]" initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : undefined} transition={{ delay: 0.25 + i * 0.32, duration: 0.05 }}>
            <span className="text-[#3b3b38]/60">{time}</span>
            <span className="truncate">{what}</span>
            <span className="text-[#3b3b38]/55">#{hash}</span>
          </m.li>
        ))}
      </ul>
      <p className="my-[0.6em] overflow-hidden whitespace-nowrap text-[0.7em] tracking-[0.3em] text-[#3b3b38]/40">- - - - - - - - - - - - - - - - - - - -</p>
      <m.div className="flex items-center justify-between text-[0.72em] font-semibold" initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : undefined} transition={{ delay: 0.3 + RECEIPT_LINES.length * 0.32 }}>
        <span>CHAIN</span>
        <span>✓ VERIFIED</span>
      </m.div>
      <Barcode seed="EVT-0042" className="mx-auto mt-[0.8em] h-[2.2em] w-[80%]" />
    </div>
  );
}

const CONCEPTS = [
  { key: 'desk', set: 'room', to: '/preview/desk', short: 'A', label: 'A · The Desk' },
  { key: 'binder', set: 'room', to: '/preview/binder', short: 'B', label: 'B · The Binder' },
  { key: 'workday', set: 'room', to: '/preview/workday', short: 'C', label: 'C · The Workday' },
  { key: 'catalog-desk', set: 'catalog', to: '/preview/catalog/desk', short: '1', label: '1 · Desk' },
  { key: 'catalog-binder', set: 'catalog', to: '/preview/catalog/binder', short: '2', label: '2 · Binder' },
  { key: 'catalog-workday', set: 'catalog', to: '/preview/catalog/workday', short: '3', label: '3 · Workday' },
] as const;
const SETS = {
  room: { label: 'Concept', other: { to: '/preview/catalog/desk', label: 'Catalogue' } },
  catalog: { label: 'Catalogue', other: { to: '/preview/desk', label: 'Rooms' } },
} as const;

/** Preview-only control for flipping between the landing concepts in one set, the other set and the current page. */
export function ConceptSwitcher({ current }: { current: (typeof CONCEPTS)[number]['key'] }) {
  const set = CONCEPTS.find((c) => c.key === current)?.set ?? 'room';
  return (
    <nav aria-label="Landing page concepts" className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-[#14181f]/90 p-1 text-[12px] font-semibold text-white/70 shadow-[0_12px_30px_-8px_rgb(0_0_0/0.5)] backdrop-blur">
        <span className="hidden pl-3 pr-1 text-white/45 sm:inline">{SETS[set].label}</span>
        {CONCEPTS.filter((c) => c.set === set).map((c) => (
          <Link key={c.key} to={c.to} aria-current={c.key === current ? 'page' : undefined} className={cn('rounded-full px-3 py-1.5 transition-colors', c.key === current ? 'bg-white text-[#14181f]' : 'hover:text-white')}>
            <span className="sm:hidden">{c.short}</span>
            <span className="hidden sm:inline">{c.label}</span>
          </Link>
        ))}
        <Link to={SETS[set].other.to} className="rounded-full px-3 py-1.5 transition-colors hover:text-white">
          {SETS[set].other.label}
        </Link>
        <Link to="/" className="rounded-full px-3 py-1.5 transition-colors hover:text-white">
          Current
        </Link>
      </div>
    </nav>
  );
}
