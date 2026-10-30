import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { DIRECTORY_BY_ID, W2_DECISIONS, type MailMessageDTO, type W2DecisionKey } from '@lokus/shared';
import { errorMessage, http } from '@/lib/api';
import { Alert, Button, Field, Input, Sheet, Textarea, useToast } from '@/ui';
import { base } from '../api';
import { useDraft, usePlayer } from '../PlayerContext';
import { RecipientPicker } from '../shared/RecipientPicker';

const schema = z.object({
  to: z.array(z.string()).min(1, 'Choose at least one recipient.').max(6),
  cc: z.array(z.string()).max(6),
  subject: z.string().trim().min(1, 'Add a subject.').max(250),
  body: z.string().trim().min(1, 'Write your message before sending.').max(10000),
});
type Values = z.infer<typeof schema>;

export type ComposeMode = { kind: 'reply-sponsor'; original: MailMessageDTO } | { kind: 'reply'; original: MailMessageDTO; to: string } | { kind: 'new' };

const reSubject = (s: string) => (/^re:/i.test(s) ? s : `Re: ${s}`);

function draftKey(mode: ComposeMode) {
  if (mode.kind === 'reply-sponsor') return 'reply';
  if (mode.kind === 'reply') return `message:reply:${mode.original.id}`;
  return 'message:new';
}

function decisionLabel(key: W2DecisionKey, value: string | null) {
  return (W2_DECISIONS[key].options as readonly { value: string; label: string }[]).find((o) => o.value === value)?.label ?? null;
}

/**
 * Mail composer for Workday 2. A reply to the sponsor is the one reply the record keeps (POST /reply); everything
 * else is a new internal or external message (POST /messages). Unsent text is kept as a draft.
 */
export function Composer({ mode, onClose }: { mode: ComposeMode; onClose: () => void }) {
  const { attemptId, state, refresh } = usePlayer();
  const toast = useToast();
  const draft = useDraft<Values>(draftKey(mode));
  const initial = useMemo<Values>(() => {
    const saved = draft.read();
    if (saved) return saved;
    if (mode.kind === 'reply-sponsor') return { to: ['sponsor'], cc: [], subject: reSubject(mode.original.subject), body: '' };
    if (mode.kind === 'reply') return { to: [mode.to], cc: [], subject: reSubject(mode.original.subject), body: '' };
    return { to: [], cc: [], subject: '', body: '' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  useEffect(() => {
    const sub = form.watch((v) => draft.save(v as Values));
    return () => sub.unsubscribe();
  }, [form, draft]);

  const isSponsorReply = mode.kind === 'reply-sponsor';
  const { sae, waiver } = state.t2.decisions;
  const decisionsReady = Boolean(sae && waiver);

  const send = useMutation({
    mutationFn: (v: Values) => http.post(`${base(attemptId)}/t2/${isSponsorReply ? 'reply' : 'messages'}`, v),
    onSuccess: async () => {
      draft.clear();
      await refresh();
      toast.success(isSponsorReply ? 'Reply sent' : 'Message sent');
      onClose();
    },
  });

  const discard = () => {
    draft.clear();
    onClose();
  };
  const { errors } = form.formState;
  const sponsor = DIRECTORY_BY_ID.sponsor;

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={mode.kind === 'new' ? 'New message' : 'Reply'}
      description={mode.kind === 'new' ? undefined : mode.original.subject}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={discard} className="mr-auto">
            Discard
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" form="composer" loading={send.isPending} disabled={isSponsorReply && !decisionsReady}>
            Send
          </Button>
        </>
      }
    >
      <form id="composer" className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => send.mutate(v))} noValidate>
        {send.error && <Alert tone="danger">{errorMessage(send.error)}</Alert>}
        {isSponsorReply && !decisionsReady && <Alert tone="info">Record your decision on both requests, on the email, before sending your reply.</Alert>}
        {isSponsorReply && decisionsReady && (
          <div className="rounded-lg border border-line bg-subtle px-3.5 py-2.5 text-[13px] text-ink-2">
            <p className="font-semibold text-ink">Sent with your decisions</p>
            <p className="mt-0.5">
              {W2_DECISIONS.sae.label}: <span className="font-medium text-ink">{decisionLabel('sae', sae)}</span>
            </p>
            <p>
              {W2_DECISIONS.waiver.label}: <span className="font-medium text-ink">{decisionLabel('waiver', waiver)}</span>
            </p>
          </div>
        )}
        <Field label="To" htmlFor="compose-to" required error={errors.to?.message}>
          {isSponsorReply ? (
            <div id="compose-to" className="flex min-h-10 items-center rounded-lg border border-line-strong bg-subtle px-3 text-sm text-ink">
              {sponsor.name} &lt;{sponsor.email}&gt;
            </div>
          ) : (
            <Controller control={form.control} name="to" render={({ field }) => <RecipientPicker id="compose-to" value={field.value} onChange={field.onChange} invalid={!!errors.to} />} />
          )}
        </Field>
        <Field label="Cc" htmlFor="compose-cc">
          <Controller control={form.control} name="cc" render={({ field }) => <RecipientPicker id="compose-cc" value={field.value} onChange={field.onChange} exclude={isSponsorReply ? ['sponsor'] : []} />} />
        </Field>
        <Field label="Subject" htmlFor="compose-subject" required error={errors.subject?.message}>
          <Input id="compose-subject" maxLength={250} {...form.register('subject')} />
        </Field>
        <Field label="Message" htmlFor="compose-body" required error={errors.body?.message}>
          <Textarea id="compose-body" rows={12} {...form.register('body')} />
        </Field>
        {mode.kind !== 'new' && (
          <details className="rounded-lg border border-line bg-subtle/60 px-3.5 py-2.5 text-[13px] text-ink-2">
            <summary className="cursor-pointer font-medium text-ink">Original message from {mode.original.from.name}</summary>
            <div className="mt-2 flex flex-col gap-2 border-l-2 border-line-strong pl-3">
              {mode.original.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </details>
        )}
      </form>
    </Sheet>
  );
}
