import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { errorMessage } from '@/lib/api';
import { Alert, Button, Card, Skeleton } from '@/ui';
import { useBriefing } from '../api';
import { usePlayer, useRememberScreen } from '../PlayerContext';
import { MailView } from '../shared/MailView';
import { screenPath } from '../SimulationShell';
import { SceneBackdrop } from '../layout/Backdrop';
import { W1Header } from './W1Header';

/** Dr. Anjali's assignment email. Fetching it records that the instruction was shown (server-observed). */
export function Briefing() {
  useRememberScreen('briefing');
  const { attemptId } = usePlayer();
  const navigate = useNavigate();
  const briefing = useBriefing(attemptId);
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <SceneBackdrop />
      <W1Header section="Inbox" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Inbox · 1 new message</p>
        <Card className="px-5 py-6 sm:px-8 sm:py-8">
          {briefing.isLoading && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-12" />
              <Skeleton className="h-40" />
            </div>
          )}
          {briefing.error && <Alert tone="danger">{errorMessage(briefing.error)}</Alert>}
          {briefing.data && <MailView message={briefing.data} />}
        </Card>
        <div className="mt-6 flex justify-end">
          <Button size="lg" onClick={() => navigate(screenPath(attemptId, 'workspace'))} disabled={!briefing.data}>
            Open the review workspace <ArrowRight />
          </Button>
        </div>
      </main>
    </div>
  );
}
