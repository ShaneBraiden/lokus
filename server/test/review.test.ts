import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nameRedactor } from '../src/services/evidenceView';
import { allKeys, createTestContext, makeOrg, makeUser, playPersona, signIn, type TestContext } from './helpers';

let ctx: TestContext;
let attemptId: string;

beforeAll(async () => {
  ctx = await createTestContext();
  await makeUser(ctx, { email: 'ana@lokus.test', name: 'Ana Assessor', kind: 'staff', platformRole: 'assessor' });
  await makeUser(ctx, { email: 'ben@lokus.test', name: 'Ben Assessor', kind: 'staff', platformRole: 'assessor' });
  await makeOrg(ctx, 'Acme Clinical', 'owner@acme.test');
  const employer = await signIn(ctx, 'owner@acme.test');
  attemptId = await playPersona(ctx, 'p01', 'casey@example.com', { name: 'Casey Quinn', invitedBy: employer });
});
afterAll(() => ctx.close());

describe('assessor review workflow', () => {
  let itemId: string;

  it('lists the submitted attempt in the blind queue', async () => {
    const ana = await signIn(ctx, 'ana@lokus.test');
    const res = await ana.get('/api/review/queue');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    const item = res.body.items[0];
    itemId = item.id;
    expect(item.pseudonym).toMatch(/^Candidate [0-9A-F]{6}$/);
    expect(item.pending).toEqual(['T1_SEC4', 'T1_QUERY', 'T2_REFUSE', 'T2_WAIV', 'T2_REC', 'T2_TONE']);
    const text = JSON.stringify(res.body);
    for (const leak of ['Casey', 'casey@example.com', 'Acme', attemptId]) expect(text).not.toContain(leak);
  });

  it('serves a pseudonymised packet: rubric anchors and the work, never identity, employer, scores or outcome', async () => {
    const ana = await signIn(ctx, 'ana@lokus.test');
    const res = await ana.get(`/api/review/items/${itemId}`);
    expect(res.status).toBe(200);
    expect(res.body.criteria.map((c: { id: string }) => c.id)).toEqual(['T1_SEC4', 'T1_QUERY', 'T2_REFUSE', 'T2_WAIV', 'T2_REC', 'T2_TONE']);
    expect(Object.keys(res.body.criteria[0].anchors)).toEqual(['0', '1', '2', '3', '4']);
    expect(res.body.evidence.t2.reply.body.length).toBeGreaterThan(10);
    const text = JSON.stringify(res.body);
    for (const leak of ['Casey', 'Quinn', 'casey@example.com', 'Acme Clinical', attemptId]) expect(text).not.toContain(leak);
    const keys = allKeys(res.body);
    for (const k of ['outcome', 'score_q', 'points_q', 'competencies', 'tasks']) expect(keys.has(k)).toBe(false);
  });

  it('records ratings, refuses a second assessor, and completes the review', async () => {
    const ana = await signIn(ctx, 'ana@lokus.test');
    const ben = await signIn(ctx, 'ben@lokus.test');
    const first = await ana.post(`/api/review/items/${itemId}/ratings`).send({ ratings: [{ criterion_id: 'T2_TONE', raw_rating: 3, rationale: 'Courteous and firm; one long paragraph.' }] });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ pending: ['T1_SEC4', 'T1_QUERY', 'T2_REFUSE', 'T2_WAIV', 'T2_REC'], gr_hold: false, complete: false });
    const blocked = await ben.post(`/api/review/items/${itemId}/ratings`).send({ ratings: [{ criterion_id: 'T2_REC', raw_rating: 4, rationale: 'Complete.' }] });
    expect(blocked.status).toBe(409);
    expect((await ben.get('/api/review/queue')).body.items).toHaveLength(0);
    const rest = ['T1_SEC4', 'T1_QUERY', 'T2_REFUSE', 'T2_WAIV', 'T2_REC'].map((criterion_id) => ({ criterion_id, raw_rating: 4, rationale: 'Meets the level-4 anchor.' }));
    const done = await ana.post(`/api/review/items/${itemId}/ratings`).send({ ratings: rest });
    expect(done.body).toEqual({ pending: [], gr_hold: false, complete: true });
    const finished = await ana.get('/api/review/queue?scope=done');
    expect(finished.body.items.map((i: { id: string }) => i.id)).toContain(itemId);
    const packet = await ana.get(`/api/review/items/${itemId}`);
    expect(packet.body.history.ratings).toHaveLength(6);
  });

  it('validates ratings and requires a rationale', async () => {
    const ana = await signIn(ctx, 'ana@lokus.test');
    const res = await ana.post(`/api/review/items/${itemId}/ratings`).send({ ratings: [{ criterion_id: 'T1_DISC', raw_rating: 4, rationale: 'Auto criterion' }] });
    expect(res.status).toBe(400);
    const res2 = await ana.post(`/api/review/items/${itemId}/ratings`).send({ ratings: [{ criterion_id: 'T2_TONE', raw_rating: 4, rationale: '' }] });
    expect(res2.status).toBe(400);
  });

  it('keeps candidates and employers out of the review and admin APIs', async () => {
    const employer = await signIn(ctx, 'owner@acme.test');
    const candidate = await signIn(ctx, 'casey@example.com');
    const assessor = await signIn(ctx, 'ana@lokus.test');
    for (const agent of [employer, candidate]) {
      expect((await agent.get('/api/review/queue')).status).toBe(403);
      expect((await agent.get('/api/admin/attempts')).status).toBe(403);
    }
    expect((await assessor.get('/api/admin/attempts')).status).toBe(403);
  });
});

describe('name redaction for blind packets', () => {
  it('removes the candidate name parts and email from free text', () => {
    const redact = nameRedactor('Casey Quinn', 'casey@example.com');
    expect(redact('Regards, Casey Quinn (casey@example.com). Casey will follow up.')).toBe('Regards, [candidate] ([candidate email]). [candidate] will follow up.');
    expect(redact('Caseyville is unaffected')).toBe('Caseyville is unaffected');
  });
});
