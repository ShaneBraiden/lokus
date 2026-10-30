import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { attempts, auditLog } from '../src/db/schema';
import { SIMULATION_VERSION_ID } from '../src/db/seed';
import { activePackageId } from '../src/services/scoringPackages';
import { createTestContext, makeOrg, makeUser, playPersona, signIn, type TestContext } from './helpers';

let ctx: TestContext;
let perfect: string;
let missesTwo: string;
let admin: Awaited<ReturnType<typeof signIn>>;

beforeAll(async () => {
  ctx = await createTestContext();
  await makeUser(ctx, { email: 'root@lokus.test', name: 'Rita Admin', kind: 'staff', platformRole: 'admin' });
  await makeOrg(ctx, 'Acme Clinical', 'owner@acme.test');
  const employer = await signIn(ctx, 'owner@acme.test');
  perfect = await playPersona(ctx, 'p01', 'perfect@example.com', { name: 'Pat Perfect', invitedBy: employer });
  missesTwo = await playPersona(ctx, 'p07', 'misses@example.com', { name: 'Max Misses' });
  admin = await signIn(ctx, 'root@lokus.test');
});
afterAll(() => ctx.close());

describe('admin attempts explorer', () => {
  it('reports platform KPIs', async () => {
    const res = await admin.get('/api/admin/overview');
    expect(res.status).toBe(200);
    expect(res.body.attempts.submitted).toBe(2);
    expect(res.body.review_queue.open).toBe(2);
    expect(res.body.outcomes.AWAITING_REVIEW).toBe(2);
    expect(res.body.gate_rates.map((g: { gate: string }) => g.gate)).toEqual(['G1', 'G2', 'G3', 'GR']);
  });

  it('lists attempts with candidate, employer and the latest result, with filters', async () => {
    const res = await admin.get('/api/admin/attempts');
    expect(res.body.attempts).toHaveLength(2);
    const row = res.body.attempts.find((a: { id: string }) => a.id === perfect);
    expect(row).toMatchObject({ org_name: 'Acme Clinical', origin: 'invite', status: 'submitted', result: { status: 'provisional', outcome: null } });
    const filtered = await admin.get('/api/admin/attempts').query({ query: 'max' });
    expect(filtered.body.attempts.map((a: { id: string }) => a.id)).toEqual([missesTwo]);
  });

  it('shows an attempt with its result, evidence and a verified hash chain, and audits the view', async () => {
    const res = await admin.get(`/api/admin/attempts/${perfect}`);
    expect(res.status).toBe(200);
    expect(res.body.chain).toMatchObject({ ok: true });
    expect(res.body.result.criteria).toHaveLength(12);
    expect(res.body.evidence.t1.findings.length).toBeGreaterThan(5);
    expect(res.body.evidence.t1.safety_signal.minutes_to_escalation).not.toBeNull();
    const events = await admin.get(`/api/admin/attempts/${perfect}/events`);
    expect(events.body.events.length).toBe(res.body.attempt.events);
    const audited = await ctx.deps.db.select().from(auditLog).where(eq(auditLog.action, 'attempt.viewed'));
    expect(audited.some((a) => a.targetId === perfect)).toBe(true);
  });

  it('rescoring with unchanged inputs writes no new version', async () => {
    const res = await admin.post(`/api/admin/attempts/${perfect}/rescore`);
    expect(res.body).toMatchObject({ created: false });
  });

  it('explains why two candidates differ, largest differences first', async () => {
    const res = await admin.get('/api/admin/compare').query({ a: perfect, b: missesTwo });
    expect(res.status).toBe(200);
    expect(res.body.differences[0].criterion_id).toBe('T1_DISC');
    expect(res.body.differences[0].points_difference).toBeGreaterThan(0);
  });

  it('grants a retake: withdraws the old attempt and carries over employer access', async () => {
    const res = await admin.post(`/api/admin/attempts/${perfect}/retake`).send({ reason: 'Power cut during Workday 2 (support ticket 42).' });
    expect(res.status).toBe(201);
    const [old] = await ctx.deps.db.select().from(attempts).where(eq(attempts.id, perfect));
    expect(old.status).toBe('void');
    const detail = await admin.get(`/api/admin/attempts/${res.body.attempt_id}`);
    expect(detail.body.attempt).toMatchObject({ is_retake: true, status: 'not_started' });
    expect(detail.body.shares.map((s: { org: string }) => s.org)).toEqual(['Acme Clinical']);
  });
});

describe('scoring packages', () => {
  it('lists the published package and audits answer-key views', async () => {
    const list = await admin.get('/api/admin/packages');
    expect(list.body.packages[0]).toMatchObject({ id: 'v1.1-sme-draft-1', status: 'published', regression: { passed: true } });
    const key = await admin.get('/api/admin/packages/v1.1-sme-draft-1/key');
    expect(key.body.key).toHaveLength(12);
    const audited = await ctx.deps.db.select().from(auditLog).where(eq(auditLog.action, 'answer_key.viewed'));
    expect(audited).toHaveLength(1);
  });

  it('drafts, diffs, regression-tests and publishes a new package; new attempts pin it', async () => {
    const draft = await admin.post('/api/admin/packages').send({ from: 'v1.1-sme-draft-1', id: 'v1.1-sme-draft-2', label: 'SME draft 2', parameters: { W2_CLOCK: 35 }, phrase_lists: { negation_cues: ['not', 'no', 'never', 'cannot', 'refuse'] } });
    expect(draft.status).toBe(201);
    const early = await admin.post('/api/admin/packages/v1.1-sme-draft-2/publish');
    expect(early.body.error.code).toBe('regression_required');
    const diff = await admin.get('/api/admin/packages/v1.1-sme-draft-2/diff').query({ against: 'v1.1-sme-draft-1' });
    expect(diff.body.parameters).toEqual([{ key: 'W2_CLOCK', from: 30, to: 35 }]);
    expect(diff.body.phrase_lists[0].key).toBe('negation_cues');
    const run = await admin.post('/api/admin/packages/v1.1-sme-draft-2/regression');
    expect(run.status).toBe(201);
    if (!run.body.passed) {
      // A failing run blocks publishing.
      expect((await admin.post('/api/admin/packages/v1.1-sme-draft-2/publish')).body.error.code).toBe('regression_failed');
      return;
    }
    expect((await admin.post('/api/admin/packages/v1.1-sme-draft-2/publish')).status).toBe(200);
    expect(await activePackageId(ctx.deps.db, SIMULATION_VERSION_ID)).toBe('v1.1-sme-draft-2');
    const old = await admin.get('/api/admin/packages/v1.1-sme-draft-1');
    expect(old.body.status).toBe('retired');
  });

  it('serves the SME register', async () => {
    const res = await admin.get('/api/admin/content');
    expect(res.body.sme.register.length).toBeGreaterThanOrEqual(12);
    expect(res.body.documents.map((d: { id: string }) => d.id)).toEqual(['protocol', 'icf', 'dictionary', 'consent-sop']);
  });
});
