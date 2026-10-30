import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './helpers';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(() => ctx.close());

describe('smoke', () => {
  it('serves health and 404s unknown API routes', async () => {
    const a = ctx.agent();
    expect((await a.get('/api/health')).body.status).toBe('ok');
    expect((await a.get('/api/nope')).status).toBe(404);
    expect((await a.get('/api/auth/me')).status).toBe(401);
  });
});
