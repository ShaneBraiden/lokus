import { useMutation } from '@tanstack/react-query';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import drAnjali from '@/assets/images/dr-anjali.webp';
import quietDesk from '@/assets/images/quiet-desk.webp';
import { errorMessage, http } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Alert, Avatar, Button, Field, Textarea } from '@/ui';
import { base } from '../api';
import { ScreenFrame } from '../layout/ScreenFrame';
import { useDraft, usePlayer, useRememberScreen } from '../PlayerContext';
import { screenPath } from '../SimulationShell';

/** Neutral close of Workday 2 with an optional, unscored reflection. No rubric themes and no feedback. */
export function Debrief() {
  useRememberScreen('debrief');
  const { attemptId, progress } = usePlayer();
  const navigate = useNavigate();
  const draft = useDraft<string>('reflection');
  const [text, setText] = useState(() => draft.read() ?? '');
  const done = () => {
    draft.clear();
    progress.patch((s) => ({ ...s, screen: 'complete' }));
    navigate(screenPath(attemptId, 'complete'), { replace: true });
  };
  const submit = useMutation({ mutationFn: () => http.post(`${base(attemptId)}/reflection`, { text }), onSuccess: done });
  return (
    <ScreenFrame
      eyebrow="Workday 2 · finished"
      title="Thank you — that’s the end of Workday 2"
      actions={
        <>
          <Button size="lg" loading={submit.isPending} disabled={!text.trim()} onClick={() => submit.mutate()}>
            Send reflection
          </Button>
          <Button variant="ghost" onClick={done}>
            Skip
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <Avatar name="Anjali Roy" src={drAnjali} />
        <div className="text-[15px]">
          <p className="font-semibold text-ink">Dr. Anjali Roy</p>
          <p className="text-xs text-muted">Clinical Project Manager</p>
          <p className="mt-2">Your work from both days will now be reviewed. You can add a short reflection below if you like; it is optional and is not scored.</p>
        </div>
      </div>
      {submit.error && <Alert tone="danger">{errorMessage(submit.error)}</Alert>}
      <Field label="Your reflection" htmlFor="reflection" optional>
        <Textarea
          id="reflection"
          rows={5}
          maxLength={4000}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            draft.save(e.target.value);
          }}
        />
      </Field>
    </ScreenFrame>
  );
}

export function Complete() {
  useRememberScreen('complete');
  const { state } = usePlayer();
  return (
    <ScreenFrame
      image={quietDesk}
      eyebrow="Assessment submitted"
      title="You’ve completed the simulation"
      actions={
        <Button asChild size="lg">
          <Link to="/app">
            Back to your dashboard <ArrowRight />
          </Link>
        </Button>
      }
    >
      <p className="flex items-center gap-2 font-medium text-ink">
        <CircleCheck className="size-5 text-success" /> Submitted {formatDateTime(state.attempt.t2_submitted_at)}
      </p>
      <p>Thank you for your time. Parts of your work are now reviewed by trained Lokus assessors, which usually takes a few working days.</p>
      <p>
        {state.attempt.org_name
          ? `${state.attempt.org_name} receives your result and will be in touch about next steps.`
          : 'Your result is private. If you would like employers to find it, you can join the talent pool from Privacy & sharing on your dashboard.'}{' '}
        Candidates do not see scores.
      </p>
    </ScreenFrame>
  );
}

export function Closed() {
  useRememberScreen('closed');
  const { state } = usePlayer();
  return (
    <ScreenFrame
      eyebrow="Assessment closed"
      title="This assessment is closed"
      actions={
        <Button asChild size="lg">
          <Link to="/app">Back to your dashboard</Link>
        </Button>
      }
    >
      <p>{state.attempt.close_reason === 'expired' ? 'The deadline passed before the assessment was finished, so it can no longer be changed.' : 'Lokus closed this assessment, so it can no longer be changed.'}</p>
      <p>If you think this is a mistake, contact the employer who invited you or hello@lokus.example.</p>
    </ScreenFrame>
  );
}
