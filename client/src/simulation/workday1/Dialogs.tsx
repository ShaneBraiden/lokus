import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CRF_HEADER_FIELDS, CRF_VISIT_FIELDS, PARTICIPANT_IDS, VISIT_LABELS, type FindingDTO, type ParticipantCrfDTO } from '@lokus/shared';
import { errorMessage, http } from '@/lib/api';
import { Alert, Button, Checkbox, Dialog, Field, Input, Select, Spinner, Textarea, useToast } from '@/ui';
import { base, simKeys } from '../api';
import { useDraft, usePlayer } from '../PlayerContext';
import { RecipientPicker } from '../shared/RecipientPicker';
import { fieldLabel, shortId, visitLabel, type Cell } from './model';

/** Applies a changed (or restored) value to the cached CRF so the form updates without re-opening the record. */
export function applyCellValue(qc: QueryClient, attemptId: string, cell: Cell, value: string, original: string, edited: boolean) {
  qc.setQueryData<ParticipantCrfDTO>(simKeys.crf(attemptId, cell.participant_id), (crf) => {
    if (!crf) return crf;
    const header = cell.visit === 'NA' ? { ...crf.header, [cell.field]: value } : crf.header;
    const visits = cell.visit === 'NA' ? crf.visits : crf.visits.map((v) => (v.visit === cell.visit ? { ...v, values: { ...v.values, [cell.field]: value } } : v));
    const others = crf.edits.filter((e) => !(e.visit === cell.visit && e.field === cell.field));
    const edits = edited ? [...others, { participant_id: cell.participant_id, visit: cell.visit, field: cell.field, original, value }] : others;
    return { ...crf, header, visits, edits };
  });
}

function cellTitle(cell: Cell) {
  return `${shortId(cell.participant_id)} · ${fieldLabel(cell.field)}${cell.visit === 'NA' ? '' : ` · ${visitLabel(cell.visit)}`}`;
}

/** The neutral value editor (F10): opening, cancelling and saving are all recorded; there is no guidance. */
export function EditValueDialog({ cell, onClose }: { cell: Cell; onClose: () => void }) {
  const { attemptId, refresh } = usePlayer();
  const qc = useQueryClient();
  const toast = useToast();
  const [loaded, setLoaded] = useState<{ original: string; current: string } | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const finished = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    http
      .post<{ original: string; current: string }>(`${base(attemptId)}/t1/edits/start`, cell)
      .then((r) => {
        setLoaded(r);
        setValue(r.current);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [attemptId, cell]);

  const commit = useMutation({
    mutationFn: () => http.post<{ original: string; value: string }>(`${base(attemptId)}/t1/edits/commit`, { ...cell, value: value.trim() }),
    onSuccess: (r) => {
      finished.current = true;
      applyCellValue(qc, attemptId, cell, r.value, r.original, r.value !== r.original);
      void refresh();
      toast.success('Value saved');
      onClose();
    },
  });

  const cancel = () => {
    if (!finished.current && loaded) {
      finished.current = true;
      void http.post(`${base(attemptId)}/t1/edits/cancel`, { ...cell, draft_changed: value.trim() !== loaded.current }).catch(() => undefined);
    }
    onClose();
  };

  const unchanged = !loaded || value.trim() === loaded.current;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && cancel()}
      title="Edit value"
      description={cellTitle(cell)}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={cancel}>
            Cancel
          </Button>
          <Button onClick={() => commit.mutate()} disabled={unchanged} loading={commit.isPending}>
            Save value
          </Button>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {!loaded && !error && <Spinner />}
      {loaded && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!unchanged) commit.mutate();
          }}
        >
          {commit.error && (
            <Alert tone="danger" className="mb-4">
              {errorMessage(commit.error)}
            </Alert>
          )}
          <Field label="Value" htmlFor="cell-value">
            <Input id="cell-value" value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} autoFocus />
          </Field>
        </form>
      )}
    </Dialog>
  );
}

/** Recommend a correction instead of changing the source value. */
export function CorrectionDialog({ cell, current, onClose }: { cell: Cell; current: string; onClose: () => void }) {
  const { attemptId, refresh } = usePlayer();
  const toast = useToast();
  const schema = z.object({ proposed: z.string().trim().min(1, 'Enter the value you recommend.').max(200), rationale: z.string().trim().max(2000) });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { proposed: '', rationale: '' } });
  const save = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => http.post(`${base(attemptId)}/t1/corrections`, { ...cell, ...v }),
    onSuccess: () => {
      void refresh();
      toast.success('Correction recommended');
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Recommend a correction"
      description={cellTitle(cell)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="correction-form" loading={save.isPending}>
            Recommend correction
          </Button>
        </>
      }
    >
      <form id="correction-form" className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
        <p className="text-sm text-muted">
          Current value: <span className="font-medium text-ink">{current || 'blank'}</span>
        </p>
        <Field label="Recommended value" htmlFor="proposed" required error={form.formState.errors.proposed?.message}>
          <Input id="proposed" maxLength={200} {...form.register('proposed')} />
        </Field>
        <Field label="Rationale" htmlFor="rationale">
          <Textarea id="rationale" rows={3} {...form.register('rationale')} />
        </Field>
      </form>
    </Dialog>
  );
}

const ALL_FIELDS = [...CRF_HEADER_FIELDS, ...CRF_VISIT_FIELDS];
const escalationSchema = z.object({
  to: z.array(z.string()).min(1, 'Choose at least one recipient.').max(6),
  cc: z.array(z.string()).max(6),
  participant_id: z.string().min(1, 'Choose the participant.'),
  visit: z.string(),
  fields: z.array(z.string()),
  facts: z.string().trim().min(1, 'Describe what you observed.').max(4000),
  requested_action: z.string().trim().max(2000),
});
type EscalationValues = z.infer<typeof escalationSchema>;

/** Explicit safety escalation (F9). Offered identically on every record; recipients start empty. */
export function EscalationDialog({ participantId, onClose }: { participantId: string; onClose: () => void }) {
  const { attemptId, refresh } = usePlayer();
  const toast = useToast();
  const draft = useDraft<EscalationValues>('escalation');
  const initial = useMemo<EscalationValues>(() => {
    const saved = draft.read();
    if (saved && saved.participant_id === participantId) return saved;
    return { to: [], cc: [], participant_id: participantId, visit: '', fields: [], facts: '', requested_action: '' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const form = useForm<EscalationValues>({ resolver: zodResolver(escalationSchema), defaultValues: initial });
  useEffect(() => {
    const sub = form.watch((v) => draft.save(v as EscalationValues));
    return () => sub.unsubscribe();
  }, [form, draft]);
  const send = useMutation({
    mutationFn: (v: EscalationValues) => http.post(`${base(attemptId)}/t1/escalations`, { ...v, visit: v.visit || null }),
    onSuccess: () => {
      draft.clear();
      void refresh();
      toast.success('Safety concern escalated');
      onClose();
    },
  });
  const close = () => {
    draft.clear();
    onClose();
  };
  const { errors } = form.formState;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title="Escalate a safety concern"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="escalation-form" loading={send.isPending}>
            Send escalation
          </Button>
        </>
      }
    >
      <form id="escalation-form" className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => send.mutate(v))} noValidate>
        {send.error && <Alert tone="danger">{errorMessage(send.error)}</Alert>}
        <Field label="To" htmlFor="esc-to" required error={errors.to?.message}>
          <Controller control={form.control} name="to" render={({ field }) => <RecipientPicker id="esc-to" value={field.value} onChange={field.onChange} invalid={!!errors.to} />} />
        </Field>
        <Field label="Cc" htmlFor="esc-cc">
          <Controller control={form.control} name="cc" render={({ field }) => <RecipientPicker id="esc-cc" value={field.value} onChange={field.onChange} />} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Participant" htmlFor="esc-participant" required error={errors.participant_id?.message}>
            <Select id="esc-participant" {...form.register('participant_id')}>
              {PARTICIPANT_IDS.map((p, i) => (
                <option key={p} value={p}>
                  {i + 1}. {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Visit" htmlFor="esc-visit">
            <Select id="esc-visit" {...form.register('visit')}>
              <option value="">Not specified</option>
              {(['W0', 'W4', 'W8', 'W12'] as const).map((v) => (
                <option key={v} value={v}>
                  {VISIT_LABELS[v]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-ink">CRF fields concerned</legend>
          <Controller
            control={form.control}
            name="fields"
            render={({ field }) => (
              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-3">
                {ALL_FIELDS.map((f) => (
                  <Checkbox
                    key={f.key}
                    label={<span className="font-normal">{f.label}</span>}
                    checked={field.value.includes(f.key)}
                    onChange={(e) => field.onChange(e.target.checked ? [...field.value, f.key] : field.value.filter((k) => k !== f.key))}
                  />
                ))}
              </div>
            )}
          />
        </fieldset>
        <Field label="What you observed" htmlFor="esc-facts" required error={errors.facts?.message}>
          <Textarea id="esc-facts" rows={4} {...form.register('facts')} />
        </Field>
        <Field label="What you are asking for" htmlFor="esc-action">
          <Textarea id="esc-action" rows={3} {...form.register('requested_action')} />
        </Field>
      </form>
    </Dialog>
  );
}

const noteSchema = z.object({
  to: z.array(z.string()).min(1, 'Choose at least one recipient.').max(6),
  subject: z.string().trim().min(1, 'Add a subject.').max(200),
  text: z.string().trim().min(1, 'Write your message.').max(4000),
});
type NoteValues = z.infer<typeof noteSchema>;

/** "Message Dr. Anjali": a note to the supervisor (or others), e.g. to question an instruction. */
export function NoteDialog({ onClose }: { onClose: () => void }) {
  const { attemptId, refresh } = usePlayer();
  const toast = useToast();
  const draft = useDraft<NoteValues>('note');
  const initial = useMemo<NoteValues>(() => draft.read() ?? { to: ['anjali'], subject: '', text: '' }, [draft]);
  const form = useForm<NoteValues>({ resolver: zodResolver(noteSchema), defaultValues: initial });
  useEffect(() => {
    const sub = form.watch((v) => draft.save(v as NoteValues));
    return () => sub.unsubscribe();
  }, [form, draft]);
  const send = useMutation({
    mutationFn: (v: NoteValues) => http.post(`${base(attemptId)}/t1/notes`, v),
    onSuccess: () => {
      draft.clear();
      void refresh();
      toast.success('Message sent');
      onClose();
    },
  });
  const close = () => {
    draft.clear();
    onClose();
  };
  const { errors } = form.formState;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title="New message"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Discard
          </Button>
          <Button type="submit" form="note-form" loading={send.isPending}>
            Send
          </Button>
        </>
      }
    >
      <form id="note-form" className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => send.mutate(v))} noValidate>
        {send.error && <Alert tone="danger">{errorMessage(send.error)}</Alert>}
        <Field label="To" htmlFor="note-to" required error={errors.to?.message}>
          <Controller control={form.control} name="to" render={({ field }) => <RecipientPicker id="note-to" value={field.value} onChange={field.onChange} invalid={!!errors.to} />} />
        </Field>
        <Field label="Subject" htmlFor="note-subject" required error={errors.subject?.message}>
          <Input id="note-subject" maxLength={200} {...form.register('subject')} />
        </Field>
        <Field label="Message" htmlFor="note-text" required error={errors.text?.message}>
          <Textarea id="note-text" rows={7} {...form.register('text')} />
        </Field>
      </form>
    </Dialog>
  );
}

export function WithdrawDialog({ finding, onClose }: { finding: FindingDTO; onClose: () => void }) {
  const { attemptId, refresh } = usePlayer();
  const toast = useToast();
  const withdraw = useMutation({
    mutationFn: () => http.post(`${base(attemptId)}/t1/findings/${finding.id}/withdraw`),
    onSuccess: async () => {
      await refresh();
      toast.success(`${finding.id} withdrawn`);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Withdraw ${finding.id}?`}
      description="It is removed from your review. You can log a new finding at any time."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" loading={withdraw.isPending} onClick={() => withdraw.mutate()}>
            Withdraw
          </Button>
        </>
      }
    >
      {withdraw.error && <Alert tone="danger">{errorMessage(withdraw.error)}</Alert>}
    </Dialog>
  );
}
