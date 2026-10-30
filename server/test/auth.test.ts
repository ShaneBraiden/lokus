import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { totpCode, totpStep } from '../src/lib/totp';
import { createTestContext, makeUser, PASSWORD, signIn, type TestContext } from './helpers';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(() => ctx.close());

describe('candidate sign-up and email verification', () => {
  it('creates a signed-in, unverified candidate and verifies via the emailed link', async () => {
    const agent = ctx.agent();
    const res = await agent.post('/api/auth/signup').send({ name: 'Meera Nair', email: 'Meera@Example.com', password: PASSWORD, accept_terms: true });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'meera@example.com', kind: 'candidate', email_verified: false });
    expect(res.body.home).toBe('/app');

    const token = ctx.mailer.tokenFrom('meera@example.com', '/verify');
    expect((await ctx.agent().post('/api/auth/verify-email').send({ token })).status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user.email_verified).toBe(true);
    // Single use.
    expect((await ctx.agent().post('/api/auth/verify-email').send({ token })).body.error.code).toBe('invalid_token');
  });

  it('treats candidates as confirmed and sends no email while verification is off', async () => {
    const off = await createTestContext({ requireEmailVerification: false });
    try {
      const agent = off.agent();
      const res = await agent.post('/api/auth/signup').send({ name: 'Ravi Kumar', email: 'ravi@example.com', password: PASSWORD, accept_terms: true });
      expect(res.body.user.email_verified).toBe(true);
      expect(off.mailer.sent).toHaveLength(0);
      expect((await agent.get('/api/candidate/home')).body.email_verified).toBe(true);
      expect((await agent.post('/api/candidate/attempts').send({ consent: true })).status).toBe(201);
    } finally {
      await off.close();
    }
  });

  it('rejects a duplicate email and weak passwords', async () => {
    const dup = await ctx.agent().post('/api/auth/signup').send({ name: 'X', email: 'meera@example.com', password: PASSWORD, accept_terms: true });
    expect(dup.status).toBe(409);
    const weak = await ctx.agent().post('/api/auth/signup').send({ name: 'Y', email: 'y@example.com', password: 'short', accept_terms: true });
    expect(weak.body.error.code).toBe('validation_failed');
    const noTerms = await ctx.agent().post('/api/auth/signup').send({ name: 'Z', email: 'z@example.com', password: PASSWORD, accept_terms: false });
    expect(noTerms.status).toBe(400);
  });
});

describe('sign-in, sessions and password reset', () => {
  it('uses one generic error for unknown email and wrong password', async () => {
    const unknown = await ctx.agent().post('/api/auth/login').send({ email: 'nobody@example.com', password: PASSWORD });
    const wrong = await ctx.agent().post('/api/auth/login').send({ email: 'meera@example.com', password: 'wrong-password-123' });
    expect([unknown.status, wrong.status]).toEqual([401, 401]);
    expect(unknown.body.error.code).toBe(wrong.body.error.code);
  });

  it('sets an httpOnly SameSite=Lax session cookie and logs out', async () => {
    const agent = ctx.agent();
    const res = await agent.post('/api/auth/login').send({ email: 'meera@example.com', password: PASSWORD });
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/lokus_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect((await agent.post('/api/auth/logout')).status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('expires sessions after seven days', async () => {
    const agent = await signIn(ctx, 'meera@example.com');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    ctx.clock.advanceMinutes(7 * 24 * 60 + 1);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('resets a password through a one-hour link and signs out other sessions', async () => {
    const old = await signIn(ctx, 'meera@example.com');
    expect((await ctx.agent().post('/api/auth/forgot-password').send({ email: 'meera@example.com' })).status).toBe(200);
    expect((await ctx.agent().post('/api/auth/forgot-password').send({ email: 'ghost@example.com' })).status).toBe(200);
    const token = ctx.mailer.tokenFrom('meera@example.com', '/reset');
    const res = await ctx.agent().post('/api/auth/reset-password').send({ token, password: 'a-brand-new-password' });
    expect(res.status).toBe(200);
    expect((await old.get('/api/auth/me')).status).toBe(401);
    await signIn(ctx, 'meera@example.com', 'a-brand-new-password');
  });

  it('rejects an expired reset link', async () => {
    await ctx.agent().post('/api/auth/forgot-password').send({ email: 'meera@example.com' });
    const token = ctx.mailer.tokenFrom('meera@example.com', '/reset');
    ctx.clock.advanceMinutes(61);
    const res = await ctx.agent().post('/api/auth/reset-password').send({ token, password: 'another-password-123' });
    expect(res.body.error.code).toBe('invalid_token');
  });

  it('blocks disabled accounts', async () => {
    await makeUser(ctx, { email: 'gone@example.com', kind: 'candidate' });
    const { users } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    await ctx.deps.db.update(users).set({ disabledAt: ctx.clock.now() }).where(eq(users.email, 'gone@example.com'));
    const res = await ctx.agent().post('/api/auth/login').send({ email: 'gone@example.com', password: PASSWORD });
    expect(res.body.error.code).toBe('account_disabled');
  });

  it('blocks state-changing requests from another origin', async () => {
    const res = await ctx.agent().post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: 'meera@example.com', password: PASSWORD });
    expect(res.body.error.code).toBe('bad_origin');
    const ok = await ctx.agent().post('/api/auth/logout').set('Origin', 'http://localhost:5173');
    expect(ok.status).toBe(200);
  });
});

describe('two-step sign-in for Lokus staff', () => {
  let staffCtx: TestContext;
  beforeAll(async () => {
    staffCtx = await createTestContext({ requireStaffMfa: true });
    await makeUser(staffCtx, { email: 'admin@lokus.test', kind: 'staff', platformRole: 'admin' });
  });
  afterAll(() => staffCtx.close());

  it('requires setup, then a code at every new sign-in, and refuses replayed codes', async () => {
    const agent = await signIn(staffCtx, 'admin@lokus.test');
    expect((await agent.get('/api/auth/me')).body.user.mfa).toEqual({ required: true, enabled: false, verified: false });
    expect((await agent.get('/api/admin/orgs')).body.error.code).toBe('mfa_setup_required');

    const setup = await agent.post('/api/auth/mfa/setup');
    expect(setup.body.qr_data_url).toMatch(/^data:image\/png;base64,/);
    const secret = setup.body.secret as string;
    const now = () => staffCtx.clock.now().getTime();
    expect((await agent.post('/api/auth/mfa/enable').send({ code: '000000' })).body.error.code).toBe('invalid_code');
    expect((await agent.post('/api/auth/mfa/enable').send({ code: totpCode(secret, totpStep(now())) })).status).toBe(200);
    expect((await agent.get('/api/admin/orgs')).status).toBe(200);

    const second = await signIn(staffCtx, 'admin@lokus.test');
    expect((await second.get('/api/admin/orgs')).body.error.code).toBe('mfa_required');
    // The code used to enable is spent for this time step.
    expect((await second.post('/api/auth/mfa/verify').send({ code: totpCode(secret, totpStep(now())) })).body.error.code).toBe('invalid_code');
    staffCtx.clock.advance(30_000);
    expect((await second.post('/api/auth/mfa/verify').send({ code: totpCode(secret, totpStep(now())) })).status).toBe(200);
    expect((await second.get('/api/admin/orgs')).status).toBe(200);
  });

  it('only offers two-step setup to staff', async () => {
    await makeUser(staffCtx, { email: 'cand@example.com', kind: 'candidate' });
    const agent = await signIn(staffCtx, 'cand@example.com');
    expect((await agent.post('/api/auth/mfa/setup')).body.error.code).toBe('staff_only');
  });
});
