import { Maximize, MonitorX, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LockdownViolationKind } from '@lokus/shared';
import { api } from '@/lib/api';
import { Alert, Button } from '@/ui';
import { base } from './api';
import { blockedNotice, useClipboardGuard } from './ClipboardGuard';
import { SceneBackdrop } from './layout/Backdrop';
import { Brand } from './layout/SimHeader';
import { usePlayer } from './PlayerContext';

type WebkitDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

/** Fullscreen with the older WebKit prefix (iPadOS Safari). iPhone Safari has none at all. */
const canFullscreen = () => Boolean(document.fullscreenEnabled || (document as WebkitDocument).webkitFullscreenEnabled);
const fullscreenElement = () => document.fullscreenElement ?? (document as WebkitDocument).webkitFullscreenElement ?? null;

/** Phones and tablets: no developer tools to dock, and the on-screen keyboard reshapes the viewport. */
const touchDevice = () => window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;

/** Requests fullscreen from a user gesture. Resolves false where the browser refuses or cannot. */
export async function enterFullscreen(): Promise<boolean> {
  if (fullscreenElement()) return true;
  const el = document.documentElement as WebkitElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else await el.webkitRequestFullscreen?.();
    return Boolean(fullscreenElement());
  } catch {
    return false;
  }
}

/** Keys that open browser tools, save, print or view source (clipboard keys are in the clipboard guard). OS-level shortcuts cannot be blocked: they blur the window, which is a strike. */
function blockedShortcut(e: KeyboardEvent): string | null {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (key === 'f12') return 'F12';
  if (mod && e.shiftKey && ['i', 'j', 'c', 'k'].includes(key)) return `${e.metaKey ? 'Cmd' : 'Ctrl'}+Shift+${key.toUpperCase()}`;
  if (mod && e.altKey && ['i', 'j', 'c', 'u'].includes(key)) return `${e.metaKey ? 'Cmd' : 'Ctrl'}+Alt+${key.toUpperCase()}`;
  if (mod && ['p', 's', 'u', 'o', 'n', 't', 'w', 'g', 'f', 'h', 'j', 'l', 'd'].includes(key)) return `${e.metaKey ? 'Cmd' : 'Ctrl'}+${key.toUpperCase()}`;
  return null;
}

/**
 * In fullscreen the viewport has the screen's shape whatever the zoom; docked developer tools take a side or the
 * bottom and change it. Only meaningful while fullscreen (undocked tools blur the window instead).
 */
const devtoolsOpen = () => {
  if (touchDevice() || !fullscreenElement() || !screen.width || !screen.height || !window.innerHeight) return false;
  return Math.abs(window.innerWidth / window.innerHeight / (screen.width / screen.height) - 1) > 0.12;
};

const extendedScreen = () => (window.screen as Screen & { isExtended?: boolean }).isExtended === true;

type Block = 'fullscreen' | 'away' | 'devtools' | 'screens' | 'second_tab';

const BLOCK_COPY: Record<Block, { title: string; body: string }> = {
  fullscreen: { title: 'Return to fullscreen to continue', body: 'This assessment is proctored and runs in fullscreen only.' },
  away: { title: 'You left the assessment', body: 'Switching to another tab, window or app is not allowed during this assessment.' },
  devtools: { title: 'Close the developer tools', body: 'Developer tools are not allowed during this assessment. Close them, then return to fullscreen.' },
  screens: { title: 'Disconnect extra displays', body: 'Only one screen may be connected during this assessment. Disconnect or turn off the other display, then continue.' },
  second_tab: { title: 'The assessment is open in another tab', body: 'You can only work on this assessment in one tab. Close this tab and continue in the other one.' },
};

/**
 * Lockdown for every workday, on every device. Everything the browser allows is blocked (copy, paste, text inserted by
 * extensions, right-click, printing, developer tools, browser shortcuts, text selection, drag and drop). Leaving the
 * assessment cannot be prevented by a web page, so it is detected and covered: the work is hidden until the candidate
 * returns, and each departure is a strike. At the strike limit the server closes the attempt. Fullscreen is required
 * wherever the browser has it; where it has not (iPhone Safari), leaving the tab or app is still a strike.
 */
export function LockdownGuard({ children }: { children: ReactNode }) {
  const { attemptId, state, refresh } = usePlayer();
  const { limit } = state.attempt.lockdown;
  const [strikes, setStrikes] = useState(state.attempt.lockdown.strikes);
  const [block, setBlock] = useState<Block | null>(() => (canFullscreen() && !fullscreenElement() ? 'fullscreen' : null));
  const [notice, setNotice] = useState<string | null>(null);
  /** One strike per departure: set when a strike is reported, cleared once the candidate is back. */
  const away = useRef(false);
  const lastBlocked = useRef(new Map<string, number>());
  const secondary = useRef(false);

  const report = useCallback(
    (kind: LockdownViolationKind, detail = '') =>
      api<{ strikes: number; limit: number; closed: boolean }>(`${base(attemptId)}/lockdown/violation`, { method: 'POST', body: { kind, detail }, keepalive: true })
        .then((r) => {
          setStrikes(r.strikes);
          if (r.closed) void refresh();
        })
        .catch(() => undefined),
    [attemptId, refresh],
  );

  const strike = useCallback(
    (kind: LockdownViolationKind, reason: Block, detail = '') => {
      setBlock((b) => (b === 'second_tab' ? b : reason));
      if (away.current || secondary.current) return;
      away.current = true;
      void report(kind, detail);
    },
    [report],
  );

  const blocked = useCallback(
    (kind: LockdownViolationKind, detail = '') => {
      setNotice(blockedNotice(kind, detail));
      // Blocked actions are recorded, at most once per kind every 10 seconds.
      const now = Date.now();
      if (now - (lastBlocked.current.get(kind) ?? 0) < 10_000) return;
      lastBlocked.current.set(kind, now);
      void report(kind, detail);
    },
    [report],
  );
  useClipboardGuard(blocked);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('lockdown');

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') strike('tab_hidden', 'away');
    };
    const onBlur = () => strike('window_blur', 'away');
    const onFullscreen = () => {
      if (!fullscreenElement()) strike('fullscreen_exit', 'fullscreen');
      else if (!devtoolsOpen() && !extendedScreen()) {
        away.current = false;
        setBlock((b) => (b === 'second_tab' ? b : null));
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        void navigator.clipboard?.writeText('').catch(() => undefined);
        strike('screen_capture', 'away', 'Print Screen');
        return;
      }
      const combo = blockedShortcut(e);
      if (!combo) return;
      e.preventDefault();
      e.stopPropagation();
      blocked('shortcut', combo);
    };
    const onBeforePrint = () => blocked('print');
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    // A second tab of the same attempt: the newer one is shut out, the older one records the strike.
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(`lokus-lockdown-${attemptId}`) : null;
    if (channel) {
      channel.onmessage = (m: MessageEvent<string>) => {
        if (m.data === 'hello') {
          channel.postMessage('present');
          if (!secondary.current) void report('second_tab');
        } else if (m.data === 'present') {
          secondary.current = true;
          setBlock('second_tab');
        }
      };
      channel.postMessage('hello');
    }

    const poll = window.setInterval(() => {
      if (secondary.current) return;
      if (devtoolsOpen()) strike('devtools', 'devtools');
      if (extendedScreen()) strike('multiple_screens', 'screens');
    }, 1500);
    if (extendedScreen()) strike('multiple_screens', 'screens');

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('webkitfullscreenchange', onFullscreen);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      root.classList.remove('lockdown');
      channel?.close();
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('webkitfullscreenchange', onFullscreen);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      else if (fullscreenElement()) (document as WebkitDocument & { webkitExitFullscreen?: () => void }).webkitExitFullscreen?.();
    };
  }, [attemptId, strike, blocked, report]);

  const resume = async () => {
    if (devtoolsOpen()) return setBlock('devtools');
    if (extendedScreen()) return setBlock('screens');
    if (!canFullscreen() || (await enterFullscreen())) {
      away.current = false;
      setBlock(null);
    }
  };

  const copy = block ? BLOCK_COPY[block] : null;
  return (
    <>
      {/* The work stays mounted (drafts keep autosaving) but is hidden while the candidate is away. */}
      <div aria-hidden={block ? true : undefined} className={block ? 'invisible' : undefined}>
        {children}
      </div>
      <Watermark text={state.candidate.email} />
      {copy && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="lockdown-title" className="fixed inset-0 z-[1000] flex isolate flex-col items-center justify-center gap-6 px-4 text-center">
          <SceneBackdrop />
          <Brand />
          <div className="flex max-w-md flex-col items-center gap-3">
            {block === 'screens' || block === 'second_tab' ? <MonitorX className="size-10 text-danger" /> : <ShieldAlert className="size-10 text-danger" />}
            <h1 id="lockdown-title" className="text-xl font-semibold text-ink">
              {copy.title}
            </h1>
            <p className="text-sm text-muted">{copy.body}</p>
            <p className="text-sm font-medium text-ink">
              Strikes: {strikes} of {limit}. At {limit} strikes the assessment closes and is marked incomplete.
            </p>
          </div>
          {block !== 'second_tab' && (
            <Button size="lg" onClick={() => void resume()}>
              <Maximize /> Return to the assessment
            </Button>
          )}
        </div>
      )}
      {notice && !block && (
        <div role="status" className="fixed bottom-4 left-1/2 z-[999] -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-canvas shadow-lg">
          {notice}
        </div>
      )}
    </>
  );
}

/** Faint, repeated candidate email over the workspace: photos of the screen stay traceable. */
function Watermark({ text }: { text: string }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[998] select-none overflow-hidden opacity-[0.045]">
      <div className="-rotate-[24deg] absolute -inset-1/2 flex flex-wrap content-start gap-x-24 gap-y-20 text-sm font-semibold text-ink">
        {Array.from({ length: 160 }, (_, i) => (
          <span key={i}>{text}</span>
        ))}
      </div>
    </div>
  );
}

/** Shown before each workday starts (all are proctored). */
export function LockdownNotice({ limit }: { limit: number }) {
  return (
    <Alert tone="warning" title="This workday is proctored">
      The workday opens in fullscreen where your device allows it. Copy, paste, text inserted by extensions or other tools, right-click, printing, developer tools and browser shortcuts are disabled. Switching tab or app, leaving fullscreen, a second screen or tab, or a screen capture each count as a strike, and the employer sees them. At {limit} strikes the assessment closes and is marked incomplete. Close other apps and turn off notifications before you start.
    </Alert>
  );
}
