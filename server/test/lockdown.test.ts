import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOCKDOWN_STRIKE_LIMIT } from '@lokus/shared';
import { createTestContext, makeOrg, PASSWORD, signIn, type TestContext } from './helpers';

let ctx: TestContext;
let acme: Awaited<ReturnType<typeof signIn>>;

/** Invites a candidate (optionally proctored), accepts and starts Workday 1. */
async function startInvited(email: string, lockdown: boolean) {
  const sent = await acme.post('/api/org/invitations').send({ candidates: [{ email, name: 'Lock Down' }], lockdown });
  expect(sent.status).toBe(201);
  const agent = ctx.agent();
  const accepted = await agent.post('/api/invites/accept').send({ token: ctx.mailer.tokenFrom(email, '/invite'), name: 'Lock Down', password: PASSWORD, consent: true });
  const attemptId: string = accepted.body.attempt_id;
  expect((await agent.post(`/api/attempts/${attemptId}/tasks/T1/start`)).status).toBe(200);
  return { agent, base: `/api/attempts/${attemptId}`, attemptId };
}

beforeAll(async () => {
  ctx = await createTestContext();
  await makeOrg(ctx, 'Acme Clinical', 'owner@acme.test');
  acme = await signIn(ctx, 'owner@acme.test');
});
afterAll(() => ctx.close());

describe('lockdown (proctored) assessments', () => {
  it('is off unless the employer asks for it, and rejects violations then', async () => {
    const { agent, base } = await startInvited('free@example.com', false);
    expect((await agent.get(`${base}/state`)).body.attempt.lockdown).toEqual({ required: false, strikes: 0, limit: LOCKDOWN_STRIKE_LIMIT });
    expect((await agent.post(`${base}/lockdown/violation`).send({ kind: 'tab_hidden' })).status).toBe(409);
  });

  it('records blocked actions without striking, closes the attempt at the strike limit, and reports it to the employer', async () => {
    const { agent, base, attemptId } = await startInvited('proctored@example.com', true);
    expect((await agent.get(`${base}/state`)).body.attempt.lockdown.required).toBe(true);
    const invites = await acme.get('/api/org/invitations');
    expect(invites.body.invitations.find((i: { email: string }) => i.email === 'proctored@example.com').lockdown).toBe(true);

    const paste = await agent.post(`${base}/lockdown/violation`).send({ kind: 'paste' });
    expect(paste.body).toMatchObject({ strikes: 0, closed: false });

    for (let i = 1; i < LOCKDOWN_STRIKE_LIMIT; i++) {
      const r = await agent.post(`${base}/lockdown/violation`).send({ kind: 'tab_hidden' });
      expect(r.body).toMatchObject({ strikes: i, closed: false });
    }
    const last = await agent.post(`${base}/lockdown/violation`).send({ kind: 'fullscreen_exit' });
    expect(last.body).toMatchObject({ strikes: LOCKDOWN_STRIKE_LIMIT, closed: true });

    const state = (await agent.get(`${base}/state`)).body;
    expect(state.attempt).toMatchObject({ phase: 'closed', close_reason: 'lockdown' });
    expect((await agent.post(`${base}/lockdown/violation`).send({ kind: 'tab_hidden' })).status).toBe(409);

    const report = (await acme.get(`/api/org/results/${attemptId}`)).body;
    expect(report.integrity).toMatchObject({ lockdown: true, strikes: LOCKDOWN_STRIKE_LIMIT, closed_by_lockdown: true });
    expect(report.integrity.violations.map((v: { kind: string }) => v.kind)).toEqual(['paste', ...Array(LOCKDOWN_STRIKE_LIMIT - 1).fill('tab_hidden'), 'fullscreen_exit']);
  });

  it('rejects unknown violation kinds', async () => {
    const { agent, base } = await startInvited('odd@example.com', true);
    expect((await agent.post(`${base}/lockdown/violation`).send({ kind: 'anything' })).status).toBe(400);
  });
});
