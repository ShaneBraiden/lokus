import { ArrowLeft, ArrowRight, Check, Compass, MousePointerClick, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
/** Room taken by the lifted target's surface ring. */
const PAD = 10;
const CARD_W = 344;

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

interface Frame {
  rect: DOMRect | null;
  paused: boolean;
}

/** Raises a target off the page: a little larger (less for big panels), with a filled surface if it has none. */
function lift(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const scale = Math.min(1.06, Math.max(1.012, 1 + 18 / Math.max(r.width, r.height)));
  el.style.setProperty('--guide-scale', scale.toFixed(3));
  el.dataset.guideLift = getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' ? 'fill' : '';
}

function drop(el: HTMLElement | null) {
  if (!el) return;
  delete el.dataset.guideLift;
  el.style.removeProperty('--guide-scale');
}

/** Lifts the target and follows it as the page scrolls, reflows or loads; pauses while one of the workspace's own windows is open. */
function useFrame(target: string | undefined, active: boolean): Frame {
  const [frame, setFrame] = useState<Frame>({ rect: null, paused: false });
  useEffect(() => {
    if (!active) return;
    let lifted: HTMLElement | null = null;
    const first = findTarget(target);
    if (first) {
      const r = first.getBoundingClientRect();
      if (r.top < 120 || r.bottom > window.innerHeight - 24) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    const tick = () => {
      const paused = windowOpen();
      const el = paused ? null : findTarget(target);
      // The element can be replaced by a re-render (another record, another view): move the lift with it.
      if (el !== lifted) {
        drop(lifted);
        if (el) lift(el);
        lifted = el;
      }
      const r = el?.getBoundingClientRect() ?? null;
      setFrame((f) => {
        const same = f.paused === paused && (f.rect === r || (f.rect && r && f.rect.x === r.x && f.rect.y === r.y && f.rect.width === r.width && f.rect.height === r.height));
        return same ? f : { rect: r, paused };
      });
    };
    tick();
    const timer = setInterval(tick, 150);
    window.addEventListener('scroll', tick, true);
    window.addEventListener('resize', tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener('scroll', tick, true);
      window.removeEventListener('resize', tick);
      drop(lifted);
    };
  }, [target, active]);
  return frame;
}

function placeCard(rect: DOMRect | null, h: number): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const m = 12;
  const gap = 14;
  const w = Math.min(CARD_W, vw - 2 * m);
  const x = (v: number) => Math.min(Math.max(m, v), vw - w - m);
  const y = (v: number) => Math.min(Math.max(m, v), vh - h - m);
  if (!rect) return { left: (vw - w) / 2, top: y((vh - h) / 2), width: w };
  if (vw < 640) return { left: m, bottom: m, width: vw - 2 * m };
  if (vh - rect.bottom - PAD >= h + gap + m) return { top: rect.bottom + PAD + gap, left: x(rect.left), width: w };
  if (rect.top - PAD >= h + gap + m) return { top: rect.top - PAD - gap - h, left: x(rect.left), width: w };
  if (vw - rect.right - PAD >= w + gap + m) return { left: rect.right + PAD + gap, top: y(rect.top), width: w };
  if (rect.left - PAD >= w + gap + m) return { left: rect.left - PAD - gap - w, top: y(rect.top), width: w };
  return { left: x(rect.right - w - m), top: y(rect.bottom - h - m), width: w };
}

/** Progress as one segment per step: filled once passed, a check once its try-it was done. */
function Segments({ tour, index, tried }: { tour: GuideTour; index: number; tried: (id: string) => boolean }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {tour.steps.map((s, i) => (
        <span key={s.id} className={cn('h-1 flex-1 rounded-full transition-colors', i < index || (s.task && tried(s.id)) ? 'bg-copper' : i === index ? 'bg-ink' : 'bg-line-strong')} />
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [cardH, setCardH] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = run && run.mode !== 'intro' ? tour.steps[run.index] : null;
  const frame = useFrame(step?.target, Boolean(run));
  const done = step?.task ? memory.tried(step.id) : false;
  const triedCount = tour.steps.filter((s) => s.task && memory.tried(s.id)).length;
  const taskCount = tour.steps.filter((s) => s.task).length;

  const close = () => {
    memory.markOffered();
    setRun(null);
  };
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

  useLayoutEffect(() => {
    if (cardRef.current && cardRef.current.offsetHeight !== cardH) setCardH(cardRef.current.offsetHeight);
  });

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
                  setRun({ mode: 'single', index: i });
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
              setRun({ mode: 'tour', index: 0 });
            }}
          >
            Replay the walkthrough
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  if (!run) return launcher;

  // While one of the workspace's windows is open (the step's own try-it, often) the guide steps aside.
  if (frame.paused)
    return (
      <>
        {launcher}
        {createPortal(
          <div className="pointer-events-none fixed bottom-4 left-4 z-[60] animate-fade-in rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted shadow-pop">
            <Compass className="mr-1.5 inline size-3.5 text-copper" />
            Guide paused · close this window to carry on
          </div>,
          document.body,
        )}
      </>
    );

  const rect = step ? frame.rect : null;
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
              'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors',
              done ? 'border-emerald-200 bg-success-soft text-success' : 'border-dashed border-accent-line bg-accent-soft/60 text-accent',
            )}
            role="status"
          >
            {done ? <Check className="mt-0.5 size-4 shrink-0" /> : <MousePointerClick className="mt-0.5 size-4 shrink-0" />}
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
              <Button size="sm" onClick={() => setRun(null)}>
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

  return (
    <>
      {launcher}
      {createPortal(
        <div className="pointer-events-none fixed inset-0 z-[45]">
          <div
            key={`${run.mode}-${step?.id ?? 'intro'}`}
            ref={cardRef}
            role="dialog"
            aria-modal="false"
            aria-label={step ? step.title : tour.intro.title}
            className={cn(GUIDE_UI, 'pointer-events-auto absolute animate-scale-in rounded-2xl border border-line bg-surface shadow-pop', !step && 'shadow-[0_30px_80px_-20px_rgb(28_36_48/0.45)]')}
            style={placeCard(rect, cardH)}
          >
            {card}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
