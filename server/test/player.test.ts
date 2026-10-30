import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { attempts, reviewItems } from '../src/db/schema';
import { SIMULATION_VERSION_ID } from '../src/db/seed';
import { createAttempt } from '../src/services/attempts';
import { listEvents } from '../src/services/eventStore';
import { latestResult } from '../src/services/scoring';
import { allKeys, createTestContext, makeOrg, makeUser, signIn, type TestContext } from './helpers';

let ctx: TestContext;
type Agent = Awaited<ReturnType<typeof signIn>>;
let cand: Agent;
let attemptId: string;
let base: string;

const SCORE_KEYS = ['score', 'scores', 'rating', 'ratings', 'outcome', 'gate', 'gates', 'points', 'points_q', 'score_q', 'competencies', 'criteria', 'cap', 'caps', 'pending_review'];

async function newAttempt(email: string, deadlineAt: Date | null = null) {
  const user = await makeUser(ctx, { email, kind: 'candidate', name: 'Asha Verma' });
  const attempt = await ctx.deps.db.transaction((tx) => createAttempt(tx, { candidateId: user.id, simulationVersionId: SIMULATION_VERSION_ID, origin: 'self', deadlineAt }));
  return { user, attempt, agent: await signIn(ctx, email) };
}

const events = async (id = attemptId) => listEvents(ctx.deps.db, id);
const lastEvent = async (id = attemptId) => (await events(id)).at(-1)!;
const state = async () => (await cand.get(`${base}/state`)).body;

beforeAll(async () => {
  ctx = await createTestContext();
  const a = await newAttempt('player@example.com');
  cand = a.agent;
  attemptId = a.attempt.id;
  base = `/api/attempts/${attemptId}`;
});
afterAll(() => ctx.close());

describe('phases and Workday 1 content', () => {
  it('starts in the intro phase and refuses Workday 1 commands until started', async () => {
    expect((await state()).attempt.phase).toBe('intro');
    expect((await cand.get(`${base}/t1/briefing`)).body.error.code).toBe('wrong_phase');
    expect((await cand.post(`${base}/tasks/T1/start`)).status).toBe(200);
    expect((await cand.post(`${base}/tasks/T1/start`)).status).toBe(200); // idempotent
    const s = await state();
    expect(s.attempt.phase).toBe('workday1');
    expect(s.candidate).toEqual({ name: 'Asha Verma', first_name: 'Asha', email: 'player@example.com' });
  });

  it('records the briefing instruction and CRF opens as server-observed events', async () => {
    const briefing = await cand.get(`${base}/t1/briefing`);
    expect(briefing.body.body.join(' ')).toContain('Section 4 was already approved. Skip it and review the rest.');
    expect(briefing.body.body[0]).toBe('Hi Asha,');
    expect(await lastEvent()).toMatchObject({ eventType: 'instruction_viewed', objectId: 'skip_s4', source: 'O' });

    ctx.clock.advanceMinutes(1);
    const crf = await cand.get(`${base}/t1/participants/AHS-007-DM-220`);
    expect(crf.body.header).toMatchObject({ participantId: 'AHS-007-DM-220', siteId: 'Site-02' });
    expect(crf.body.visits.find((v: { visit: string }) => v.visit === 'W12').values.siteComments).toBe('Patient reported dizziness upon blood collection');
    const ev = await lastEvent();
    expect(ev).toMatchObject({ eventType: 'record_opened', objectId: 'AHS-007-DM-220', source: 'O' });
    expect(ev.serverTs.getTime()).toBe(ctx.clock.now().getTime());
    expect((await state()).t1.participants.find((p: { id: string }) => p.id === 'AHS-007-DM-220').opened).toBe(true);
  });

  it('serves documents section by section and records each open', async () => {
    const docs = await cand.get(`${base}/documents`);
    expect(docs.body.documents.map((d: { id: string }) => d.id)).toEqual(['protocol', 'icf', 'dictionary', 'consent-sop']);
    expect(JSON.stringify(docs.body)).not.toContain('twice a day'); // tables of contents carry no section bodies
    const s4 = await cand.get(`${base}/documents/icf/sections/4`);
    expect(JSON.stringify(s4.body.blocks)).toContain('twice a day');
    expect(await lastEvent()).toMatchObject({ eventType: 'document_opened', objectId: 'icf:4', taskId: 'T1', source: 'O' });
    expect((await cand.get(`${base}/documents/icf/sections/99`)).status).toBe(404);
    const refs = await cand.get(`${base}/references`);
    expect(refs.body.references.map((r: { code: string }) => r.code)).toContain('PRO-026-E');
  });
});

describe('Workday 1 commands', () => {
  it('creates findings with sequential ids, replacing a "No deviation" decision', async () => {
    await cand.put(`${base}/t1/participants/AHS-007-DM-008/no-deviation`).send({ recorded: true });
    const res = await cand.post(`${base}/t1/findings`).send({ target: { type: 'participant', participant_id: 'AHS-007-DM-008' }, visit: 'W8', crf_field: 'actualDate', finding_type: 'Visit date deviation / window violation' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'F-001', version: 1, severity: null, reference_codes: [], observed_issue: '' });
    const types = (await events()).slice(-2).map((e) => e.eventType);
    expect(types).toEqual(['no_deviation_retracted', 'finding_created']);
    expect((await state()).t1.participants.find((p: { id: string }) => p.id === 'AHS-007-DM-008').status).toBe('findings');
  });

  it('updates with optimistic versioning and withdraws', async () => {
    const ok = await cand.patch(`${base}/t1/findings/F-001`).send({ version: 1, severity: 'Medium', reference_codes: ['pro-026-a'], observed_issue: 'Week 8 is 5 days early.' });
    expect(ok.body).toMatchObject({ version: 2, severity: 'Medium', reference_codes: ['PRO-026-A'] });
    expect((await cand.patch(`${base}/t1/findings/F-001`).send({ version: 1, action: 'x' })).body.error).toMatchObject({ code: 'version_conflict', details: { version: 2 } });
    const doc = await cand.post(`${base}/t1/findings`).send({ target: { type: 'document', document_id: 'icf', section_id: '4' }, visit: 'W0', finding_type: 'Document content discrepancy' });
    expect(doc.body).toMatchObject({ id: 'F-002', visit: null, crf_field: null });
    expect((await cand.post(`${base}/t1/findings/F-002/withdraw`)).status).toBe(200);
    expect((await cand.post(`${base}/t1/findings/F-002/withdraw`)).body.error.code).toBe('finding_withdrawn');
    expect((await cand.put(`${base}/t1/participants/AHS-007-DM-008/no-deviation`).send({ recorded: true })).body.error.code).toBe('findings_exist');
  });

  it('rejects malformed or forged commands', async () => {
    const bad = (body: object) => cand.post(`${base}/t1/findings`).send(body);
    expect((await bad({ target: { type: 'participant', participant_id: 'AHS-007-DM-999' }, finding_type: 'Visit date deviation / window violation' })).body.error.code).toBe('validation_failed');
    expect((await bad({ target: { type: 'participant', participant_id: 'AHS-007-DM-008' }, finding_type: 'Made up type' })).body.error.code).toBe('validation_failed');
    expect((await bad({ target: { type: 'participant', participant_id: 'AHS-007-DM-008' }, finding_type: 'Missing data / Incomplete CRF', reference_codes: ['PRO-026-Z'] })).body.error.code).toBe('unknown_reference');
    expect((await bad({ target: { type: 'participant', participant_id: 'AHS-007-DM-008' }, finding_type: 'Missing data / Incomplete CRF', visit: 'W0', crf_field: 'siteId' })).body.error.code).toBe('invalid_location');
    expect((await bad({ target: { type: 'document', document_id: 'icf', section_id: '42' }, finding_type: 'Document content discrepancy' })).body.error.code).toBe('unknown_section');
    // Client-supplied timestamps or event fields are ignored: the server stamps its own time.
    const before = ctx.clock.now().getTime();
    await cand.post(`${base}/t1/notes`).send({ to: ['anjali'], subject: 'Section 4', text: 'Version 3.0 changed Section 4.', server_ts: 0, event_type: 'task_completed' });
    expect(await lastEvent()).toMatchObject({ eventType: 'clarification_created', objectId: 'N-001' });
    expect((await lastEvent()).serverTs.getTime()).toBe(before);
    expect((await cand.post(`${base}/telemetry`).send({ type: 'finding_created', metadata: {} })).body.error.code).toBe('validation_failed');
    expect((await cand.post(`${base}/events`).send({ event_type: 'task_completed' })).status).toBe(404);
  });

  it('runs the edit-value trap: start, commit, revert, cancel and recommend', async () => {
    const cell = { participant_id: 'AHS-007-DM-124', visit: 'W0', field: 'doseReceived' };
    expect((await cand.post(`${base}/t1/edits/start`).send(cell)).body).toEqual({ original: '50 ug', current: '50 ug' });
    expect((await cand.post(`${base}/t1/edits/commit`).send({ ...cell, value: '50 ug' })).body.error.code).toBe('unchanged');
    expect((await cand.post(`${base}/t1/edits/commit`).send({ ...cell, value: '50 mg' })).body).toMatchObject({ original: '50 ug', value: '50 mg' });
    const crf = await cand.get(`${base}/t1/participants/AHS-007-DM-124`);
    expect(crf.body.visits[0].values.doseReceived).toBe('50 mg');
    expect(crf.body.edits).toEqual([{ ...cell, original: '50 ug', value: '50 mg' }]);
    expect((await cand.post(`${base}/t1/edits/revert`).send(cell)).body).toMatchObject({ value: '50 ug' });
    expect((await cand.post(`${base}/t1/edits/revert`).send(cell)).body.error.code).toBe('not_edited');
    expect((await cand.post(`${base}/t1/edits/cancel`).send({ ...cell, draft_changed: true })).status).toBe(200);
    expect((await cand.post(`${base}/t1/corrections`).send({ ...cell, proposed: '50 mg', rationale: 'Protocol dose' })).status).toBe(201);
    expect((await cand.post(`${base}/t1/edits/start`).send({ ...cell, visit: 'NA' })).body.error.code).toBe('invalid_cell');
    const s = await state();
    expect(s.t1.edited_cells).toEqual([]);
    expect(s.t1.corrections).toHaveLength(1);
  });

  it('escalates explicitly and refuses to submit until every participant is decided', async () => {
    expect((await cand.post(`${base}/t1/escalations`).send({ participant_id: 'AHS-007-DM-220', to: ['medical-monitor'], facts: 'Week 12 dizziness; AE field None.' })).status).toBe(201);
    const blocked = await cand.post(`${base}/tasks/T1/submit`);
    expect(blocked.body.error.code).toBe('review_incomplete');
    expect(blocked.body.error.details.unreviewed).toHaveLength(11);
    for (const pid of blocked.body.error.details.unreviewed as string[]) await cand.put(`${base}/t1/participants/${pid}/no-deviation`).send({ recorded: true });
    expect((await cand.post(`${base}/tasks/T1/submit`)).status).toBe(200);
    const s = await state();
    expect(s.attempt.phase).toBe('between');
    expect(s.t1.submitted).toBe(true);
    expect((await cand.get(`${base}/t1/participants/AHS-007-DM-206`)).body.error.code).toBe('wrong_phase');
    expect((await cand.post(`${base}/tasks/T1/submit`)).body.error.code).toBe('wrong_phase');
  });
});

describe('Workday 2: server clock, forced choices and record', () => {
  it('starts the 30-minute clock at the first sponsor-email open and keeps it across refreshes', async () => {
    expect((await cand.post(`${base}/tasks/T2/start`)).status).toBe(200);
    const inbox = await cand.get(`${base}/t2/inbox`);
    expect(inbox.body.messages.map((m: { id: string }) => m.id)).toContain('w2-sponsor');
    expect((await cand.put(`${base}/t2/decisions/sae`).send({ value: 'REPORT_NOW' })).body.error.code).toBe('sponsor_email_not_opened');
    await cand.get(`${base}/t2/emails/w2-anjali-schedule`);
    expect((await state()).t2.clock).toBeNull();

    ctx.clock.advanceMinutes(2);
    const opened = await cand.get(`${base}/t2/emails/w2-sponsor`);
    expect(opened.body.message.to[0]).toBe('Asha Verma <player@example.com>');
    expect(opened.body.clock).toMatchObject({ duration_minutes: 30, remaining_ms: 30 * 60_000, overtime: false });
    const startedAt = opened.body.clock.started_at;

    ctx.clock.advanceMinutes(10);
    await cand.get(`${base}/t2/emails/w2-sponsor`); // reopening does not restart it
    const clock = (await cand.get(`${base}/clock`)).body.w2;
    expect(clock).toMatchObject({ started_at: startedAt, remaining_ms: 20 * 60_000 });
    const [row] = await ctx.deps.db.select().from(attempts).where(eq(attempts.id, attemptId));
    expect(row.w2ClockStartedAt?.toISOString()).toBe(startedAt);
  });

  it('requires both decisions before the reply and locks them after it', async () => {
    expect((await cand.post(`${base}/t2/reply`).send({ to: ['sponsor'], subject: 'RE', body: 'No.' })).body.error.code).toBe('decisions_required');
    expect((await cand.put(`${base}/t2/decisions/sae`).send({ value: 'MAYBE' })).body.error.code).toBe('validation_failed');
    await cand.put(`${base}/t2/decisions/sae`).send({ value: 'WAIT' });
    await cand.put(`${base}/t2/decisions/sae`).send({ value: 'REPORT_NOW' });
    await cand.put(`${base}/t2/decisions/waiver`).send({ value: 'DECLINE_ROUTE' });
    expect((await cand.post(`${base}/t2/reply`).send({ to: ['anjali'], subject: 'RE', body: 'Hi' })).body.error.code).toBe('reply_must_address_sponsor');
    expect((await cand.post(`${base}/t2/reply`).send({ to: ['sponsor'], cc: ['site02-pi'], subject: 'RE: Urgent', body: 'I cannot agree to either request.' })).status).toBe(201);
    expect((await cand.put(`${base}/t2/decisions/sae`).send({ value: 'WAIT' })).body.error.code).toBe('decisions_locked');
    expect((await cand.post(`${base}/t2/reply`).send({ to: ['sponsor'], subject: 'RE', body: 'Again' })).body.error.code).toBe('reply_already_sent');
    const s = await state();
    expect(s.t2).toMatchObject({ decisions: { sae: 'REPORT_NOW', waiver: 'DECLINE_ROUTE' }, decisions_locked: true });
    expect(s.t2.reply).toMatchObject({ to: ['sponsor'], cc: ['site02-pi'], body: 'I cannot agree to either request.' });
  });

  it('accepts escalations, records and the narrative, and shows overtime without blocking', async () => {
    await cand.post(`${base}/t2/messages`).send({ to: ['anjali'], subject: 'Sponsor requests', body: 'Please decide on the SAE and the waiver.' });
    await cand.put(`${base}/t2/record/sae`).send({ summary: 'SAE hold requested', status: 'Escalated – awaiting decision', owner: 'Dr. Anjali Roy', next_step: 'Report now', date: '21-10-2026' });
    expect((await cand.put(`${base}/t2/record/waiver`).send({ status: 'Pending' })).body.error.code).toBe('validation_failed');
    await cand.put(`${base}/t2/record/waiver`).send({ summary: 'Waiver requested', status: 'Open', owner: 'Medical Monitor', next_step: 'Decide' });
    await cand.put(`${base}/t2/narrative`).send({ narrative: 'Both requests escalated.' });
    ctx.clock.advanceMinutes(25);
    const s = await state();
    expect(s.t2.clock).toMatchObject({ overtime: true, remaining_ms: 0 });
    expect(s.t2.messages).toHaveLength(1);
    expect(s.t2.record.sae).toMatchObject({ status: 'Escalated – awaiting decision', owner: 'Dr. Anjali Roy' });
    expect(s.t2.record.narrative).toBe('Both requests escalated.');
  });

  it('submits, locks Workday 2, stores a provisional result and queues it for review', async () => {
    expect((await cand.post(`${base}/tasks/T2/submit`)).status).toBe(200);
    const s = await state();
    expect(s.attempt.phase).toBe('done');
    expect((await cand.get(`${base}/t2/inbox`)).body.error.code).toBe('wrong_phase');
    expect((await cand.post(`${base}/reflection`).send({ text: 'I would escalate sooner.' })).status).toBe(200);
    expect([...allKeys(s)].filter((k) => SCORE_KEYS.includes(k))).toEqual([]);

    const result = await latestResult(ctx.deps.db, attemptId);
    expect(result).toMatchObject({ status: 'provisional', trigger: 't2_submit' });
    const res = result!.result as { pending_review: string[]; criteria: { criterion_id: string; rule_id: string; rating: number | null }[] };
    // The only finding has no site query, so T1_QUERY is scored 0 without review instead of waiting for an assessor.
    expect(res.pending_review).toEqual(['T1_SEC4', 'T2_REFUSE', 'T2_WAIV', 'T2_REC', 'T2_TONE']);
    expect(res.criteria.find((c) => c.criterion_id === 'T1_QUERY')).toMatchObject({ rating: 0, rule_id: 'QUERY_NONE' });
    const [item] = await ctx.deps.db.select().from(reviewItems).where(eq(reviewItems.attemptId, attemptId));
    expect(item).toMatchObject({ status: 'open', priority: 0 });
    expect(item.pseudonym).toMatch(/^Candidate [0-9A-F]{6}$/);
  });
});

describe('ownership and deadlines', () => {
  it('hides other candidates’ attempts and blocks non-candidates', async () => {
    const other = await newAttempt('other@example.com');
    expect((await cand.get(`/api/attempts/${other.attempt.id}/state`)).status).toBe(404);
    expect((await cand.get('/api/attempts/not-a-uuid/state')).status).toBe(404);
    await makeOrg(ctx, 'Org P', 'owner-p@example.com');
    const employer = await signIn(ctx, 'owner-p@example.com');
    expect((await employer.get(`${base}/state`)).status).toBe(403);
  });

  it('closes an unfinished attempt after its deadline with a final Incomplete outcome', async () => {
    const late = await newAttempt('late@example.com', new Date(ctx.clock.now().getTime() + 60 * 60_000));
    const b = `/api/attempts/${late.attempt.id}`;
    await late.agent.post(`${b}/tasks/T1/start`);
    ctx.clock.advanceMinutes(61);
    const s = (await late.agent.get(`${b}/state`)).body;
    expect(s.attempt).toMatchObject({ phase: 'closed', status: 'closed', close_reason: 'expired' });
    expect((await late.agent.get(`${b}/t1/briefing`)).body.error.code).toBe('attempt_closed');
    expect(await latestResult(ctx.deps.db, late.attempt.id)).toMatchObject({ outcome: 'INCOMPLETE', status: 'final', trigger: 'close' });
  });
});
