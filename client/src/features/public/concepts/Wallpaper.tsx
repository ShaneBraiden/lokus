import {
  Activity,
  Bandage,
  Beaker,
  ClipboardPlus,
  Dna,
  FlaskConical,
  FlaskRound,
  HeartPulse,
  Microscope,
  Pill,
  PillBottle,
  Pipette,
  Stethoscope,
  Syringe,
  TestTube,
  TestTubeDiagonal,
  TestTubes,
  Thermometer,
  Virus,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';
import { useSvgId } from './materials';

/**
 * A doodle wallpaper of small lab and clinic tools, scattered and tilted like a chat-app background. One tile repeats;
 * every icon sits inside its own cell so nothing is cut at the tile's edges.
 */

const ICONS: LucideIcon[] = [
  Microscope,
  TestTube,
  Pill,
  Stethoscope,
  FlaskConical,
  Syringe,
  Dna,
  Pipette,
  Thermometer,
  Beaker,
  HeartPulse,
  TestTubes,
  ClipboardPlus,
  Bandage,
  FlaskRound,
  Virus,
  PillBottle,
  TestTubeDiagonal,
  Activity,
];
const CELL = 64;
const GRID = 5;
const TILE = CELL * GRID;

/** Placement for each cell, from a fixed seed so the pattern never changes between renders. */
const LAYOUT = (() => {
  let s = 11;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const icons: { Icon: LucideIcon; x: number; y: number; r: number; size: number }[] = [];
  const dots: { x: number; y: number; r: number; plus: boolean }[] = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      // Offset every other row by a few icons so the same tool never lines up in a column.
      const Icon = ICONS[(row * GRID + col + row * 3) % ICONS.length];
      icons.push({
        Icon,
        x: col * CELL + CELL / 2 + (rand() - 0.5) * 18,
        y: row * CELL + CELL / 2 + (rand() - 0.5) * 18,
        r: (rand() - 0.5) * 60,
        size: 22 + rand() * 8,
      });
      dots.push({ x: col * CELL + 4 + rand() * 6, y: row * CELL + 4 + rand() * 6, r: 1.2 + rand() * 1.2, plus: rand() > 0.6 });
    }
  }
  return { icons, dots };
})();

const TONE = {
  light: { color: '#23211f', opacity: 0.085 },
  dark: { color: '#ffffff', opacity: 0.06 },
} as const;

/** The wallpaper on its own, filling its positioned parent. */
export function Doodles({ tone = 'light', className }: { tone?: keyof typeof TONE; className?: string }) {
  const id = useSvgId();
  const { color, opacity } = TONE[tone];
  return (
    <svg aria-hidden className={cn('pointer-events-none absolute inset-0 size-full', className)}>
      <defs>
        <pattern id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          <g opacity={opacity} color={color}>
            {LAYOUT.icons.map(({ Icon, x, y, r, size }, i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
                <Icon x={-size / 2} y={-size / 2} width={size} height={size} strokeWidth={1.5} />
              </g>
            ))}
            {LAYOUT.dots.map((d, i) =>
              d.plus ? (
                <path key={i} d={`M${d.x - 2.5} ${d.y}h5M${d.x} ${d.y - 2.5}v5`} stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
              ) : (
                <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="currentColor" />
              ),
            )}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** A section with the wallpaper behind its content. Give it a background colour with className. */
export function Wallpaper({ children, tone, className, id }: { children: ReactNode; tone?: keyof typeof TONE; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('relative isolate', className)}>
      <Doodles tone={tone} className="-z-10" />
      {children}
    </section>
  );
}
