import { Router } from 'express';
import { and, desc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { canonicalJson, packageDigest, PARAMETER_META, runRegressionSuite, sha256Hex, type Parameters, type PhraseLists, type RegressionReport } from '#engine';
import type { AppDeps } from '../context';
import { answerKeys, regressionRuns, scoringPackages, users } from '../db/schema';
import { audit } from '../lib/audit';
import { conflict, notFound } from '../lib/errors';
import { parseBody, parseParams, parseQuery } from '../lib/http';
import { clearPackageCache, loadScoringPackage } from '../services/scoringPackages';

const idParam = z.object({ id: z.string().min(1).max(80) });

/** Parameters with a fixed set of values (everything else is numeric). Sent to the admin editor as metadata. */
const ENUM_PARAMETERS = { TOKEN_SCOPE: ['issue_text', 'issue_text_and_location'] } as const;

const parametersSchema = z
  .object({
    BAND_MEETS: z.number().min(0).max(100),
    BAND_FLOOR: z.number().min(0).max(100),
    DISC_MEETS_MIN: z.number().int().min(0).max(4),
    DISC_R4: z.number().min(0).max(100),
    DISC_R3: z.number().min(0).max(100),
    DISC_R2: z.number().min(0).max(100),
    DISC_R1: z.number().min(0).max(100),
    SAFE_FAST: z.number().positive().max(240),
    SAFE_LATE: z.number().positive().max(480),
    W2_CLOCK: z.number().int().positive().max(240),
    ESC_FAST: z.number().positive().max(240),
    ESC_LATE: z.number().positive().max(480),
    QUERY_LEAD_CAP: z.number().int().min(0).max(4),
    WAIV_NOREC_CAP: z.number().int().min(0).max(4),
    REC_NOSTATUS_CAP: z.number().int().min(0).max(4),
    REC_FALSE_CAP: z.number().int().min(0).max(4),
    TOKEN_SCOPE: z.enum(ENUM_PARAMETERS.TOKEN_SCOPE),
  })
  .partial();

const phrase = z.string().trim().min(1).max(120);
const phraseListsSchema = z
  .object({
    leading_phrases: z.array(phrase).max(300),
    correction_directives: z.array(phrase).max(300),
    gr_delay_agreement: z.array(phrase).max(300),
    gr_waiver_acceptance: z.array(phrase).max(300),
    negation_cues: z.array(phrase).max(300),
    attribution_cues: z.array(phrase).max(300),
    safe_symptom_tokens: z.array(phrase).max(300),
    safe_location_tokens: z.array(phrase).max(300),
    esc_sae_tokens: z.array(phrase).max(300),
    esc_waiver_tokens: z.array(phrase).max(300),
    esc_decision_tokens: z.array(phrase).max(300),
    waiver_mention_tokens: z.array(phrase).max(300),
  })
  .partial();

type ValueDiff = { key: string; added: string[]; removed: string[] } | { key: string; from: unknown; to: unknown };

function diffValues(a: Record<string, unknown>, b: Record<string, unknown>): ValueDiff[] {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return keys.flatMap((k): ValueDiff[] => {
    const x = a[k];
    const y = b[k];
    if (canonicalJson(x) === canonicalJson(y)) return [];
    if (Array.isArray(x) && Array.isArray(y)) {
      const added = (y as string[]).filter((v) => !(x as string[]).includes(v));
      const removed = (x as string[]).filter((v) => !(y as string[]).includes(v));
      return [{ key: k, added, removed }];
    }
    return [{ key: k, from: x ?? null, to: y ?? null }];
  });
}

function summarise(report: RegressionReport) {
  return { passed: report.passed, total: report.total, failed: report.failed };
}

/** Admin: scoring packages (immutable once published), regression runs, and the audited answer-key view. */
export function adminPackagesRouter(deps: AppDeps): Router {
  const r = Router();

  async function row(id: string) {
    const [p] = await deps.db.select().from(scoringPackages).where(eq(scoringPackages.id, id));
    if (!p) throw notFound('Scoring package not found.');
    return p;
  }

  async function lastRun(packageId: string) {
    const [run] = await deps.db.select().from(regressionRuns).where(eq(regressionRuns.scoringPackageId, packageId)).orderBy(desc(regressionRuns.createdAt)).limit(1);
    return run ?? null;
  }

  r.get('/packages', async (_req, res) => {
    const rows = await deps.db.select().from(scoringPackages).orderBy(desc(scoringPackages.createdAt));
    const out = await Promise.all(
      rows.map(async (p) => {
        const run = await lastRun(p.id);
        return {
          id: p.id,
          label: p.label,
          status: p.status,
          engine_version: p.engineVersion,
          sha256: p.sha256,
          sme_status: p.smeStatus,
          notes: p.notes,
          created_at: p.createdAt,
          published_at: p.publishedAt,
          regression: run ? { id: run.id, ...summarise(run.summary as RegressionReport), at: run.createdAt } : null,
        };
      }),
    );
    res.json({ packages: out });
  });

  r.get('/packages/:id', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const p = await row(id);
    const run = await lastRun(p.id);
    res.json({
      id: p.id,
      label: p.label,
      status: p.status,
      engine_version: p.engineVersion,
      sha256: p.sha256,
      sme_status: p.smeStatus,
      notes: p.notes,
      created_at: p.createdAt,
      published_at: p.publishedAt,
      rubric: p.rubric,
      parameters: p.parameters,
      parameter_meta: Object.fromEntries(
        Object.keys(p.parameters as Record<string, unknown>).map((k) => [k, { meaning: PARAMETER_META[k]?.meaning ?? '', options: (ENUM_PARAMETERS as Record<string, readonly string[]>)[k] ?? null }]),
      ),
      phrase_lists: p.phraseLists,
      identifiers: p.identifiers,
      regression: run ? { id: run.id, at: run.createdAt, ...(run.summary as RegressionReport) } : null,
    });
  });

  /** The confidential answer key. Every view is audited. */
  r.get('/packages/:id/key', async (req, res) => {
    const { id } = parseParams(idParam, req);
    await row(id);
    const [key] = await deps.db.select().from(answerKeys).where(eq(answerKeys.scoringPackageId, id));
    if (!key) throw notFound('This package has no answer key.');
    await audit(deps.db, req, { action: 'answer_key.viewed', targetType: 'scoring_package', targetId: id });
    res.json({ sha256: key.sha256, key: key.key });
  });

  r.get('/packages/:id/diff', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const { against } = parseQuery(z.object({ against: z.string().min(1).max(80) }), req);
    const [a, b] = await Promise.all([row(against), row(id)]);
    res.json({
      from: a.id,
      to: b.id,
      parameters: diffValues(a.parameters as Record<string, unknown>, b.parameters as Record<string, unknown>),
      phrase_lists: diffValues(a.phraseLists as Record<string, unknown>, b.phraseLists as Record<string, unknown>),
      rubric_changed: canonicalJson(a.rubric) !== canonicalJson(b.rubric),
    });
  });

  /** New draft from an existing package with changed parameters or phrase lists (answer key and rubric are copied). */
  r.post('/packages', async (req, res) => {
    const body = parseBody(
      z.object({
        from: z.string().min(1).max(80),
        id: z.string().trim().regex(/^[a-z0-9][a-z0-9.\-]{2,60}$/, 'Use lower-case letters, digits, dots and dashes.'),
        label: z.string().trim().min(3).max(120),
        notes: z.string().trim().max(2000).default(''),
        parameters: parametersSchema.default({}),
        phrase_lists: phraseListsSchema.default({}),
      }),
      req,
    );
    const source = await loadScoringPackage(deps.db, body.from);
    const [taken] = await deps.db.select({ id: scoringPackages.id }).from(scoringPackages).where(eq(scoringPackages.id, body.id));
    if (taken) throw conflict('package_exists', 'A package with this id already exists.');
    const [src] = await deps.db.select().from(scoringPackages).where(eq(scoringPackages.id, body.from));
    const pkg = {
      ...source,
      id: body.id,
      label: body.label,
      parameters: { ...source.parameters, ...body.parameters } as Parameters,
      phrase_lists: { ...source.phrase_lists, ...body.phrase_lists } as PhraseLists,
    };
    await deps.db.transaction(async (tx) => {
      await tx.insert(scoringPackages).values({
        id: pkg.id,
        simulationVersionId: src.simulationVersionId,
        label: pkg.label,
        status: 'draft',
        engineVersion: pkg.engine_version,
        rubric: pkg.rubric,
        parameters: pkg.parameters,
        phraseLists: pkg.phrase_lists,
        identifiers: pkg.identifiers,
        sha256: packageDigest(pkg),
        notes: body.notes,
        createdBy: req.auth!.user.id,
      });
      await tx.insert(answerKeys).values({ scoringPackageId: pkg.id, key: pkg.answer_key, sha256: sha256Hex(canonicalJson(pkg.answer_key)) });
    });
    await audit(deps.db, req, { action: 'package.drafted', targetType: 'scoring_package', targetId: pkg.id, details: { from: body.from } });
    res.status(201).json({ id: pkg.id });
  });

  r.patch('/packages/:id', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const body = parseBody(z.object({ label: z.string().trim().min(3).max(120).optional(), notes: z.string().trim().max(2000).optional(), parameters: parametersSchema.optional(), phrase_lists: phraseListsSchema.optional() }), req);
    const p = await row(id);
    if (p.status !== 'draft') throw conflict('package_immutable', 'Published packages cannot be changed. Create a new draft.');
    const current = await loadScoringPackage(deps.db, id);
    const next = {
      ...current,
      label: body.label ?? current.label,
      parameters: { ...current.parameters, ...(body.parameters ?? {}) } as Parameters,
      phrase_lists: { ...current.phrase_lists, ...(body.phrase_lists ?? {}) } as PhraseLists,
    };
    await deps.db
      .update(scoringPackages)
      .set({ label: next.label, notes: body.notes ?? p.notes, parameters: next.parameters, phraseLists: next.phrase_lists, sha256: packageDigest(next), regressionRunId: null })
      .where(eq(scoringPackages.id, id));
    await audit(deps.db, req, { action: 'package.edited', targetType: 'scoring_package', targetId: id });
    res.json({ ok: true });
  });

  r.post('/packages/:id/regression', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const p = await row(id);
    const pkg = await loadScoringPackage(deps.db, id);
    const report = runRegressionSuite(pkg);
    const [run] = await deps.db.insert(regressionRuns).values({ scoringPackageId: id, passed: report.passed, summary: report, createdBy: req.auth!.user.id }).returning();
    if (p.status === 'draft') await deps.db.update(scoringPackages).set({ regressionRunId: run.id }).where(eq(scoringPackages.id, id));
    await audit(deps.db, req, { action: 'package.regression_run', targetType: 'scoring_package', targetId: id, details: summarise(report) });
    res.status(201).json({ id: run.id, ...report });
  });

  /** Publishing needs a passing regression run on the package as it is now; the previous active package is retired. */
  r.post('/packages/:id/publish', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const p = await row(id);
    if (p.status !== 'draft') throw conflict('not_draft', 'Only draft packages can be published.');
    if (!p.regressionRunId) throw conflict('regression_required', 'Run the regression suite on this draft before publishing.');
    const [run] = await deps.db.select().from(regressionRuns).where(eq(regressionRuns.id, p.regressionRunId));
    if (!run?.passed) throw conflict('regression_failed', 'The latest regression run did not pass. Fix the package and run it again.');
    const now = deps.clock.now();
    await deps.db.transaction(async (tx) => {
      await tx.update(scoringPackages).set({ status: 'retired' }).where(and(eq(scoringPackages.simulationVersionId, p.simulationVersionId), eq(scoringPackages.status, 'published'), ne(scoringPackages.id, id)));
      await tx.update(scoringPackages).set({ status: 'published', publishedAt: now }).where(eq(scoringPackages.id, id));
    });
    clearPackageCache();
    await audit(deps.db, req, { action: 'package.published', targetType: 'scoring_package', targetId: id });
    res.json({ ok: true });
  });

  r.get('/regression', async (_req, res) => {
    const rows = await deps.db.select({ run: regressionRuns, by: users.name }).from(regressionRuns).leftJoin(users, eq(users.id, regressionRuns.createdBy)).orderBy(desc(regressionRuns.createdAt)).limit(100);
    res.json({ runs: rows.map(({ run, by }) => ({ id: run.id, package_id: run.scoringPackageId, at: run.createdAt, by: by ?? 'System', ...summarise(run.summary as RegressionReport) })) });
  });

  r.get('/regression/:id', async (req, res) => {
    const { id } = parseParams(z.object({ id: z.uuid() }), req);
    const [run] = await deps.db.select().from(regressionRuns).where(eq(regressionRuns.id, id));
    if (!run) throw notFound('Regression run not found.');
    res.json({ id: run.id, package_id: run.scoringPackageId, at: run.createdAt, ...(run.summary as RegressionReport) });
  });

  /** Records SME sign-off on a package's drafted rules (metadata only: it does not change scoring). */
  r.post('/packages/:id/sme', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const body = parseBody(z.object({ status: z.enum(['Draft; SME confirm', 'SME confirmed']), note: z.string().trim().min(3, 'Add a note (who confirmed, and when).').max(1000) }), req);
    await row(id);
    await deps.db.update(scoringPackages).set({ smeStatus: body.status }).where(eq(scoringPackages.id, id));
    await audit(deps.db, req, { action: 'package.sme_status', targetType: 'scoring_package', targetId: id, details: body });
    res.json({ ok: true });
  });

  return r;
}
