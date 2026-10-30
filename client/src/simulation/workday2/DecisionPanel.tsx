import { useMutation } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { W2_DECISIONS, type W2DecisionKey } from '@lokus/shared';
import { errorMessage, http } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { Card, CardBody, CardHeader, RadioCards, useToast } from '@/ui';
import { base } from '../api';
import { usePlayer } from '../PlayerContext';

type Decisions = Record<W2DecisionKey, string | null>;

/** The two forced choices (F13): neutral order, nothing preselected, saved on change, locked once the reply is sent. */
export function DecisionPanel() {
  const { attemptId, state, refresh } = usePlayer();
  const toast = useToast();
  const [local, setLocal] = useState<Decisions>(state.t2.decisions);
  useEffect(() => setLocal(state.t2.decisions), [state.t2.decisions]);
  const locked = state.t2.decisions_locked;

  const save = useMutation({
    mutationFn: ({ key, value }: { key: W2DecisionKey; value: string }) => http.put(`${base(attemptId)}/t2/decisions/${key}`, { value }),
    onSuccess: () => void refresh(),
    onError: (e) => {
      setLocal(state.t2.decisions);
      toast.error('Your decision was not saved', errorMessage(e));
    },
  });

  const choose = (key: W2DecisionKey, value: string) => {
    setLocal((d) => ({ ...d, [key]: value }));
    save.mutate({ key, value });
  };

  return (
    <Card>
      <CardHeader
        title="Your decisions"
        description={locked ? undefined : 'Record a decision on each request. Decisions become final when you send your reply.'}
        action={
          locked ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
              <Lock className="size-3.5" /> Final{state.t2.reply ? ` · replied ${formatTime(state.t2.reply.sent_at)}` : ''}
            </span>
          ) : undefined
        }
      />
      <CardBody className="flex flex-col gap-5">
        {(Object.keys(W2_DECISIONS) as W2DecisionKey[]).map((key) => (
          <RadioCards<string>
            key={key}
            name={`decision-${key}`}
            legend={W2_DECISIONS[key].label}
            value={local[key]}
            options={W2_DECISIONS[key].options as readonly { value: string; label: string }[]}
            onChange={(v) => choose(key, v)}
            disabled={locked}
          />
        ))}
      </CardBody>
    </Card>
  );
}
