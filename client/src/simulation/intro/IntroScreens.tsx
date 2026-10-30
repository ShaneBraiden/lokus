import { useMutation } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import office from '@/assets/images/office.webp';
import workplace from '@/assets/images/workplace.webp';
import { errorMessage, http } from '@/lib/api';
import { Alert, Button } from '@/ui';
import { base } from '../api';
import { ScreenFrame } from '../layout/ScreenFrame';
import { usePlayer, useRememberScreen } from '../PlayerContext';
import { screenPath } from '../SimulationShell';

function DayCard({ label, title, children }: { label: string; title: string; children: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}

/** Simulation overview: the setting, the two workdays and how the session works. */
export function Overview() {
  useRememberScreen('overview');
  const { state, attemptId } = usePlayer();
  const navigate = useNavigate();
  return (
    <ScreenFrame
      image={workplace}
      eyebrow="NorthrSim · Clinical Trial Associate"
      title={`Welcome to Aurous Healthcare, ${state.candidate.first_name}`}
      actions={
        <Button size="lg" onClick={() => navigate(screenPath(attemptId, 'welcome'))}>
          Continue <ArrowRight />
        </Button>
      }
    >
      <p>
        Aurous Healthcare is a contract research organisation. You are joining the team running study AHS-DM-026, a Phase III trial of SGLT-440, a once-daily tablet for type 2 diabetes,
        sponsored by Biovance Therapeutics.
      </p>
      <p>Over two workdays you will do the work of a Clinical Trial Associate. Your supervisor is Dr. Anjali Roy, Clinical Project Manager.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <DayCard label="Workday 1 · about 60 minutes" title="Data review">
          A quality-control review of case report forms and study documents.
        </DayCard>
        <DayCard label="Workday 2 · about 30 minutes" title="Inbox">
          A morning of correspondence and study records.
        </DayCard>
      </div>
      <p className="text-sm text-muted">The study, the companies and the people are fictional. Your work saves as you go, and you can take a break between the two workdays.</p>
    </ScreenFrame>
  );
}

/** Workday 1 welcome: starting it starts Task 1. */
export function Workday1Welcome() {
  useRememberScreen('welcome');
  const { attemptId, refresh } = usePlayer();
  const navigate = useNavigate();
  const start = useMutation({
    mutationFn: () => http.post(`${base(attemptId)}/tasks/T1/start`),
    onSuccess: async () => {
      await refresh();
      navigate(screenPath(attemptId, 'briefing'), { replace: true });
    },
  });
  return (
    <ScreenFrame
      image={office}
      eyebrow="Workday 1 · Tuesday 20 October 2026"
      title="Your first day on the study team"
      actions={
        <>
          <Button size="lg" loading={start.isPending} onClick={() => start.mutate()}>
            Start Workday 1 <ArrowRight />
          </Button>
          <Button variant="ghost" onClick={() => navigate(screenPath(attemptId, 'overview'))}>
            Back
          </Button>
        </>
      }
    >
      {start.error && <Alert tone="danger">{errorMessage(start.error)}</Alert>}
      <p>It is 08:30 at the Aurous Healthcare office. Dr. Anjali has sent you your first assignment.</p>
      <p>Read her email, then work in the review workspace. It holds the participants&rsquo; case report forms, the study documents, and the tools to record and raise what you find.</p>
      <p>When every participant has a decision recorded, you can submit Workday 1. Plan for about 60 minutes; the time shown is a guide.</p>
    </ScreenFrame>
  );
}
