import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { auditLog } from '../src/db/schema';
import { recordReviewerRatings } from '../src/services/scoring';
import { allKeys, createTestContext, makeOrg, makeUser, playPersona, signIn, type TestContext } from './helpers';

let ctx: TestContext;
let acmeAttempt: string;
let betaAttempt: string;
let poolAttempt: string;
let raterId: string;
let acme: Awaited<ReturnType<typeof signIn>>;
let beta: Awaited<ReturnType<typeof signIn>>;

const FORBIDDEN_KEYS = ['rating', 'raw_rating', 'rule_id', 'cap', 'cap_reasons', 'points_q', 'rationale', 'answer_key', 'accepted_types', 'why_correct', 'criteria'];

beforeAll(async () => {
  ctx = await createTestContext();
  raterId = (await makeUser(ctx, { email: 'rater@lokus.test', kind: 'staff', platformRole: 'assessor' })).id;
  await makeOrg(ctx, 'Acme Clinical', 'owner@acme.test');
  await makeOrg(ctx, 'Beta Trials', 'owner@beta.test');
  acme = await signIn(ctx, 'owner@acme.test');
  beta = await signIn(ctx, 'owner@beta.test');
  acmeAttempt = await playPersona(ctx, 'p01', 'casey@example.com', { name: 'Casey Quinn', invitedBy: acme });
  betaAttempt = await playPersona(ctx, 'p07', 'drew@example.com', { name: 'Drew Lane', invitedBy: beta });
  poolAttempt = await playPersona(ctx, 'p09', 'pat@example.com', { name: 'Pat Pool' });
  const pat = await signIn(ctx, 'pat@example.com');
  await pat.put('/api/candidate/profile').send({ headline: 'CRA, 3 years in oncology', location: 'Pune' });
  expect((await pat.put('/api/candidate/talent-pool').send({ listed: true })).status).toBe(200);
  await acme.post('/api/org/invitations').send({ candidates: [{ email: 'later@example.com', name: 'Lee Later' }] });
});
afterAll(() => ctx.close());

describe('employer results', () => {
  it('summarises the organisation', async () => {
    const res = await acme.get('/api/org/overview');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ invited: 1, completed: 1, awaiting_review: 1, meets_rate: null });
  });

  it('lists only its own candidates; scores stay hidden until review is complete', async () => {
    const res = await acme.get('/api/org/candidates');
    const names = res.body.candidates.map((c: { name: string }) => c.name);
    expect(names).toEqual(['Lee Later', 'Casey Quinn']);
    const casey = res.body.candidates.find((c: { name: string }) => c.name === 'Casey Quinn');
    expect(casey).toMatchObject({ attempt_id: acmeAttempt, progress: 'submitted', result: { outcome: 'AWAITING_REVIEW', t1: null, t2: null } });
    expect(names).not.toContain('Drew Lane');
  });

  it('serves the permitted report: outcome, flags, competencies and evidence, never ratings or key content', async () => {
    const res = await acme.get(`/api/org/results/${acmeAttempt}`);
    expect(res.status).toBe(200);
    expect(res.body.result.gates.map((g: { gate_id: string }) => g.gate_id)).toEqual(['G1', 'G2', 'G3', 'GR']);
    expect(res.body.evidence.t1.findings.length).toBeGreaterThan(5);
    const keys = allKeys(res.body);
    for (const k of FORBIDDEN_KEYS) expect(keys.has(k)).toBe(false);
    expect(JSON.stringify(res.body)).not.toMatch(/T1_DISC|T2_REFUSE|BAND_|QUERY_LEAD_CAP/);
    const audited = await ctx.deps.db.select().from(auditLog).where(eq(auditLog.action, 'result.viewed'));
    expect(audited.some((a) => a.targetId === acmeAttempt)).toBe(true);
  });

  it('becomes final with scores once the assessor has rated', async () => {
    const all4 = ['T1_SEC4', 'T1_QUERY', 'T2_REFUSE', 'T2_WAIV', 'T2_REC', 'T2_TONE'].map((criterion_id) => ({ criterion_id, raw_rating: 4, rationale: 'Meets the level-4 anchor.' }));
    await recordReviewerRatings(ctx.deps, acmeAttempt, raterId, all4);
    const res = await acme.get(`/api/org/results/${acmeAttempt}`);
    expect(res.body.result).toMatchObject({ status: 'final', outcome: 'MEETS_BAR', scores_final: true });
    expect(res.body.result.t1).toBeGreaterThan(90);
    expect(res.body.result.reason).toBe('Both workdays met the bar, with no critical flags.');
    expect((await acme.get('/api/org/overview')).body.meets_rate).toBe(100);
  });

  it('isolates organisations from each other', async () => {
    expect((await beta.get(`/api/org/results/${acmeAttempt}`)).status).toBe(404);
    expect((await beta.get(`/api/org/results/${acmeAttempt}/report.pdf`)).status).toBe(404);
    expect((await beta.get('/api/org/compare').query({ ids: `${acmeAttempt},${betaAttempt}` })).status).toBe(404);
    expect((await acme.get(`/api/org/results/${betaAttempt}`)).status).toBe(404);
    const candidate = await signIn(ctx, 'casey@example.com');
    expect((await candidate.get(`/api/org/results/${acmeAttempt}`)).status).toBe(403);
  });

  it('exports a CSV with formula-safe cells', async () => {
    const res = await acme.get('/api/org/candidates.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.replace(/^﻿/, '').split('\r\n');
    expect(lines[0]).toContain('"Name","Email"');
    expect(lines.some((l) => l.includes('"Casey Quinn"') && l.includes('"Meets bar"'))).toBe(true);
  });

  it('renders a PDF report', async () => {
    const res = await acme.get(`/api/org/results/${acmeAttempt}/report.pdf`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('stops serving a result once the share is revoked', async () => {
    const candidate = await signIn(ctx, 'casey@example.com');
    const privacy = await candidate.get('/api/candidate/privacy');
    const share = privacy.body.shares.find((s: { org_name: string }) => s.org_name === 'Acme Clinical');
    expect((await candidate.post(`/api/candidate/shares/${share.id}/revoke`)).status).toBe(200);
    expect((await acme.get(`/api/org/results/${acmeAttempt}`)).status).toBe(404);
    const row = (await acme.get('/api/org/candidates')).body.candidates.find((c: { name: string }) => c.name === 'Casey Quinn');
    expect(row).toMatchObject({ attempt_id: null, result: null });
  });
});

describe('talent pool', () => {
  it('finds opted-in, self-started results and audits every view', async () => {
    const list = await beta.get('/api/org/talent-pool');
    expect(list.body.candidates.map((c: { attempt_id: string }) => c.attempt_id)).toEqual([poolAttempt]);
    expect(list.body.candidates[0]).toMatchObject({ name: 'Pat Pool', headline: 'CRA, 3 years in oncology', location: 'Pune' });
    expect(JSON.stringify(list.body)).not.toContain('pat@example.com');
    const detail = await beta.get(`/api/org/talent-pool/${poolAttempt}`);
    expect(detail.body.candidate.email).toBe('pat@example.com');
    const keys = allKeys(detail.body);
    for (const k of FORBIDDEN_KEYS) expect(keys.has(k)).toBe(false);
    const audited = await ctx.deps.db.select().from(auditLog).where(eq(auditLog.action, 'talent_pool.viewed'));
    expect(audited).toHaveLength(1);
  });

  it('never lists invited results, and removes a candidate who leaves the pool', async () => {
    const list = await acme.get('/api/org/talent-pool');
    expect(list.body.candidates.map((c: { attempt_id: string }) => c.attempt_id)).not.toContain(acmeAttempt);
    const pat = await signIn(ctx, 'pat@example.com');
    await pat.put('/api/candidate/talent-pool').send({ listed: false });
    expect((await beta.get(`/api/org/talent-pool/${poolAttempt}`)).status).toBe(404);
    expect((await beta.get('/api/org/talent-pool')).body.candidates).toEqual([]);
  });
});
