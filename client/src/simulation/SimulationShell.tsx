import { useEffect } from 'react';
import { Link, Navigate, Outlet, useMatches, useParams } from 'react-router';
import type { AttemptPhase } from '@lokus/shared';
import type { ScreenHandle } from '@/app/router';
import { ApiError, api, errorMessage } from '@/lib/api';
import { RequireRole } from '@/lib/auth';
import { Alert, Button, PageLoader } from '@/ui';
import { base, useAttemptState } from './api';
import { Brand } from './layout/SimHeader';
import { LockdownGuard } from './Lockdown';
import { PlayerProvider, usePlayer } from './PlayerContext';

/** The screens of each phase, first one being where the phase begins. The server's phase decides what is reachable. */
export const PHASE_SCREENS: Record<AttemptPhase, string[]> = {
  intro: ['overview', 'welcome'],
  workday1: ['briefing', 'workspace', 'review'],
  between: ['workday-1-complete', 'workday-2'],
  workday2: ['inbox'],
  done: ['debrief', 'complete'],
  closed: ['closed'],
};

export function screenPath(attemptId: string, screen: string) {
  return `/sim/${attemptId}/${screen}`;
}

function defaultScreen(phase: AttemptPhase, remembered: string | undefined) {
  const screens = PHASE_SCREENS[phase];
  return remembered && screens.includes(remembered) ? remembered : screens[0];
}

/** Index and unknown paths: go to the remembered screen for the current phase, or the phase's first screen. */
export function PhaseRedirect() {
  const { attemptId, phase, progress } = usePlayer();
  return <Navigate to={screenPath(attemptId, defaultScreen(phase, progress.get().screen))} replace />;
}

function PlayerError({ error }: { error: unknown }) {
  const missing = error instanceof ApiError && error.status === 404;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <Brand />
      <div className="w-full max-w-md">
        <Alert tone="danger" title={missing ? 'We couldn’t find this assessment' : 'The simulation could not load'}>
          {missing ? 'The link may be wrong, or the assessment belongs to another account.' : errorMessage(error)}
        </Alert>
      </div>
      <div className="flex gap-2">
        {!missing && <Button onClick={() => window.location.reload()}>Try again</Button>}
        <Button asChild variant="secondary">
          <Link to="/app">Back to your dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

/** Interruptions (tab hidden, then back) are recorded as telemetry during the workdays. Never scored. */
function useInterruptionTelemetry(attemptId: string, active: boolean) {
  useEffect(() => {
    if (!active) return;
    let hiddenAt: number | null = null;
    const send = (type: 'interruption_started' | 'interruption_ended', metadata: Record<string, number>) =>
      void api(`${base(attemptId)}/telemetry`, { method: 'POST', body: { type, metadata }, keepalive: true }).catch(() => undefined);
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        send('interruption_started', {});
      } else if (hiddenAt !== null) {
        send('interruption_ended', { away_seconds: Math.round((Date.now() - hiddenAt) / 1000) });
        hiddenAt = null;
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [attemptId, active]);
}

function Gate() {
  const { attemptId, phase, state } = usePlayer();
  const matches = useMatches();
  const handle = matches[matches.length - 1]?.handle as ScreenHandle | undefined;
  useInterruptionTelemetry(attemptId, phase === 'workday1' || phase === 'workday2');
  if (handle && !handle.phases.includes(phase)) return <PhaseRedirect />;
  if (state.attempt.lockdown.required && (phase === 'workday1' || phase === 'workday2'))
    return (
      <LockdownGuard key={phase}>
        <Outlet />
      </LockdownGuard>
    );
  return <Outlet />;
}

function PlayerRoot() {
  const { attemptId = '' } = useParams();
  const state = useAttemptState(attemptId);
  if (state.isLoading) return <PageLoader />;
  if (state.error || !state.data) return <PlayerError error={state.error} />;
  return (
    <PlayerProvider key={attemptId} state={state.data}>
      <Gate />
    </PlayerProvider>
  );
}

/** Layout route for /sim/:attemptId/*. */
export function SimulationShell() {
  return (
    <RequireRole kind="candidate">
      <PlayerRoot />
    </RequireRole>
  );
}
