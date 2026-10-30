import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { and, eq } from 'drizzle-orm';
import { buildEvidence, ev } from '#engine';
import { DOCUMENT_ORDER, DOCUMENTS, REFERENCE_CODES, getSection, tableOfContents } from '#content';
import { PARTICIPANT_IDS, progressSchema, reflectionSchema, telemetrySchema, type DocumentSectionDTO, type DocumentSummaryDTO } from '@lokus/shared';
import type { AppDeps } from '../../context';
import { attemptProgress, attempts } from '../../db/schema';
import { conflict, notFound } from '../../lib/errors';
import { parseBody } from '../../lib/http';
import { appendEvents, listEvents, toEngineEvents, withAttemptLock } from '../../services/eventStore';
import { recomputeResult } from '../../services/scoring';
import { loadScoringPackage } from '../../services/scoringPackages';
import { actor, assertPhase, loadOwnAttempt, phaseOf, requirePhase, withEvidence } from './access';
import { buildState, w2Clock } from './derive';
import { workday1Router } from './workday1';
import { workday2Router } from './workday2';

/**
 * The simulation player API (/api/attempts/:attemptId/*). There is no generic "post an event" endpoint: content
 * reads record server-observed events and every action is a validated command that the server turns into events.
 * Nothing here returns scores, caps, ratings or phrase matches.
 */
export function playerRouter(deps: AppDeps): Router {
  const r = Router({ mergeParams: true });
  r.use(rateLimit({ windowMs: 5 * 60 * 1000, limit: deps.config.env === 'test' ? 100_000 : 1500, keyGenerator: (req) => req.auth?.sessionId ?? ipKeyGenerator(req.ip ?? ''), standardHeaders: 'draft-7', legacyHeaders: false }));
  r.use(loadOwnAttempt(deps));

  r.get('/state', async (req, res) => {
    const ctx = req.attemptCtx!;
    const [progress] = await deps.db.select().from(attemptProgress).where(eq(attemptProgress.attemptId, ctx.attempt.id));
    const pkg = await loadScoringPackage(deps.db, ctx.attempt.scoringPackageId);
    const rows = await listEvents(deps.db, ctx.attempt.id);
    res.json(
      buildState({
        attempt: ctx.attempt,
        simulationTitle: ctx.simulationTitle,
        orgName: ctx.orgName,
        candidate: { name: req.auth!.user.name, email: req.auth!.user.email },
        progress: { version: progress?.version ?? 0, state: (progress?.state as Record<string, unknown>) ?? {} },
        rows,
        evidence: buildEvidence(toEngineEvents(rows), pkg),
        pkg,
        now: deps.clock.now(),
      }),
    );
  });

  /** Autosaved UI state (current screen, unsent drafts). Not evidence; optimistic concurrency via `version`. */
  r.put('/progress', async (req, res) => {
    const body = parseBody(progressSchema, req);
    const size = JSON.stringify(body.state).length;
    if (size > 100_000) throw conflict('progress_too_large', 'Saved progress is too large.');
    const id = req.attemptCtx!.attempt.id;
    const [updated] = await deps.db
      .update(attemptProgress)
      .set({ state: body.state, version: body.version + 1, updatedAt: deps.clock.now() })
      .where(and(eq(attemptProgress.attemptId, id), eq(attemptProgress.version, body.version)))
      .returning({ version: attemptProgress.version });
    if (!updated) {
      const [cur] = await deps.db.select({ version: attemptProgress.version }).from(attemptProgress).where(eq(attemptProgress.attemptId, id));
      throw conflict('progress_conflict', 'Your progress was saved from another tab.', { version: cur?.version ?? 0 });
    }
    res.json({ version: updated.version });
  });

  r.get('/clock', async (req, res) => {
    const a = req.attemptCtx!.attempt;
    const pkg = await loadScoringPackage(deps.db, a.scoringPackageId);
    res.json({ server_time: deps.clock.now().toISOString(), w2: w2Clock(a, pkg, deps.clock.now()) });
  });

  // ---- Task lifecycle -------------------------------------------------------------------------------------------
  r.post('/tasks/T1/start', async (req, res) => {
    await withAttemptLock(deps.db, req.attemptCtx!.attempt.id, async (tx, attempt) => {
      if (phaseOf(attempt) === 'workday1') return;
      assertPhase(attempt, ['intro']);
      await appendEvents(tx, deps.clock, attempt, [ev.taskStarted('T1')], actor(req));
      const now = deps.clock.now();
      await tx.update(attempts).set({ status: 'w1_in_progress', startedAt: attempt.startedAt ?? now, updatedAt: now }).where(eq(attempts.id, attempt.id));
    });
    res.json({ ok: true });
  });

  r.post('/tasks/T1/submit', async (req, res) => {
    await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday1'], async (tx, attempt, { evidence }) => {
      const findings = [...evidence.t1.findings.values()].filter((f) => !f.withdrawn);
      const reviewed = new Set(findings.flatMap((f) => (f.target.type === 'participant' ? [f.target.participant_id] : [])));
      for (const [pid, nd] of evidence.t1.no_deviation) if (nd.recorded) reviewed.add(pid);
      const unreviewed = PARTICIPANT_IDS.filter((p) => !reviewed.has(p));
      if (unreviewed.length) throw conflict('review_incomplete', 'Record a finding or “No deviation” for every participant before submitting Workday 1.', { unreviewed });
      await appendEvents(tx, deps.clock, attempt, [ev.taskCompleted('T1', { findings: findings.length, escalations: evidence.t1.escalations.length })], actor(req));
      const now = deps.clock.now();
      await tx.update(attempts).set({ status: 'w1_submitted', t1SubmittedAt: now, updatedAt: now }).where(eq(attempts.id, attempt.id));
    });
    await recomputeResult(deps, req.attemptCtx!.attempt.id, 't1_submit');
    res.json({ ok: true });
  });

  r.post('/tasks/T2/start', async (req, res) => {
    await withAttemptLock(deps.db, req.attemptCtx!.attempt.id, async (tx, attempt) => {
      if (phaseOf(attempt) === 'workday2') return;
      assertPhase(attempt, ['between']);
      await appendEvents(tx, deps.clock, attempt, [ev.taskStarted('T2')], actor(req));
      await tx.update(attempts).set({ status: 'w2_in_progress', updatedAt: deps.clock.now() }).where(eq(attempts.id, attempt.id));
    });
    res.json({ ok: true });
  });

  r.post('/tasks/T2/submit', async (req, res) => {
    await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday2'], async (tx, attempt, { evidence }) => {
      if (!evidence.t2.decisions.sae || !evidence.t2.decisions.waiver) throw conflict('decisions_required', 'Record your decision on both sponsor requests before finishing Workday 2.');
      await appendEvents(tx, deps.clock, attempt, [ev.taskCompleted('T2', { reply_sent: evidence.t2.reply ? 1 : 0, messages: evidence.t2.escalations.length })], actor(req));
      const now = deps.clock.now();
      await tx.update(attempts).set({ status: 'submitted', t2SubmittedAt: now, updatedAt: now }).where(eq(attempts.id, attempt.id));
    });
    await recomputeResult(deps, req.attemptCtx!.attempt.id, 't2_submit');
    res.json({ ok: true });
  });

  // ---- Study documents (each section open is a server-observed event) --------------------------------------
  r.get('/documents', requirePhase('workday1', 'workday2'), (_req, res) => {
    const docs: DocumentSummaryDTO[] = DOCUMENT_ORDER.map((id) => {
      const toc = tableOfContents(DOCUMENTS[id]);
      return { id: toc.id, title: toc.title, short_title: toc.shortTitle, subtitle: toc.subtitle, version: toc.version, status: toc.status, owner: toc.owner, header: toc.header, footer: toc.footer, sections: toc.sections };
    });
    res.json({ documents: docs });
  });

  r.get('/documents/:documentId/sections/:sectionId', requirePhase('workday1', 'workday2'), async (req, res) => {
    const documentId = String(req.params.documentId);
    const sectionId = String(req.params.sectionId);
    const section = getSection(documentId, sectionId);
    if (!section) throw notFound('Document section not found.');
    await withAttemptLock(deps.db, req.attemptCtx!.attempt.id, async (tx, attempt) => {
      const phase = phaseOf(attempt);
      assertPhase(attempt, ['workday1', 'workday2']);
      await appendEvents(tx, deps.clock, attempt, [ev.documentOpened(phase === 'workday1' ? 'T1' : 'T2', documentId, sectionId)], actor(req));
    });
    const dto: DocumentSectionDTO = { document_id: documentId, id: section.id, number: section.number, title: section.title, blocks: section.blocks };
    res.json(dto);
  });

  r.get('/references', requirePhase('workday1', 'workday2'), (_req, res) => {
    res.json({ references: REFERENCE_CODES.map((r) => ({ code: r.code, title: r.title, document_id: r.documentId, section_id: r.sectionId })) });
  });

  // ---- Telemetry (never scored) and the optional debrief reflection ------------------------------------------
  r.post('/telemetry', async (req, res) => {
    const body = parseBody(telemetrySchema, req);
    await withAttemptLock(deps.db, req.attemptCtx!.attempt.id, (tx, attempt) => appendEvents(tx, deps.clock, attempt, [ev.telemetry('SYS', body.type, body.metadata)], actor(req)));
    res.status(202).json({ ok: true });
  });

  r.post('/reflection', requirePhase('done'), async (req, res) => {
    const body = parseBody(reflectionSchema, req);
    await withAttemptLock(deps.db, req.attemptCtx!.attempt.id, (tx, attempt) => appendEvents(tx, deps.clock, attempt, [ev.telemetry('SYS', 'debrief_reflection', { text: body.text })], actor(req)));
    res.json({ ok: true });
  });

  r.use('/t1', workday1Router(deps));
  r.use('/t2', workday2Router(deps));
  return r;
}
