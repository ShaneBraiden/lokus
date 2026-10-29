import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AttemptPhase, AttemptStateDTO } from '@lokus/shared';
import { ApiError, api } from '@/lib/api';
import { base, useRefreshState } from './api';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Autosaved UI state (current screen and unsent drafts). It is not evidence; evidence is written only by commands. */
export interface ProgressState {
  screen?: string;
  drafts?: Record<string, unknown>;
  seen?: Record<string, boolean>;
  [key: string]: unknown;
}

interface PlayerContextValue {
  attemptId: string;
  state: AttemptStateDTO;
  phase: AttemptPhase;
  refresh: () => Promise<void>;
  /** Milliseconds to add to Date.now() to get the server's clock. */
  serverOffset: number;
  progress: {
    get: () => ProgressState;
    patch: (update: (s: ProgressState) => ProgressState) => void;
    flush: () => Promise<void>;
    status: SaveStatus;
  };
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside the simulation player');
  return ctx;
}

const SAVE_DELAY = 1200;

function useProgressStore(attemptId: string, initial: AttemptStateDTO['progress']) {
  const store = useRef({ version: initial.version, state: initial.state as ProgressState, dirty: false, saving: false, failures: 0, timer: 0 as ReturnType<typeof setTimeout> | 0 });
  const [status, setStatus] = useState<SaveStatus>('idle');

  const flush = useCallback(
    async (keepalive = false) => {
      const s = store.current;
      if (s.timer) clearTimeout(s.timer);
      s.timer = 0;
      if (s.saving || !s.dirty) return;
      s.saving = true;
      s.dirty = false;
      setStatus('saving');
      let retryIn: number | null = null;
      try {
        const res = await api<{ version: number }>(`${base(attemptId)}/progress`, { method: 'PUT', body: { version: s.version, state: s.state }, keepalive });
        s.version = res.version;
        s.failures = 0;
        setStatus('saved');
      } catch (err) {
        s.dirty = true;
        if (err instanceof ApiError && err.code === 'progress_conflict') {
          // Another tab saved in between: keep this tab's state (last writer wins) on top of the newer version.
          s.version = (err.details as { version?: number } | undefined)?.version ?? s.version;
          retryIn = 0;
        } else if (err instanceof ApiError && (err.code === 'attempt_closed' || err.status === 404 || err.status === 401)) {
          s.dirty = false;
          setStatus('idle');
        } else {
          s.failures += 1;
          setStatus('error');
          retryIn = Math.min(30_000, 2000 * 2 ** s.failures);
        }
      } finally {
        s.saving = false;
      }
      if (s.dirty && retryIn !== null) s.timer = setTimeout(() => void flush(), retryIn);
      else if (s.dirty) s.timer = setTimeout(() => void flush(), SAVE_DELAY);
    },
    [attemptId],
  );

  const patch = useCallback(
    (update: (s: ProgressState) => ProgressState) => {
      const s = store.current;
      s.state = update(s.state);
      s.dirty = true;
      if (s.timer) clearTimeout(s.timer);
      s.timer = setTimeout(() => void flush(), SAVE_DELAY);
    },
    [flush],
  );

  const get = useCallback(() => store.current.state, []);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush(true);
    };
    const onPageHide = () => void flush(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      void flush(true);
    };
  }, [flush]);

  return useMemo(() => ({ get, patch, flush: () => flush(), status }), [get, patch, flush, status]);
}

export function PlayerProvider({ state, children }: { state: AttemptStateDTO; children: ReactNode }) {
  const attemptId = state.attempt.id;
  const refreshState = useRefreshState(attemptId);
  const progress = useProgressStore(attemptId, state.progress);
  const serverOffset = useMemo(() => Date.parse(state.server_time) - Date.now(), [state.server_time]);
  const value = useMemo<PlayerContextValue>(
    () => ({ attemptId, state, phase: state.attempt.phase, refresh: refreshState, serverOffset, progress }),
    [attemptId, state, refreshState, serverOffset, progress],
  );
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

/** Remembers the current screen so "Continue" from the dashboard returns to it. */
export function useRememberScreen(screen: string) {
  const { progress, attemptId } = usePlayer();
  useEffect(() => {
    if (progress.get().screen !== screen) progress.patch((s) => ({ ...s, screen }));
    void api(`${base(attemptId)}/telemetry`, { method: 'POST', body: { type: 'screen_viewed', metadata: { screen } } }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
}

/** An unsent draft kept in autosaved progress so it survives a refresh (F18). */
export function useDraft<T>(key: string) {
  const { progress } = usePlayer();
  const read = useCallback(() => progress.get().drafts?.[key] as T | undefined, [progress, key]);
  const save = useCallback((value: T) => progress.patch((s) => ({ ...s, drafts: { ...s.drafts, [key]: value } })), [progress, key]);
  const clear = useCallback(
    () =>
      progress.patch((s) => {
        const drafts = { ...s.drafts };
        delete drafts[key];
        return { ...s, drafts };
      }),
    [progress, key],
  );
  return useMemo(() => ({ read, save, clear }), [read, save, clear]);
}

/** A per-attempt "seen" flag (for one-time help), stored with progress. */
export function useSeenFlag(key: string): [boolean, () => void] {
  const { progress } = usePlayer();
  const [seen, setSeen] = useState(() => Boolean(progress.get().seen?.[key]));
  const markSeen = useCallback(() => {
    setSeen(true);
    progress.patch((s) => ({ ...s, seen: { ...s.seen, [key]: true } }));
  }, [progress, key]);
  return [seen, markSeen];
}
