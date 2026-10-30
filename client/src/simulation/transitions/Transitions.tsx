import { useMutation } from '@tanstack/react-query';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { errorMessage, http } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Alert, Button } from '@/ui';
import { CompletionScene, InboxScene } from '@/visuals/SimScenes';
import { base } from '../api';
import { ScreenFrame } from '../layout/ScreenFrame';
import { usePlayer, useRememberScreen } from '../PlayerContext';
import { screenPath } from '../SimulationShell';

export function Workday1Complete() {
  useRememberScreen('workday-1-complete');
  const { attemptId, state } = usePlayer();
  const navigate = useNavigate();
  return (
    <ScreenFrame
      visual={<CompletionScene workdays={1} />}
      eyebrow="Workday 1 · submitted"
      title="That’s the end of Workday 1"
      actions={
        <>
          <Button size="lg" onClick={() => navigate(screenPath(attemptId, 'workday-2'))}>
            Continue to Workday 2 <ArrowRight />
          </Button>
          <Button asChild variant="ghost">
            <Link to="/app">Take a break</Link>
          </Button>
        </>
      }
    >
      <p className="flex items-center gap-2 font-medium text-ink">
        <CircleCheck className="size-5 text-success" /> Submitted {formatDateTime(state.attempt.t1_submitted_at)}
      </p>
      <p>Thank you. Your Workday 1 review is saved and can no longer be changed.</p>
      <p>You can start Workday 2 now or come back later from your dashboard. Workday 2 takes about 30 minutes, so start it when you can work without interruptions.</p>
    </ScreenFrame>
  );
}

/** Workday 2 introduction. Neutral: it says how the day works, not what to look for. */
export function Workday2Intro() {
  useRememberScreen('workday-2');
  const { attemptId, refresh } = usePlayer();
  const navigate = useNavigate();
  const start = useMutation({
    mutationFn: () => http.post(`${base(attemptId)}/tasks/T2/start`),
    onSuccess: async () => {
      await refresh();
      navigate(screenPath(attemptId, 'inbox'), { replace: true });
    },
  });
  return (
    <ScreenFrame
      visual={<InboxScene />}
      eyebrow="Workday 2 · Wednesday 21 October 2026"
      title="A new morning at Aurous Healthcare"
      actions={
        <Button size="lg" loading={start.isPending} onClick={() => start.mutate()}>
          Start Workday 2 <ArrowRight />
        </Button>
      }
    >
      {start.error && <Alert tone="danger">{errorMessage(start.error)}</Alert>}
      <p>It is just after 08:00. Work through your inbox as you would on a normal day: read what has come in, respond where you need to, and keep the study record up to date.</p>
      <p>Plan for about 30 minutes. A countdown appears once your time starts. It is a guide: nothing is sent or submitted automatically.</p>
      <p>When you have finished, choose <span className="font-medium text-ink">Finish Workday 2</span>.</p>
    </ScreenFrame>
  );
}
