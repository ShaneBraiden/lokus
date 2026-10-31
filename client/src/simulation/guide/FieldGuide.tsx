import { ArrowLeft, ArrowRight, Check, Compass, MousePointerClick, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button, Popover, PopoverContent, PopoverTrigger, cn } from '@/ui';
import { usePlayer } from '../PlayerContext';

export interface GuideStep {
  id: string;
  /** `data-guide` value of the element to spotlight. Without one (or when it is not on screen) the card is centred. */
  target?: string;
  title: string;
  body: ReactNode;
  /** A try-it step: done once the candidate uses the spotlit element themselves. Evidence is never written by the guide. */
  task?: { prompt: string; /** Only presses on elements matching this selector count. */ match?: string };
}

export interface GuideTour {
  id: string;
  label: string;
  intro: { title: string; body: ReactNode; minutes: string };
  steps: GuideStep[];
}

type Run = { mode: 'intro' } | { mode: 'tour' | 'single'; index: number };

/** Our own surfaces carry this class so they never count as "a window is open" (Radix popovers use role="dialog"). */
const GUIDE_UI = 'guide-ui';
/** Room around the lifted target: its surface ring, and the edge of the cut-out in the backdrop. */
const PAD = 8;
const CARD_W = 344;
const GLIDE_MS = 480;
const FADE_MS = 220;

/** Which steps were tried and whether the walkthrough was offered, kept with autosaved progress (per attempt). */
function useGuideMemory(tourId: string) {
  const { progress } = usePlayer();
  const [seen, setSeen] = useState(() => progress.get().seen ?? {});
  const mark = useCallback(
    (key: string) => {
      setSeen((s) => (s[key] ? s : { ...s, [key]: true }));
      progress.patch((s) => (s.seen?.[key] ? s : { ...s, seen: { ...s.seen, [key]: true } }));
    },
    [progress],
  );
  return useMemo(
    () => ({
      offered: Boolean(seen[`guide:${tourId}`]),
      markOffered: () => mark(`guide:${tourId}`),
      tried: (stepId: string) => Boolean(seen[`guide:${tourId}:${stepId}`]),
      markTried: (stepId: string) => mark(`guide:${tourId}:${stepId}`),
    }),
    [seen, tourId, mark],
  );
}

/** The first visible element for a `data-guide` name (the binder tabs, for one, exist twice: tabs and a select). */
function findTarget(name: string | undefined): HTMLElement | null {
  if (!name) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-guide="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

const windowOpen = () => Boolean(document.querySelector(`[role="dialog"]:not(.${GUIDE_UI}), [role="alertdialog"]`));

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const easeOut = (t: number) => 1 - (1 - t) ** 4;

/**
 * A box that glides from where it was to a destination that may itself be moving (a smooth scroll), then tracks that
 * destination exactly, so scrolling never trails behind.
 */
function glide() {
  let from: Box | null = null;
  let start = 0;
  let cur: Box | null = null;
  return {
    restart(now: number) {
      from = cur;
      start = now;
    },
    step(to: Box, now: number, ms: number): Box {
      const t = from && ms > 0 ? Math.min(1, (now - start) / ms) : 1;
      if (t >= 1 || !from) {
        from = null;
        cur = to;
      } else {
        const e = easeOut(t);
        const f = from;
        cur = { x: f.x + (to.x - f.x) * e, y: f.y + (to.y - f.y) * e, w: f.w + (to.w - f.w) * e, h: f.h + (to.h - f.h) * e };
      }
      return cur;
    },
  };
}

/** Scroll containers around the target: whatever they cut off is not lit either. */
function clippersOf(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') out.push(p);
  }
  return out;
}

/** Sticky and fixed bars that can slide over the target (the workspace header and toolbar). */
function occludersOf(el: HTMLElement): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('header, [class*="sticky"], [class*="fixed"]')].filter(
    (o) => !o.contains(el) && !o.closest(`.${GUIDE_UI}`) && ['sticky', 'fixed'].includes(getComputedStyle(o).position),
  );
}

/** Raises a target off the page: larger (less for big panels, never wider than its scroll container allows), with a filled surface if it has none. */
function lift(el: HTMLElement, clippers: HTMLElement[]) {
  const r = el.getBoundingClientRect();
  let room = Math.min(r.left, document.documentElement.clientWidth - r.right);
  for (const c of clippers) {
    const left = c.getBoundingClientRect().left + c.clientLeft;
    room = Math.min(room, r.left - left, left + c.clientWidth - r.right);
  }
  const fits = 1 + (2 * Math.max(0, room - PAD)) / Math.max(1, r.width);
  const scale = Math.max(1, Math.min(1.1, 1 + 40 / Math.max(r.width, r.height), fits));
  el.style.removeProperty('transition');
  el.style.setProperty('--guide-scale', scale.toFixed(3));
  el.dataset.guideLift = getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' ? 'fill' : '';
}

/** Settles a target back onto the page, animated (the lift's own transition leaves with the attribute). */
function drop(el: HTMLElement | null) {
  if (!el) return;
  el.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 320ms cubic-bezier(0.22, 1, 0.36, 1)';
  delete el.dataset.guideLift;
  el.style.removeProperty('--guide-scale');
  setTimeout(() => {
    if (el.dataset.guideLift === undefined) el.style.removeProperty('transition');
  }, 340);
}

/** The lit part of the target: its box plus the ring, cut to its scroll containers, the viewport and any bar over it. */
function visibleBox(el: HTMLElement, clippers: HTMLElement[], occluders: HTMLElement[]): Box | null {
  const r = el.getBoundingClientRect();
  let l = r.left - PAD;
  let t = r.top - PAD;
  let rt = r.right + PAD;
  let b = r.bottom + PAD;
  const clip = (cl: number, ct: number, cr: number, cb: number) => {
    l = Math.max(l, cl);
    t = Math.max(t, ct);
    rt = Math.min(rt, cr);
    b = Math.min(b, cb);
  };
  clip(0, 0, window.innerWidth, window.innerHeight);
  for (const c of clippers) {
    const cr = c.getBoundingClientRect();
    const x = cr.left + c.clientLeft;
    const y = cr.top + c.clientTop;
    clip(x, y, x + c.clientWidth, y + c.clientHeight);
  }
  for (const o of occluders) {
    const or = o.getBoundingClientRect();
    if (or.width > window.innerWidth / 2 && or.top <= t + 1 && or.bottom > t && or.bottom < b) t = or.bottom;
  }
  return rt - l > 1 && b - t > 1 ? { x: l, y: t, w: rt - l, h: b - t } : null;
}

function roundRect({ x, y, w, h }: Box, r: number) {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

function placeCard(hole: Box | null, h: number): Box & { side: string } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const m = 12;
  const gap = 14;
  const w = Math.min(CARD_W, vw - 2 * m);
  const x = (v: number) => Math.min(Math.max(m, v), vw - w - m);
  const y = (v: number) => Math.min(Math.max(m, v), vh - h - m);
  if (!hole) return { x: (vw - w) / 2, y: y((vh - h) / 2), w, h, side: 'centre' };
  // Phones: a sheet at whichever edge the target is not near.
  if (vw < 640) return hole.y + hole.h / 2 > vh / 2 ? { x: m, y: m, w: vw - 2 * m, h, side: 'top' } : { x: m, y: vh - h - m, w: vw - 2 * m, h, side: 'bottom' };
  const right = hole.x + hole.w;
  const bottom = hole.y + hole.h;
  if (vh - bottom >= h + gap + m) return { x: x(hole.x), y: bottom + gap, w, h, side: 'below' };
  if (hole.y >= h + gap + m) return { x: x(hole.x), y: hole.y - gap - h, w, h, side: 'above' };
  if (vw - right >= w + gap + m) return { x: right + gap, y: y(hole.y), w, h, side: 'right' };
  if (hole.x >= w + gap + m) return { x: hole.x - gap - w, y: y(hole.y), w, h, side: 'left' };
  return { x: x(right - w - m), y: y(bottom - h - m), w, h, side: 'inside' };
}

interface SpotlightRefs {
  dim: RefObject<SVGPathElement | null>;
  ring: RefObject<SVGRectElement | null>;
  card: RefObject<HTMLDivElement | null>;
  content: RefObject<HTMLDivElement | null>;
}

/**
 * The guide's one animation loop: lifts the step's target, cuts the dim around what of it is visible and places the card
 * beside it. Between steps the cut-out and the card glide; while the page scrolls they follow it frame for frame. It writes
 * straight to the DOM, so nothing re-renders per frame. Reports whether one of the workspace's own windows is open.
 */
function useSpotlight(target: string | undefined, stepKey: string | null, closing: boolean, refs: SpotlightRefs): boolean {
  const [paused, setPaused] = useState(false);
  const live = useRef({ target, stepKey, closing });
  useLayoutEffect(() => {
    live.current = { target, stepKey, closing };
  });
  const active = stepKey !== null;

  useLayoutEffect(() => {
    if (!active) return;
    const ms = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : GLIDE_MS;
    const hole = glide();
    const card = glide();
    let lifted: HTMLElement | null = null;
    let clippers: HTMLElement[] = [];
    let occluders: HTMLElement[] = [];
    let key: string | null = null;
    let side = '';
    let cardH = 0;
    let wasPaused = false;
    // Where the cut-out closes to when there is nothing to light: where it last was, the middle of the screen at first.
    let anchor: Box = { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 };
    let raf = 0;

    const frame = (now: number) => {
      const { target, stepKey, closing } = live.current;
      const isPaused = windowOpen();
      if (isPaused !== wasPaused) {
        wasPaused = isPaused;
        setPaused(isPaused);
      }
      const el = isPaused || closing ? null : findTarget(target);

      if (stepKey !== key) {
        if (key !== null) {
          hole.restart(now);
          card.restart(now);
        }
        key = stepKey;
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.top < 120 || r.bottom > window.innerHeight - 24) el.scrollIntoView({ block: 'center', behavior: ms ? 'smooth' : 'auto' });
        }
      }
      // The element can be replaced by a re-render (another record, another view): move the lift with it.
      if (el !== lifted) {
        drop(lifted);
        if (el) {
          clippers = clippersOf(el);
          occluders = occludersOf(el);
          lift(el, clippers);
        }
        lifted = el;
        hole.restart(now);
      }

      const box = el ? visibleBox(el, clippers, occluders) : null;
      if (box) anchor = { x: box.x + box.w / 2, y: box.y + box.h / 2, w: 0, h: 0 };
      const cut = hole.step(box ?? anchor, now, ms);
      const open = cut.w > 1 && cut.h > 1;
      const radius = Math.max(0, Math.min(16, cut.w / 2, cut.h / 2));

      const dim = refs.dim.current;
      if (dim) {
        const d = `M0 0H${window.innerWidth}V${window.innerHeight}H0Z${open ? roundRect(cut, radius) : ''}`;
        if (dim.getAttribute('d') !== d) dim.setAttribute('d', d);
      }
      const ring = refs.ring.current;
      if (ring) {
        ring.setAttribute('x', String(cut.x));
        ring.setAttribute('y', String(cut.y));
        ring.setAttribute('width', String(Math.max(0, cut.w)));
        ring.setAttribute('height', String(Math.max(0, cut.h)));
        ring.setAttribute('rx', String(radius));
        ring.style.opacity = open ? '1' : '0';
      }

      const c = refs.card.current;
      const content = refs.content.current;
      if (c && content) {
        const h = content.offsetHeight + c.offsetHeight - c.clientHeight;
        const spot = placeCard(box, h);
        // A new side or a new height glides; following a scroll does not.
        if ((side && spot.side !== side) || (cardH && Math.abs(h - cardH) > 1)) card.restart(now);
        side = spot.side;
        cardH = h;
        const at = card.step(spot, now, ms);
        c.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
        c.style.width = `${Math.round(at.w)}px`;
        c.style.height = `${Math.round(at.h)}px`;
      }
      raf = requestAnimationFrame(frame);
    };
    frame(performance.now());
    return () => {
      cancelAnimationFrame(raf);
      drop(lifted);
    };
  }, [active, refs]);

  return paused;
}

/** The dim over the page, with a rounded cut-out where the target is. Presses on the dim do nothing; the cut-out lets them through. */
function Backdrop({ dimRef, ringRef }: { dimRef: RefObject<SVGPathElement | null>; ringRef: RefObject<SVGRectElement | null> }) {
  return (
    <svg className="absolute inset-0 size-full" aria-hidden>
      <path ref={dimRef} fill="rgb(20 26 36 / 0.62)" fillRule="evenodd" className="pointer-events-auto" />
      <rect ref={ringRef} fill="none" stroke="var(--color-accent-line)" strokeWidth={1.5} className="transition-opacity duration-200" />
    </svg>
  );
}

/** Progress as one segment per step: filled once passed, a check once its try-it was done. */
function Segments({ tour, index, tried }: { tour: GuideTour; index: number; tried: (id: string) => boolean }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {tour.steps.map((s, i) => (
        <span
          key={s.id}
          className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i < index || (s.task && tried(s.id)) ? 'bg-copper' : i === index ? 'bg-ink' : 'bg-line-strong')}
        />
      ))}
    </div>
  );
}

/**
 * Field guide for a workday: a walkthrough that lifts the real controls off the page and asks the candidate to try the key
 * ones (the step completes when they do), and a Guide button that replays the whole thing or any single step.
 * It explains the interface only, never what to look for.
 */
export function FieldGuide({ tour }: { tour: GuideTour }) {
  const memory = useGuideMemory(tour.id);
  const [run, setRun] = useState<Run | null>(() => (memory.offered ? null : { mode: 'intro' }));
  const [closing, setClosing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dimRef = useRef<SVGPathElement>(null);
  const ringRef = useRef<SVGRectElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => ({ dim: dimRef, ring: ringRef, card: cardRef, content: contentRef }), []);

  const step = run && run.mode !== 'intro' ? tour.steps[run.index] : null;
  const stepKey = run ? `${run.mode}-${step?.id ?? 'intro'}` : null;
  const paused = useSpotlight(step?.target, stepKey, closing, refs);
  const done = step?.task ? memory.tried(step.id) : false;
  const triedCount = tour.steps.filter((s) => s.task && memory.tried(s.id)).length;
  const taskCount = tour.steps.filter((s) => s.task).length;

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const start = (r: Run) => {
    clearTimeout(closeTimer.current);
    setClosing(false);
    setRun(r);
  };
  // Fades out (the target settles back as the cut-out closes) before it goes.
  const finish = (offered: boolean) => {
    if (offered) memory.markOffered();
    setClosing(true);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setRun(null);
      setClosing(false);
    }, FADE_MS);
  };
  const close = () => finish(true);
  const go = (index: number) => setRun((r) => (r && r.mode === 'tour' ? { mode: 'tour', index } : r));

  // A try-it step completes when the candidate presses the spotlit control (or an element inside it that matches).
  useEffect(() => {
    if (!step?.task || done) return;
    const onPress = (e: Event) => {
      const el = findTarget(step.target);
      const hit = e.target instanceof Element ? e.target : null;
      if (!el || !hit || !el.contains(hit)) return;
      if (step.task!.match && !hit.closest(step.task!.match)) return;
      memory.markTried(step.id);
    };
    document.addEventListener('pointerdown', onPress, true);
    document.addEventListener('click', onPress, true);
    return () => {
      document.removeEventListener('pointerdown', onPress, true);
      document.removeEventListener('click', onPress, true);
    };
  }, [step, done, memory]);

  const launcher = (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" data-guide={`${tour.id}-guide`} aria-label={`Guide · ${triedCount} of ${taskCount} tried`}>
          <Compass /> Guide
          {taskCount > 0 && <span className="tabular text-muted">{triedCount === taskCount ? <Check className="text-success" /> : `${triedCount}/${taskCount}`}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={cn(GUIDE_UI, 'w-80 p-0')}>
        <div className="border-b border-line px-4 py-3">
          <p className="text-sm font-semibold text-ink">{tour.label} field guide</p>
          <p className="mt-0.5 text-xs text-muted">Jump to any part of the workspace. The guide never changes your work.</p>
        </div>
        <ol className="max-h-[50dvh] overflow-y-auto py-1">
          {tour.steps.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-ink-2 hover:bg-subtle hover:text-ink"
                onClick={() => {
                  setMenuOpen(false);
                  start({ mode: 'single', index: i });
                }}
              >
                <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular', s.task && memory.tried(s.id) ? 'bg-copper text-white' : 'bg-subtle text-muted')}>
                  {s.task && memory.tried(s.id) ? <Check className="size-3" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                {s.task && <MousePointerClick className="size-3.5 shrink-0 text-faint" aria-label="Has a try-it task" />}
              </button>
            </li>
          ))}
        </ol>
        <div className="border-t border-line p-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => {
              setMenuOpen(false);
              start({ mode: 'tour', index: 0 });
            }}
          >
            Replay the walkthrough
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  if (!run) return launcher;

  const isLast = run.mode === 'tour' && run.index === tour.steps.length - 1;

  const card =
    run.mode === 'intro' ? (
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-white">
            <Compass className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-copper">{tour.label} · {tour.intro.minutes}</p>
            <h2 className="text-base font-semibold leading-snug text-ink">{tour.intro.title}</h2>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink-2">{tour.intro.body}</div>
        {taskCount > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted">You&rsquo;ll try</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {tour.steps
                .filter((s) => s.task)
                .map((s) => (
                  <li key={s.id} className="rounded-full border border-accent-line bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                    {s.title}
                  </li>
                ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" size="sm" onClick={close}>
            I&rsquo;ll explore myself
          </Button>
          <Button size="sm" onClick={() => setRun({ mode: 'tour', index: 0 })}>
            Show me around <ArrowRight />
          </Button>
        </div>
        <p className="-mt-2 text-right text-xs text-faint">You can reopen it any time from Guide in the toolbar.</p>
      </div>
    ) : (
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-copper">
            {run.mode === 'tour' ? `${run.index + 1} of ${tour.steps.length}` : 'Field guide'}
          </p>
          <button type="button" onClick={close} className="-mr-2 -mt-1 ml-auto rounded-md p-1 text-faint hover:bg-subtle hover:text-ink" aria-label="Close the guide">
            <X className="size-4" />
          </button>
        </div>
        <h2 className="-mt-1 text-base font-semibold leading-snug text-ink">{step!.title}</h2>
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink-2">{step!.body}</div>
        {step!.task && (
          <div
            className={cn(
              'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors duration-300',
              done ? 'border-emerald-200 bg-success-soft text-success' : 'border-dashed border-accent-line bg-accent-soft/60 text-accent',
            )}
            role="status"
          >
            {done ? <Check className="mt-0.5 size-4 shrink-0 animate-scale-in" /> : <MousePointerClick className="mt-0.5 size-4 shrink-0" />}
            <span className="font-medium">{done ? 'Done. That’s all there is to it.' : `Try it: ${step!.task.prompt}`}</span>
          </div>
        )}
        {run.mode === 'tour' && <Segments tour={tour} index={run.index} tried={memory.tried} />}
        <div className="flex items-center gap-2 pt-1">
          {run.mode === 'tour' && run.index > 0 && (
            <Button variant="ghost" size="sm" onClick={() => go(run.index - 1)}>
              <ArrowLeft /> Back
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            {run.mode === 'single' ? (
              <Button size="sm" onClick={() => finish(false)}>
                Got it
              </Button>
            ) : (
              <Button size="sm" variant={step!.task && !done ? 'secondary' : 'primary'} onClick={() => (isLast ? close() : go(run.index + 1))}>
                {step!.task && !done ? 'Skip for now' : isLast ? 'Start working' : 'Next'}
                {!isLast && <ArrowRight />}
              </Button>
            )}
          </div>
        </div>
      </div>
    );

  // While one of the workspace's windows is open (the step's own try-it, often) the guide fades aside and comes back after.
  const hidden = paused || closing;

  return (
    <>
      {launcher}
      {createPortal(
        <>
          <div
            className={cn(
              GUIDE_UI,
              'pointer-events-none fixed inset-0 z-[45] animate-fade-in transition-[opacity,visibility] duration-200 ease-out',
              // Stepping aside lets presses through at once, not after the fade.
              hidden ? 'invisible opacity-0 [&_*]:!pointer-events-none' : 'visible opacity-100',
            )}
          >
            <Backdrop dimRef={dimRef} ringRef={ringRef} />
            <div
              ref={cardRef}
              role="dialog"
              aria-modal="false"
              aria-label={step ? step.title : tour.intro.title}
              className={cn(GUIDE_UI, 'pointer-events-auto absolute left-0 top-0 animate-scale-in overflow-hidden rounded-2xl border border-line bg-surface shadow-pop will-change-transform')}
            >
              <div ref={contentRef}>
                <div key={stepKey} className="animate-step-in">
                  {card}
                </div>
              </div>
            </div>
          </div>
          {paused && !closing && (
            <div className={cn(GUIDE_UI, 'pointer-events-none fixed bottom-4 left-4 z-[60] animate-fade-in rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted shadow-pop')}>
              <Compass className="mr-1.5 inline size-3.5 text-copper" />
              Guide paused · close this window to carry on
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}
