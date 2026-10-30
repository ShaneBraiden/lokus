import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { REQUEST_STATUSES, W2_REQUESTS, type RequestRecordDTO, type W2RequestKey } from '@lokus/shared';
import { errorMessage, http } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { Alert, Button, Card, CardBody, CardFooter, CardHeader, Field, Input, Select, Textarea, useToast } from '@/ui';
import { base } from '../api';
import { useDraft, usePlayer } from '../PlayerContext';

export interface RecordValues {
  summary: string;
  status: string;
  owner: string;
  next_step: string;
  date: string;
}

const EMPTY: RecordValues = { summary: '', status: '', owner: '', next_step: '', date: '' };

const fromSaved = (r: RequestRecordDTO | null): RecordValues => (r ? { summary: r.summary, status: r.status, owner: r.owner, next_step: r.next_step, date: r.date } : EMPTY);
const same = (a: RecordValues, b: RecordValues) => (Object.keys(EMPTY) as (keyof RecordValues)[]).every((k) => a[k].trim() === b[k].trim());

export const recordDraftKey = (k: W2RequestKey) => `record:${k}`;
export const NARRATIVE_DRAFT = 'narrative';

/** True when a record block or the narrative has text that was typed but not saved. */
export function useUnsavedRecord(): boolean {
  const { state, progress } = usePlayer();
  const drafts = progress.get().drafts ?? {};
  const blocks = W2_REQUESTS.some((r) => {
    const d = drafts[recordDraftKey(r.key)] as RecordValues | undefined;
    return d && !same(d, fromSaved(state.t2.record[r.key]));
  });
  const n = drafts[NARRATIVE_DRAFT] as string | undefined;
  return blocks || (n !== undefined && n.trim() !== state.t2.record.narrative.trim());
}

function RequestBlock({ request }: { request: (typeof W2_REQUESTS)[number] }) {
  const { attemptId, state, refresh } = usePlayer();
  const toast = useToast();
  const saved = state.t2.record[request.key];
  const draft = useDraft<RecordValues>(recordDraftKey(request.key));
  const [values, setValues] = useState<RecordValues>(() => draft.read() ?? fromSaved(saved));
  const dirty = !same(values, fromSaved(saved));
  const set = (k: keyof RecordValues, v: string) => {
    const next = { ...values, [k]: v };
    setValues(next);
    draft.save(next);
  };
  const save = useMutation({
    mutationFn: () => http.put(`${base(attemptId)}/t2/record/${request.key}`, values),
    onSuccess: async () => {
      await refresh();
      draft.clear();
      toast.success('Record saved');
    },
  });
  const id = (f: string) => `${request.key}-${f}`;
  return (
    <Card>
      <CardHeader title={request.label} />
      <CardBody className="flex flex-col gap-4">
        {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
        <Field label="Summary" htmlFor={id('summary')}>
          <Textarea id={id('summary')} rows={3} value={values.summary} onChange={(e) => set('summary', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status" htmlFor={id('status')}>
            <Select id={id('status')} value={values.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">Not set</option>
              {REQUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Owner" htmlFor={id('owner')}>
            <Input id={id('owner')} value={values.owner} maxLength={200} onChange={(e) => set('owner', e.target.value)} />
          </Field>
          <Field label="Date" htmlFor={id('date')}>
            <Input id={id('date')} type="date" value={values.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
        </div>
        <Field label="Next step" htmlFor={id('next')}>
          <Textarea id={id('next')} rows={2} value={values.next_step} onChange={(e) => set('next_step', e.target.value)} />
        </Field>
      </CardBody>
      <CardFooter className="justify-between">
        <p className="text-xs text-muted">{dirty ? 'Unsaved changes' : saved ? `Saved ${formatTime(saved.saved_at)}` : 'Not saved yet'}</p>
        <Button size="sm" onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
          Save
        </Button>
      </CardFooter>
    </Card>
  );
}

function NarrativeBlock() {
  const { attemptId, state, refresh } = usePlayer();
  const toast = useToast();
  const draft = useDraft<string>(NARRATIVE_DRAFT);
  const saved = state.t2.record.narrative;
  const [text, setText] = useState(() => draft.read() ?? saved);
  const dirty = text.trim() !== saved.trim();
  const save = useMutation({
    mutationFn: () => http.put(`${base(attemptId)}/t2/narrative`, { narrative: text }),
    onSuccess: async () => {
      await refresh();
      draft.clear();
      toast.success('Record saved');
    },
  });
  return (
    <Card>
      <CardHeader title="Narrative" description="Anything else the study record should show about today." />
      <CardBody className="flex flex-col gap-3">
        {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
        <label htmlFor="narrative" className="sr-only">
          Narrative
        </label>
        <Textarea
          id="narrative"
          rows={5}
          value={text}
          maxLength={6000}
          onChange={(e) => {
            setText(e.target.value);
            draft.save(e.target.value);
          }}
        />
      </CardBody>
      <CardFooter className="justify-between">
        <p className="text-xs text-muted">{dirty ? 'Unsaved changes' : saved ? 'Saved' : 'Not saved yet'}</p>
        <Button size="sm" onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
          Save
        </Button>
      </CardFooter>
    </Card>
  );
}

/** The structured issue record (F15): one block per sponsor request, plus a free-text narrative. */
export function IssueRecord() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-ink">Issue record · AHS-DM-026</h2>
        <p className="mt-1 text-sm text-muted">The study team&rsquo;s running record of open requests. Save each block when it is up to date.</p>
      </div>
      {W2_REQUESTS.map((r) => (
        <RequestBlock key={r.key} request={r} />
      ))}
      <NarrativeBlock />
    </div>
  );
}
