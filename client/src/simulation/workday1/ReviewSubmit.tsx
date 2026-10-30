import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, errorMessage, http } from '@/lib/api';
import { Alert, Badge, Button, Card, CardHeader, Dialog } from '@/ui';
import { base, useDocuments } from '../api';
import { usePlayer, useRememberScreen } from '../PlayerContext';
import { screenPath } from '../SimulationShell';
import { shortId, targetLabel } from './model';
import { Stagger, StaggerItem } from '@/ui/motion';
import { W1Header } from './W1Header';

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <StaggerItem className="rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-ink tabular">{value}</p>
    </StaggerItem>
  );
}

/** Review & submit (F12): the candidate's own checklist. No scores, no hints about what is right. */
export function ReviewSubmit() {
  useRememberScreen('review');
  const { attemptId, state, refresh } = usePlayer();
  const navigate = useNavigate();
  const docs = useDocuments(attemptId);
  const [confirm, setConfirm] = useState(false);
  const t1 = state.t1;
  const active = t1.findings.filter((f) => !f.withdrawn);
  const documentFindings = active.filter((f) => f.target.type === 'document');
  const unreviewed = t1.participants.filter((p) => p.status === 'unreviewed');

  const submit = useMutation({
    mutationFn: () => http.post(`${base(attemptId)}/tasks/T1/submit`),
    onSuccess: async () => {
      await refresh();
      navigate(screenPath(attemptId, 'workday-1-complete'), { replace: true });
    },
    onError: () => setConfirm(false),
  });
  const incomplete = submit.error instanceof ApiError && submit.error.code === 'review_incomplete' ? ((submit.error.details as { unreviewed?: string[] })?.unreviewed ?? []) : [];

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <W1Header section="Review & submit" />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <Link to={screenPath(attemptId, 'workspace')} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back to the workspace
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Review and submit Workday 1</h1>
          <p className="mt-1 text-sm text-muted">Check your work before you submit. After submitting, Workday 1 can no longer be changed.</p>
        </div>

        {submit.error && (
          <Alert tone="danger" title="Workday 1 was not submitted">
            {errorMessage(submit.error)}
            {incomplete.length > 0 && <span className="mt-1 block">Still to review: {incomplete.map(shortId).join(', ')}.</span>}
          </Alert>
        )}

        <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Records reviewed" value={`${t1.participants.length - unreviewed.length}/${t1.participants.length}`} />
          <Stat label="Findings logged" value={active.length} />
          <Stat label="Escalations sent" value={t1.escalations.length} />
          <Stat label="Messages sent" value={t1.notes.length} />
        </Stagger>

        <Card>
          <CardHeader title="Participant records" description="Every record needs at least one finding or a “No deviation” decision." />
          <ul className="divide-y divide-line">
            {t1.participants.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-6 text-right text-xs font-medium text-faint tabular">{p.page}</span>
                <span className="flex-1 text-sm font-medium text-ink">{p.id}</span>
                {p.status === 'unreviewed' ? (
                  <Badge tone="warning">Not reviewed</Badge>
                ) : p.status === 'no_deviation' ? (
                  <Badge>No deviation</Badge>
                ) : (
                  <Badge>
                    {p.finding_ids.length} finding{p.finding_ids.length === 1 ? '' : 's'}
                  </Badge>
                )}
                <Link to={`${screenPath(attemptId, 'workspace')}?record=${p.id}`} className="text-sm font-semibold text-accent hover:underline">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {documentFindings.length > 0 && (
          <Card>
            <CardHeader title="Study document findings" />
            <ul className="divide-y divide-line">
              {documentFindings.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="font-mono text-xs text-muted">{f.id}</span>
                  <span className="flex-1 text-ink">{targetLabel(f.target, docs.data)}</span>
                  <span className="text-muted">{f.finding_type}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="flex flex-col items-start gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{unreviewed.length ? `${unreviewed.length} record${unreviewed.length === 1 ? '' : 's'} still need a decision.` : 'Every record has a decision.'}</p>
          <Button size="lg" disabled={unreviewed.length > 0} onClick={() => setConfirm(true)}>
            Submit Workday 1
          </Button>
        </div>
      </main>

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Submit Workday 1?"
        description="You won’t be able to change your Workday 1 work after submitting."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Keep working
            </Button>
            <Button loading={submit.isPending} onClick={() => submit.mutate()}>
              Submit
            </Button>
          </>
        }
      />
    </div>
  );
}
