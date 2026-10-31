import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, makeOrg, playPersona, signIn, type TestContext } from './helpers';

// OPEN_TALENT_POOL (testing phase): every organisation sees every listed candidate's submitted result.
let ctx: TestContext;
let acmeAttempt: string;
let poolAttempt: string;
let beta: Awaited<ReturnType<typeof signIn>>;

beforeAll(async () => {
  ctx = await createTestContext({ openTalentPool: true });
  await makeOrg(ctx, 'Acme Clinical', 'owner@acme.test');
  await makeOrg(ctx, 'Beta Trials', 'owner@beta.test');
  const acme = await signIn(ctx, 'owner@acme.test');
  beta = await signIn(ctx, 'owner@beta.test');
  acmeAttempt = await playPersona(ctx, 'p01', 'casey@example.com', { name: 'Casey Quinn', invitedBy: acme });
  poolAttempt = await playPersona(ctx, 'p09', 'pat@example.com', { name: 'Pat Pool' });
});
afterAll(() => ctx.close());

describe('open talent pool', () => {
  it("lists another organisation's invited result next to self-started ones", async () => {
    const list = await beta.get('/api/org/talent-pool');
    expect(list.body.candidates.map((c: { attempt_id: string }) => c.attempt_id).sort()).toEqual([acmeAttempt, poolAttempt].sort());
    const detail = await beta.get(`/api/org/talent-pool/${acmeAttempt}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ talent_pool: true, candidate: { name: 'Casey Quinn' } });
    // Still no share: the invited-result route stays closed to other organisations.
    expect((await beta.get(`/api/org/results/${acmeAttempt}`)).status).toBe(404);
  });

  it('compares talent-pool results side by side', async () => {
    const res = await beta.get(`/api/org/compare?ids=${acmeAttempt},${poolAttempt}`);
    expect(res.status).toBe(200);
    expect(res.body.candidates.map((c: { name: string; talent_pool: boolean }) => [c.name, c.talent_pool])).toEqual([
      ['Casey Quinn', true],
      ['Pat Pool', true],
    ]);
  });

  it('renders a PDF report for a talent-pool result', async () => {
    const res = await beta.get(`/api/org/talent-pool/${poolAttempt}/report.pdf`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });
});
