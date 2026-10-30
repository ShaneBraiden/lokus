import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Check, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import {
  CRF_HEADER_FIELDS,
  CRF_VISIT_FIELDS,
  DOCUMENT_IDS,
  FINDING_STATUSES,
  FINDING_TYPES,
  PARTICIPANT_IDS,
  SEVERITIES,
  VISIT_LABELS,
  type FindingDTO,
  type FindingTargetInput,
  type ReferenceCodeDTO,
} from '@lokus/shared';
import { errorMessage, http } from '@/lib/api';
import { Alert, Button, Field, Input, Popover, PopoverContent, PopoverTrigger, Select, Sheet, Textarea, cn, useToast } from '@/ui';
import { base, useDocuments, useReferences } from '../api';
import { useDraft, usePlayer } from '../PlayerContext';
import { isHeaderField, targetLabel, type FindingPreset } from './model';

const schema = z
  .object({
    target_type: z.enum(['participant', 'document']),
    participant_id: z.string(),
    document_id: z.string(),
    section_id: z.string(),
    visit: z.string(),
    crf_field: z.string(),
    finding_type: z.string().min(1, 'Choose a finding type.'),
    severity: z.string(),
    reference_codes: z.array(z.string()).max(6, 'Choose up to 6 references.'),
    observed_issue: z.string().max(4000),
    action: z.string().max(2000),
    status: z.string(),
    query_text: z.string().max(4000),
  })
  .superRefine((v, ctx) => {
    if (v.target_type === 'participant' && !v.participant_id) ctx.addIssue({ code: 'custom', path: ['participant_id'], message: 'Choose the participant record.' });
    if (v.target_type === 'document' && !v.document_id) ctx.addIssue({ code: 'custom', path: ['document_id'], message: 'Choose the document.' });
    if (v.target_type === 'document' && !v.section_id) ctx.addIssue({ code: 'custom', path: ['section_id'], message: 'Choose the section.' });
    if (v.target_type === 'participant' && v.crf_field && !isHeaderField(v.crf_field) && v.visit === 'NA') ctx.addIssue({ code: 'custom', path: ['visit'], message: 'Choose the visit this field belongs to.' });
  });
export type FindingFormValues = z.infer<typeof schema>;

const EMPTY: FindingFormValues = {
  target_type: 'participant',
  participant_id: '',
  document_id: '',
  section_id: '',
  visit: '',
  crf_field: '',
  finding_type: '',
  severity: '',
  reference_codes: [],
  observed_issue: '',
  action: '',
  status: '',
  query_text: '',
};

function fromPreset(preset: FindingPreset | null): FindingFormValues {
  if (!preset) return EMPTY;
  const t = preset.target;
  return {
    ...EMPTY,
    target_type: t.type,
    participant_id: t.type === 'participant' ? t.participant_id : '',
    document_id: t.type === 'document' ? t.document_id : '',
    section_id: t.type === 'document' ? t.section_id : '',
    visit: preset.visit ?? '',
    crf_field: preset.crf_field ?? '',
  };
}

function fromFinding(f: FindingDTO): FindingFormValues {
  return {
    target_type: f.target.type,
    participant_id: f.target.type === 'participant' ? f.target.participant_id : '',
    document_id: f.target.type === 'document' ? f.target.document_id : '',
    section_id: f.target.type === 'document' ? f.target.section_id : '',
    visit: f.visit ?? '',
    crf_field: f.crf_field ?? '',
    finding_type: f.finding_type,
    severity: f.severity ?? '',
    reference_codes: f.reference_codes,
    observed_issue: f.observed_issue,
    action: f.action,
    status: f.status ?? '',
    query_text: f.query_text,
  };
}

function toPayload(v: FindingFormValues) {
  const target = (v.target_type === 'participant' ? { type: 'participant', participant_id: v.participant_id } : { type: 'document', document_id: v.document_id, section_id: v.section_id }) as FindingTargetInput;
  const isDoc = v.target_type === 'document';
  return {
    target,
    visit: isDoc ? null : v.visit || null,
    crf_field: isDoc ? null : v.crf_field || null,
    finding_type: v.finding_type,
    severity: v.severity || null,
    reference_codes: v.reference_codes,
    observed_issue: v.observed_issue.trim(),
    action: v.action.trim(),
    status: v.status || null,
    query_text: v.query_text.trim(),
  };
}

function ReferencePicker({ value, onChange, references, docTitles }: { value: string[]; onChange: (v: string[]) => void; references: ReferenceCodeDTO[]; docTitles: Record<string, string> }) {
  const [query, setQuery] = useState('');
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((c) => c !== code) : value.length >= 6 ? value : [...value, code]);
  const q = query.trim().toLowerCase();
  const filtered = references.filter((r) => !q || r.code.toLowerCase().includes(q) || r.title.toLowerCase().includes(q));
  const groups = [...new Set(filtered.map((r) => r.document_id))];
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2 py-1.5">
      {value.map((code) => (
        <span key={code} className="inline-flex items-center gap-1 rounded-md border border-line bg-subtle py-0.5 pl-2 pr-1 font-mono text-[12px] text-ink">
          {code}
          <button type="button" onClick={() => toggle(code)} className="rounded p-0.5 text-muted hover:bg-line hover:text-ink" aria-label={`Remove ${code}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button id="reference_codes" type="button" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] font-medium text-accent hover:bg-accent-soft">
            <Plus className="size-3.5" /> {value.length ? 'Add' : 'Add reference'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[22rem] p-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search codes or titles" className="h-9" aria-label="Search references" />
          <div className="mt-2 max-h-72 overflow-y-auto">
            {groups.map((g) => (
              <div key={g} className="mb-1">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{docTitles[g] ?? g}</p>
                {filtered
                  .filter((r) => r.document_id === g)
                  .map((r) => {
                    const selected = value.includes(r.code);
                    return (
                      <button key={r.code} type="button" onClick={() => toggle(r.code)} className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-subtle" aria-pressed={selected}>
                        <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border', selected ? 'border-ink bg-ink text-white' : 'border-line-strong')}>{selected && <Check className="size-3" />}</span>
                        <span className="min-w-0">
                          <span className="block font-mono text-[12px] font-semibold text-ink">{r.code}</span>
                          <span className="block text-[13px] text-ink-2">{r.title}</span>
                        </span>
                      </button>
                    );
                  })}
              </div>
            ))}
            {!filtered.length && <p className="px-2 py-3 text-sm text-muted">No matching references.</p>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const NEW_FINDING_DRAFT = 'finding-new';

/**
 * Log or edit a finding. The form starts blank (only the location the candidate clicked is filled in); only the
 * record and the finding type are needed to save.
 */
export function FindingForm({
  open,
  onClose,
  mode,
  preset,
  finding,
  restoreDraft,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  preset?: FindingPreset | null;
  finding?: FindingDTO;
  restoreDraft?: boolean;
}) {
  const { attemptId, refresh } = usePlayer();
  const toast = useToast();
  const docs = useDocuments(attemptId);
  const refs = useReferences(attemptId);
  const draft = useDraft<FindingFormValues>(NEW_FINDING_DRAFT);
  const initial = useMemo(() => {
    if (mode === 'edit' && finding) return fromFinding(finding);
    if (restoreDraft) return { ...EMPTY, ...draft.read() };
    return fromPreset(preset ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const form = useForm<FindingFormValues>({ resolver: zodResolver(schema), defaultValues: initial });
  const { errors } = form.formState;
  const [targetType, crfField, documentId] = useWatch({ control: form.control, name: ['target_type', 'crf_field', 'document_id'] });

  // Keep an unsent new finding in autosaved progress so a refresh does not lose it.
  useEffect(() => {
    if (mode !== 'create') return;
    const sub = form.watch((v) => draft.save(v as FindingFormValues));
    return () => sub.unsubscribe();
  }, [form, mode, draft]);

  // Header fields are not visit-specific.
  useEffect(() => {
    if (isHeaderField(crfField)) form.setValue('visit', 'NA');
  }, [crfField, form]);

  const save = useMutation({
    mutationFn: (v: FindingFormValues) => {
      const payload = toPayload(v);
      if (mode === 'edit' && finding) {
        const { target: _t, ...changes } = payload;
        return http.patch<FindingDTO>(`${base(attemptId)}/t1/findings/${finding.id}`, { version: finding.version, ...changes });
      }
      return http.post<FindingDTO>(`${base(attemptId)}/t1/findings`, payload);
    },
    onSuccess: async (f) => {
      if (mode === 'create') draft.clear();
      await refresh();
      toast.success(mode === 'edit' ? `${f.id} updated` : `${f.id} logged`);
      onClose();
    },
  });

  const cancel = () => {
    if (mode === 'create') draft.clear();
    onClose();
  };

  const docList = docs.data ?? [];
  const sections = docList.find((d) => d.id === documentId)?.sections ?? [];
  const docTitles = Object.fromEntries(docList.map((d) => [d.id, d.short_title]));
  const header = mode === 'edit' && finding ? `Edit ${finding.id}` : 'Log a finding';
  const fixedTarget = mode === 'edit' && finding ? targetLabel(finding.target, docList) : null;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && cancel()}
      title={header}
      description={fixedTarget ?? 'Record what you found on a participant record or a study document.'}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={cancel}>
            Cancel
          </Button>
          <Button type="submit" form="finding-form" loading={save.isPending}>
            {mode === 'edit' ? 'Save changes' : 'Save finding'}
          </Button>
        </>
      }
    >
      <form id="finding-form" className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}

        {mode === 'create' && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-[13px] font-semibold text-ink">
              Applies to<span className="ml-0.5 text-danger" aria-hidden>*</span>
            </legend>
            <div className="inline-flex w-fit rounded-lg border border-line-strong bg-subtle p-0.5">
              {(['participant', 'document'] as const).map((t) => (
                <label key={t} className={cn('cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium', targetType === t ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink')}>
                  <input type="radio" value={t} className="sr-only" {...form.register('target_type')} />
                  {t === 'participant' ? 'Participant record' : 'Study document'}
                </label>
              ))}
            </div>
            {targetType === 'participant' ? (
              <Field label="Participant" htmlFor="participant_id" error={errors.participant_id?.message}>
                <Select id="participant_id" aria-invalid={!!errors.participant_id} {...form.register('participant_id')}>
                  <option value="">Choose a participant</option>
                  {PARTICIPANT_IDS.map((p, i) => (
                    <option key={p} value={p}>
                      {i + 1}. {p}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Document" htmlFor="document_id" error={errors.document_id?.message}>
                  <Select id="document_id" aria-invalid={!!errors.document_id} {...form.register('document_id', { onChange: () => form.setValue('section_id', '') })}>
                    <option value="">Choose a document</option>
                    {DOCUMENT_IDS.map((d) => (
                      <option key={d} value={d}>
                        {docTitles[d] ?? d}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Section" htmlFor="section_id" error={errors.section_id?.message}>
                  <Select id="section_id" aria-invalid={!!errors.section_id} disabled={!documentId} {...form.register('section_id')}>
                    <option value="">Choose a section</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.number ? `${s.number} ${s.title}` : s.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
          </fieldset>
        )}

        {targetType === 'participant' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CRF field" htmlFor="crf_field">
              <Select id="crf_field" {...form.register('crf_field')}>
                <option value="">Not specified</option>
                <optgroup label="Header">
                  {CRF_HEADER_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Visit data">
                  {CRF_VISIT_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Field>
            <Field label="Visit" htmlFor="visit" error={errors.visit?.message}>
              <Select id="visit" aria-invalid={!!errors.visit} disabled={isHeaderField(crfField)} {...form.register('visit')}>
                <option value="">Not specified</option>
                {(['W0', 'W4', 'W8', 'W12', 'NA'] as const).map((v) => (
                  <option key={v} value={v}>
                    {VISIT_LABELS[v]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Field label="Finding type" htmlFor="finding_type" required error={errors.finding_type?.message}>
            <Select id="finding_type" aria-invalid={!!errors.finding_type} {...form.register('finding_type')}>
              <option value="">Choose a type</option>
              {FINDING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Severity" htmlFor="severity">
            <Select id="severity" {...form.register('severity')}>
              <option value="">Not set</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Reference" htmlFor="reference_codes" hint="Protocol, dictionary or SOP clauses that apply." error={errors.reference_codes?.message}>
          <Controller control={form.control} name="reference_codes" render={({ field }) => <ReferencePicker value={field.value} onChange={field.onChange} references={refs.data ?? []} docTitles={docTitles} />} />
        </Field>

        <Field label="Observed issue" htmlFor="observed_issue">
          <Textarea id="observed_issue" rows={4} {...form.register('observed_issue')} />
        </Field>
        <Field label="Recommended action" htmlFor="action">
          <Textarea id="action" rows={3} {...form.register('action')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="status">
            <Select id="status" {...form.register('status')}>
              <option value="">Not set</option>
              {FINDING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Query to site" htmlFor="query_text" hint="The wording you would send to the site, if a query is needed.">
          <Textarea id="query_text" rows={4} {...form.register('query_text')} />
        </Field>
        {mode === 'edit' && finding && <p className="text-xs text-muted">To log this against a different record, withdraw it and log a new finding.</p>}
      </form>
    </Sheet>
  );
}
