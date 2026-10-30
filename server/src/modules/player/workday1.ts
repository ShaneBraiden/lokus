import { Router } from 'express';
import { z } from 'zod';
import { activeFindings, ev, type EventDraft, type FindingSnapshot } from '@lokus/engine';
import { REFERENCE_CODES, WORKDAY1_BRIEFING, getParticipant, getSection } from '@lokus/content';
import {
  CRF_HEADER_FIELDS,
  cellSchema,
  correctionSchema,
  createFindingSchema,
  editCancelSchema,
  editCommitSchema,
  noDeviationSchema,
  noteSchema,
  participantIdSchema,
  safetyEscalationSchema,
  updateFindingSchema,
} from '@lokus/shared';
import type { AppDeps } from '../../context';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { parseBody, parseParams } from '../../lib/http';
import { appendEvents, withAttemptLock } from '../../services/eventStore';
import { actor, assertPhase, nextObjectId, requirePhase, withEvidence } from './access';
import { cellKey, crfDTO, displayedValue, editedCells, findingDTO, findingVersions, renderMail, sourceValue } from './derive';

const HEADER_KEYS = new Set<string>(CRF_HEADER_FIELDS.map((f) => f.key));
const KNOWN_CODES = new Set(REFERENCE_CODES.map((r) => r.code));

type Location = { visit: string | null; crf_field: string | null };

/** A CRF location must be coherent: header fields sit outside visits ("NA"), visit fields need a visit. */
function checkLocation(target: FindingSnapshot['target'], loc: Location): Location {
  if (target.type === 'document') return { visit: null, crf_field: null };
  if (loc.crf_field && HEADER_KEYS.has(loc.crf_field) && loc.visit && loc.visit !== 'NA') throw badRequest('invalid_location', 'Header fields are not visit-specific. Choose “Not visit-specific”.');
  if (loc.crf_field && !HEADER_KEYS.has(loc.crf_field) && loc.visit === 'NA') throw badRequest('invalid_location', 'Choose the visit this field belongs to.');
  return loc;
}

function checkCodes(codes: string[]): void {
  const unknown = codes.filter((c) => !KNOWN_CODES.has(c));
  if (unknown.length) throw badRequest('unknown_reference', `Unknown reference code: ${unknown.join(', ')}.`);
}

function checkCell(cell: { participant_id: string; visit: string; field: string }): string {
  const value = sourceValue(cell);
  if (value === null) throw badRequest('invalid_cell', 'That CRF cell does not exist.');
  return value;
}

/** Workday 1 (Task 1) content and commands, mounted at /api/attempts/:attemptId/t1. */
export function workday1Router(deps: AppDeps): Router {
  const r = Router({ mergeParams: true });
  r.use(requirePhase('workday1'));

  /** Dr. Anjali's briefing; viewing it records the "skip Section 4" instruction as seen (server-observed). */
  r.get('/briefing', async (req, res) => {
    await withAttemptLock(deps.db, req.attemptCtx!.attempt.id, async (tx, attempt) => {
      assertPhase(attempt, ['workday1']);
      await appendEvents(tx, deps.clock, attempt, (WORKDAY1_BRIEFING.instructionIds ?? []).map((id) => ev.instructionViewed(id)), actor(req));
    });
    res.json(renderMail(WORKDAY1_BRIEFING, { name: req.auth!.user.name, email: req.auth!.user.email }));
  });

  /** Opening a participant's CRF is a server-observed event (first view of DM-220 starts the T1_SAFE clock). */
  r.get('/participants/:participantId', async (req, res) => {
    const { participantId } = parseParams(z.object({ participantId: participantIdSchema }), req);
    const p = getParticipant(participantId);
    if (!p) throw notFound('Participant not found.');
    const crf = await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday1'], async (tx, attempt, { rows }) => {
      await appendEvents(tx, deps.clock, attempt, [ev.recordOpened(participantId)], actor(req));
      return crfDTO(p, rows);
    });
    res.json(crf);
  });

  r.post('/findings', async (req, res) => {
    const body = parseBody(createFindingSchema, req);
    if (body.target.type === 'document' && !getSection(body.target.document_id, body.target.section_id)) throw badRequest('unknown_section', 'That document section does not exist.');
    checkCodes(body.reference_codes);
    const loc = checkLocation(body.target, { visit: body.visit, crf_field: body.crf_field });
    const dto = await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday1'], async (tx, attempt, { rows, evidence }) => {
      const id = nextObjectId(rows, 'F', (r) => r.eventType === 'finding_created');
      const snapshot: FindingSnapshot = {
        id,
        target: body.target,
        visit: loc.visit,
        crf_field: loc.crf_field,
        finding_type: body.finding_type,
        severity: body.severity,
        reference_codes: body.reference_codes,
        observed_issue: body.observed_issue,
        action: body.action,
        status: body.status,
        query_text: body.query_text,
      };
      const drafts: EventDraft[] = [];
      // A finding replaces a "No deviation" decision for that participant (both are recorded).
      if (body.target.type === 'participant' && evidence.t1.no_deviation.get(body.target.participant_id)?.recorded) drafts.push(ev.noDeviation(body.target.participant_id, false));
      drafts.push(ev.findingCreated(snapshot));
      const [stored] = (await appendEvents(tx, deps.clock, attempt, drafts, actor(req))).slice(-1);
      return findingDTO({ ...snapshot, created_ts: stored.serverTs.getTime(), created_event_id: stored.eventId, updated_ts: stored.serverTs.getTime(), event_ids: [stored.eventId], withdrawn: false }, 1);
    });
    res.status(201).json(dto);
  });

  r.patch('/findings/:findingId', async (req, res) => {
    const { findingId } = parseParams(z.object({ findingId: z.string().regex(/^F-\d{3}$/) }), req);
    const body = parseBody(updateFindingSchema, req);
    if (body.reference_codes) checkCodes(body.reference_codes);
    const dto = await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday1'], async (tx, attempt, { rows, evidence }) => {
      const current = evidence.t1.findings.get(findingId);
      if (!current) throw notFound('Finding not found.');
      if (current.withdrawn) throw conflict('finding_withdrawn', 'This finding has been withdrawn.');
      const version = findingVersions(rows).get(findingId) ?? 1;
      if (body.version !== version) throw conflict('version_conflict', 'This finding was changed elsewhere. Reload and try again.', { version });
      const { version: _v, ...changes } = body;
      const merged = { ...current, ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) };
      const loc = checkLocation(current.target, { visit: merged.visit, crf_field: merged.crf_field });
      const snapshot: FindingSnapshot = {
        id: current.id,
        target: current.target,
        visit: loc.visit,
        crf_field: loc.crf_field,
        finding_type: merged.finding_type,
        severity: merged.severity,
        reference_codes: merged.reference_codes,
        observed_issue: merged.observed_issue,
        action: merged.action,
        status: merged.status,
        query_text: merged.query_text,
      };
      const [stored] = await appendEvents(tx, deps.clock, attempt, [ev.findingModified(snapshot, version + 1)], actor(req));
      return findingDTO({ ...snapshot, created_ts: current.created_ts, created_event_id: current.created_event_id, updated_ts: stored.serverTs.getTime(), event_ids: [...current.event_ids, stored.eventId], withdrawn: false }, version + 1);
    });
    res.json(dto);
  });

  r.post('/findings/:findingId/withdraw', async (req, res) => {
    const { findingId } = parseParams(z.object({ findingId: z.string().regex(/^F-\d{3}$/) }), req);
    await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday1'], async (tx, attempt, { evidence }) => {
      const current = evidence.t1.findings.get(findingId);
      if (!current) throw notFound('Finding not found.');
      if (current.withdrawn) throw conflict('finding_withdrawn', 'This finding has already been withdrawn.');
      await appendEvents(tx, deps.clock, attempt, [ev.findingWithdrawn(findingId)], actor(req));
    });
    res.json({ ok: true });
  });

  r.put('/participants/:participantId/no-deviation', async (req, res) => {
    const { participantId } = parseParams(z.object({ participantId: participantIdSchema }), req);
    const { recorded } = parseBody(noDeviationSchema, req);
    await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday1'], async (tx, attempt, { evidence }) => {
      const hasFindings = activeFindings(evidence.t1).some((f) => f.target.type === 'participant' && f.target.participant_id === participantId);
      if (recorded && hasFindings) throw conflict('findings_exist', 'Withdraw this participant’s findings before marking “No deviation”.');
      if ((evidence.t1.no_deviation.get(participantId)?.recorded ?? false) === recorded) return;
      await appendEvents(tx, deps.clock, attempt, [ev.noDeviation(participantId, recorded)], actor(req));
    });
    res.json({ ok: true, recorded });
  });

  /** Explicit safety escalation (F9): available identically on every record. */
  r.post('/escalations', async (req, res) => {
    const body = parseBody(safetyEscalationSchema, req);
    await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday1'], async (tx, attempt, { rows }) => {
      const id = nextObjectId(rows, 'E', (r) => r.eventType === 'escalation_completed' && r.taskId === 'T1');
      await appendEvents(tx, deps.clock, attempt, [ev.escalationT1({ id, target_participant_id: body.participant_id, to: body.to, cc: body.cc, visit: body.visit, fields: body.fields, facts: body.facts, requested_action: body.requested_action })], actor(req));
    });
    res.status(201).json({ ok: true });
  });

  /** "Message Dr. Anjali": the channel for challenging an instruction (T1_SEC4 note). */
  r.post('/notes', async (req, res) => {
    const body = parseBody(noteSchema, req);
    await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday1'], async (tx, attempt, { rows }) => {
      const id = nextObjectId(rows, 'N', (r) => r.eventType === 'clarification_created');
      await appendEvents(tx, deps.clock, attempt, [ev.clarificationCreated({ id, to: body.to, subject: body.subject, text: body.text })], actor(req));
    });
    res.status(201).json({ ok: true });
  });

  // ---- The edit-value action on source cells (F10): a neutral editor; commits and reverts are recorded ------
  r.post('/edits/start', async (req, res) => {
    const cell = parseBody(cellSchema, req);
    const original = checkCell(cell);
    const current = await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday1'], async (tx, attempt, { rows }) => {
      await appendEvents(tx, deps.clock, attempt, [ev.sourceEditStarted(cell, original)], actor(req));
      return displayedValue(rows, cell);
    });
    res.json({ original, current });
  });

  r.post('/edits/cancel', async (req, res) => {
    const body = parseBody(editCancelSchema, req);
    checkCell(body);
    const { draft_changed, ...cell } = body;
    await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday1'], (tx, attempt) => appendEvents(tx, deps.clock, attempt, [ev.sourceEditCancelled(cell, draft_changed)], actor(req)));
    res.json({ ok: true });
  });

  r.post('/edits/commit', async (req, res) => {
    const body = parseBody(editCommitSchema, req);
    checkCell(body);
    const { value, ...cell } = body;
    const result = await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday1'], async (tx, attempt, { rows }) => {
      const current = displayedValue(rows, cell) ?? '';
      if (value === current) throw badRequest('unchanged', 'The value is unchanged.');
      await appendEvents(tx, deps.clock, attempt, [ev.sourceEditCommitted(cell, current, value)], actor(req));
      return { ...cell, original: sourceValue(cell) ?? '', value };
    });
    res.json(result);
  });

  r.post('/edits/revert', async (req, res) => {
    const cell = parseBody(cellSchema, req);
    checkCell(cell);
    const result = await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday1'], async (tx, attempt, { rows }) => {
      const edited = editedCells(rows).get(cellKey(cell));
      if (!edited) throw conflict('not_edited', 'This value has not been changed.');
      await appendEvents(tx, deps.clock, attempt, [ev.sourceEditReverted(cell, edited.value, edited.original)], actor(req));
      return { ...cell, value: edited.original };
    });
    res.json(result);
  });

  r.post('/corrections', async (req, res) => {
    const body = parseBody(correctionSchema, req);
    checkCell(body);
    const { proposed, rationale, ...cell } = body;
    await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday1'], (tx, attempt) => appendEvents(tx, deps.clock, attempt, [ev.correctionRecommended(cell, proposed, rationale)], actor(req)));
    res.status(201).json({ ok: true });
  });

  return r;
}
