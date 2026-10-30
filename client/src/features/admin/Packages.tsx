import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, FlaskConical, Layers, Plus, Rocket, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { errorMessage, http } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Dialog, EmptyState, Field, Input, PageHeader, PageLoader, Select, Table, Tabs, TabsContent, TabsList, TabsTrigger, TD, TH, THead, TR, Textarea, useToast } from '@/ui';
import { adminKeys, usePackage, usePackages, type PackageDetail, type RegressionCase } from './api';

const STATUS_TONE = { draft: 'warning', published: 'success', retired: 'neutral' } as const;

function NewDraftDialog({ open, onOpenChange, from }: { open: boolean; onOpenChange: (o: boolean) => void; from: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const create = useMutation({
    mutationFn: () => http.post<{ id: string }>('/admin/packages', { from, id: id.trim(), label: label.trim(), notes }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: adminKeys.packages });
      onOpenChange(false);
      navigate(`/admin/packages/${r.id}`);
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New draft package"
      description={`A copy of ${from}. Change parameters or phrase lists on the draft, run the regression suite, then publish.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} loading={create.isPending} disabled={id.trim().length < 3 || label.trim().length < 3}>
            Create draft
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {create.error && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
        <Field label="Package id" htmlFor="pkg-id" hint="Lower-case letters, digits, dots and dashes, e.g. v1.1-sme-draft-2.">
          <Input id="pkg-id" value={id} onChange={(e) => setId(e.target.value)} />
        </Field>
        <Field label="Label" htmlFor="pkg-label">
          <Input id="pkg-label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Notes" htmlFor="pkg-notes" optional>
          <Textarea id="pkg-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

export function Packages() {
  const list = usePackages();
  const navigate = useNavigate();
  const [draftOpen, setDraftOpen] = useState(false);
  const active = list.data?.find((p) => p.status === 'published');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Lokus admin"
        title="Scoring packages"
        description="The rubric, parameters, phrase lists and answer key that score attempts. Published packages are immutable; attempts stay pinned to the package they started with."
        actions={
          active && (
            <Button onClick={() => setDraftOpen(true)}>
              <Plus /> New draft
            </Button>
          )
        }
      />
      <Card>
        {list.isLoading ? (
          <PageLoader />
        ) : list.error ? (
          <CardBody>
            <Alert tone="danger">{errorMessage(list.error)}</Alert>
          </CardBody>
        ) : !list.data?.length ? (
          <EmptyState icon={<Layers />} title="No packages" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Package</TH>
                <TH>Status</TH>
                <TH>Regression</TH>
                <TH>SME</TH>
                <TH>Published</TH>
              </tr>
            </THead>
            <tbody>
              {list.data.map((p) => (
                <TR key={p.id} interactive onClick={() => navigate(`/admin/packages/${p.id}`)}>
                  <TD>
                    <span className="block font-medium text-ink">{p.label}</span>
                    <span className="block font-mono text-[11px] text-faint">
                      {p.id} · engine {p.engine_version}
                    </span>
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                  </TD>
                  <TD>{p.regression ? <Badge tone={p.regression.passed ? 'success' : 'danger'}>{p.regression.passed ? `Passed ${p.regression.total}/${p.regression.total}` : `${p.regression.failed} failed`}</Badge> : <span className="text-muted">Not run</span>}</TD>
                  <TD>{p.sme_status}</TD>
                  <TD className="whitespace-nowrap">{formatDateTime(p.published_at)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {active && <NewDraftDialog open={draftOpen} onOpenChange={setDraftOpen} from={active.id} />}
    </div>
  );
}

function ParametersEditor({ pkg }: { pkg: PackageDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(pkg.parameters).map(([k, v]) => [k, String(v)])));
  const editable = pkg.status === 'draft';
  const changed = Object.entries(values).filter(([k, v]) => String(pkg.parameters[k]) !== v);
  const options = (k: string) => pkg.parameter_meta[k]?.options ?? null;
  const save = useMutation({
    mutationFn: () => http.patch(`/admin/packages/${pkg.id}`, { parameters: Object.fromEntries(changed.map(([k, v]) => [k, options(k) ? v : Number(v)])) }),
    onSuccess: () => {
      toast.success('Parameters saved', 'Run the regression suite again before publishing.');
      void qc.invalidateQueries({ queryKey: adminKeys.pkg(pkg.id) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card>
      <CardHeader title="Parameters" description={editable ? 'Editable while the package is a draft.' : 'Published packages cannot change.'} />
      <CardBody>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(values).map(([k, v]) => (
            <Field key={k} label={<span className="font-mono text-xs">{k}</span>} htmlFor={`p-${k}`} hint={pkg.parameter_meta[k]?.meaning || undefined}>
              {options(k) ? (
                <Select id={`p-${k}`} value={v} disabled={!editable} onChange={(e) => setValues((s) => ({ ...s, [k]: e.target.value }))}>
                  {options(k)!.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input id={`p-${k}`} type="number" step="any" value={v} disabled={!editable} onChange={(e) => setValues((s) => ({ ...s, [k]: e.target.value }))} className="tabular" />
              )}
            </Field>
          ))}
        </div>
        {editable && (
          <div className="mt-5 flex items-center justify-end gap-3">
            <p className="text-xs text-muted">{changed.length ? `${changed.length} changed` : 'No changes'}</p>
            <Button disabled={!changed.length} loading={save.isPending} onClick={() => save.mutate()}>
              Save parameters
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function RegressionTable({ cases }: { cases: RegressionCase[] }) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>Persona</TH>
          <TH>Result</TH>
          <TH numeric>Workday 1</TH>
          <TH numeric>Workday 2</TH>
          <TH>Outcome</TH>
          <TH>Mismatches</TH>
        </tr>
      </THead>
      <tbody>
        {cases.map((c) => (
          <TR key={c.persona_id}>
            <TD>
              <span className="block font-medium text-ink">{c.name}</span>
              <span className="block font-mono text-[11px] text-faint">
                {c.persona_id}
                {c.workbook_row && ` · workbook ${c.workbook_row}`}
              </span>
            </TD>
            <TD>{c.passed ? <Badge tone="success">Pass</Badge> : <Badge tone="danger">Fail</Badge>}</TD>
            <TD numeric>{String(c.actual.t1)}</TD>
            <TD numeric>{String(c.actual.t2)}</TD>
            <TD>{c.actual.outcome ?? 'Pending'}</TD>
            <TD className="max-w-md text-[12px] text-danger">{c.mismatches.join('; ')}</TD>
          </TR>
        ))}
      </tbody>
    </Table>
  );
}

function AnswerKey({ id }: { id: string }) {
  const [reveal, setReveal] = useState(false);
  const key = useQuery({ queryKey: ['admin', 'package', id, 'key'], queryFn: () => http.get<{ sha256: string; key: { participant_id: string; class: string; category: string; crf_visit: string; crf_field: string; value_as_shown: string; expected_reference: string | null; accepted_types: string[]; points: number; why_correct: string }[] }>(`/admin/packages/${id}/key`), enabled: reveal, staleTime: 0, gcTime: 0 });
  if (!reveal)
    return (
      <Card>
        <CardBody className="flex flex-col items-start gap-3">
          <p className="font-semibold text-ink">Confidential answer key</p>
          <p className="text-sm text-muted">Viewing the key is recorded in the audit log with your name and the time.</p>
          <Button variant="secondary" onClick={() => setReveal(true)}>
            <Eye /> Reveal answer key
          </Button>
        </CardBody>
      </Card>
    );
  if (key.isLoading) return <PageLoader />;
  if (key.error || !key.data) return <Alert tone="danger">{errorMessage(key.error)}</Alert>;
  return (
    <Card>
      <CardHeader title="Answer key" description={`sha256 ${key.data.sha256.slice(0, 16)}… · this view was audited`} />
      <Table>
        <THead>
          <tr>
            <TH>Participant</TH>
            <TH>Class</TH>
            <TH>Where</TH>
            <TH>Value as shown</TH>
            <TH>Accepted types</TH>
            <TH numeric>Points</TH>
            <TH>Why</TH>
          </tr>
        </THead>
        <tbody>
          {key.data.key.map((k) => (
            <TR key={k.participant_id}>
              <TD className="font-mono text-[12px]">{k.participant_id}</TD>
              <TD>
                <Badge tone={k.class === 'CLEAN' ? 'neutral' : 'warning'}>{k.class}</Badge>
              </TD>
              <TD>
                {k.crf_visit} · {k.crf_field}
              </TD>
              <TD className="text-[13px]">{k.value_as_shown}</TD>
              <TD className="text-[13px]">{k.accepted_types.join('; ') || '—'}</TD>
              <TD numeric>{k.points}</TD>
              <TD className="max-w-md text-[13px]">{k.why_correct}</TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

export function PackageDetailPage() {
  const { packageId = '' } = useParams();
  const pkg = usePackage(packageId);
  const qc = useQueryClient();
  const toast = useToast();
  const [smeOpen, setSmeOpen] = useState(false);
  const [smeNote, setSmeNote] = useState('');
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: adminKeys.pkg(packageId) });
    void qc.invalidateQueries({ queryKey: adminKeys.packages });
  };
  const run = useMutation({
    mutationFn: () => http.post<{ passed: boolean; failed: number; total: number }>(`/admin/packages/${packageId}/regression`),
    onSuccess: (r) => {
      if (r.passed) toast.success(`Regression passed (${r.total}/${r.total})`);
      else toast.error(`Regression failed: ${r.failed} of ${r.total}`);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const publish = useMutation({
    mutationFn: () => http.post(`/admin/packages/${packageId}/publish`),
    onSuccess: () => {
      toast.success('Package published', 'New attempts now use it; existing attempts keep their package.');
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const sme = useMutation({
    mutationFn: () => http.post(`/admin/packages/${packageId}/sme`, { status: 'SME confirmed', note: smeNote }),
    onSuccess: () => {
      toast.success('SME sign-off recorded');
      setSmeOpen(false);
      refresh();
    },
  });
  if (pkg.isLoading) return <PageLoader />;
  if (pkg.error || !pkg.data) return <Alert tone="danger">{errorMessage(pkg.error)}</Alert>;
  const p = pkg.data;
  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/packages" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Scoring packages
      </Link>
      <PageHeader
        eyebrow={<span className="font-mono normal-case tracking-normal">{p.id}</span>}
        title={p.label}
        description={`Engine ${p.engine_version} · sha256 ${p.sha256.slice(0, 12)}… · ${p.sme_status}`}
        actions={
          <>
            <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
            <Button variant="secondary" loading={run.isPending} onClick={() => run.mutate()}>
              <FlaskConical /> Run regression
            </Button>
            {p.status === 'draft' && (
              <Button loading={publish.isPending} disabled={!p.regression?.passed} onClick={() => publish.mutate()}>
                <Rocket /> Publish
              </Button>
            )}
            {p.sme_status !== 'SME confirmed' && (
              <Button variant="secondary" onClick={() => setSmeOpen(true)}>
                <ShieldCheck /> Record SME sign-off
              </Button>
            )}
          </>
        }
      />
      {p.notes && <p className="text-sm text-ink-2">{p.notes}</p>}
      <Tabs defaultValue="regression">
        <TabsList>
          <TabsTrigger value="regression">Regression</TabsTrigger>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="phrases">Phrase lists</TabsTrigger>
          <TabsTrigger value="rubric">Rubric</TabsTrigger>
          <TabsTrigger value="key">Answer key</TabsTrigger>
        </TabsList>
        <TabsContent value="regression" className="mt-5 outline-none">
          <Card>
            <CardHeader title="Regression suite" description={p.regression ? `Last run ${formatDateTime(p.regression.at)} · ${p.regression.passed ? 'passed' : `${p.regression.failed} failed`}` : 'Not run on this package yet.'} />
            {p.regression ? <RegressionTable cases={p.regression.cases} /> : <EmptyState title="No run yet">Run the suite to check every workbook persona and fixture.</EmptyState>}
          </Card>
        </TabsContent>
        <TabsContent value="parameters" className="mt-5 outline-none">
          <ParametersEditor key={p.sha256} pkg={p} />
        </TabsContent>
        <TabsContent value="phrases" className="mt-5 grid gap-4 outline-none md:grid-cols-2">
          {Object.entries(p.phrase_lists).map(([k, list]) => (
            <Card key={k}>
              <CardHeader title={<span className="font-mono text-sm">{k}</span>} description={`${list.length} entries`} />
              <CardBody className="flex flex-wrap gap-1.5">
                {list.map((x) => (
                  <span key={x} className="rounded border border-line bg-subtle px-1.5 py-0.5 text-[12px] text-ink-2">
                    {x}
                  </span>
                ))}
              </CardBody>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="rubric" className="mt-5 flex flex-col gap-4 outline-none">
          {p.rubric.criteria.map((c) => (
            <Card key={c.id}>
              <CardHeader title={c.name} description={`${c.id} · ${c.task} · weight ${c.weight} · ${c.method} · ${c.competency}`} />
              <CardBody className="flex flex-col gap-2 text-sm">
                <p className="text-ink-2">{c.what_to_observe}</p>
                <ol className="flex flex-col gap-1">
                  {(['4', '3', '2', '1', '0'] as const).map((k) => (
                    <li key={k} className="flex gap-2">
                      <span className="w-4 shrink-0 font-semibold text-ink tabular">{k}</span>
                      <span className="text-ink-2">{c.anchors[k]}</span>
                    </li>
                  ))}
                </ol>
                {c.notes && <p className="text-xs text-muted">{c.notes}</p>}
              </CardBody>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="key" className="mt-5 outline-none">
          <AnswerKey id={p.id} />
        </TabsContent>
      </Tabs>
      <Dialog
        open={smeOpen}
        onOpenChange={setSmeOpen}
        title="Record SME sign-off"
        description="Confirms that a subject-matter expert reviewed this package's drafted rules and phrase lists. It does not change scoring."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSmeOpen(false)}>
              Cancel
            </Button>
            <Button disabled={smeNote.trim().length < 3} loading={sme.isPending} onClick={() => sme.mutate()}>
              Record sign-off
            </Button>
          </>
        }
      >
        <Field label="Note" htmlFor="sme-note" hint="Who confirmed, when, and any conditions.">
          <Textarea id="sme-note" rows={3} value={smeNote} onChange={(e) => setSmeNote(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
