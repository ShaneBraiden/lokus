import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, makeOrg, makeUser, signIn, type TestContext } from './helpers';

const DEFAULT_PASSWORD = 'Lokus@2026';

let ctx: TestContext;
type Agent = Awaited<ReturnType<typeof signIn>>;
let owner: Agent;
let admin: Agent;

/** Follows the confirmation link emailed to `email`. */
async function confirmEmail(email: string) {
  const token = ctx.mailer.tokenFrom(email, '/verify');
  expect((await ctx.agent().post('/api/auth/verify-email').send({ token })).status).toBe(200);
}

function templatesTo(email: string) {
  return ctx.mailer.sent.filter((m) => m.to === email).map((m) => m.template);
}

beforeAll(async () => {
  ctx = await createTestContext({ directAccounts: true, defaultAccountPassword: DEFAULT_PASSWORD });
  await makeOrg(ctx, 'Org Direct', 'owner-direct@example.com');
  await makeUser(ctx, { email: 'admin-direct@example.com', kind: 'staff', platformRole: 'admin' });
  owner = await signIn(ctx, 'owner-direct@example.com');
  admin = await signIn(ctx, 'admin-direct@example.com');
});
afterAll(() => ctx.close());

describe('direct accounts (testing phase)', () => {
  it('invites a candidate without an invitation email: the account exists with the default password and the attempt is shared', async () => {
    const res = await owner.post('/api/org/invitations').send({ candidates: [{ email: 'Cand@Example.com', name: 'Cand One' }] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ results: [{ status: 'invited' }], default_password: DEFAULT_PASSWORD });
    expect(templatesTo('cand@example.com')).toEqual(['verify_email']);

    const candidate = await signIn(ctx, 'cand@example.com', DEFAULT_PASSWORD);
    const home = await candidate.get('/api/candidate/home');
    expect(home.body.email_verified).toBe(false);
    expect(home.body.attempts).toHaveLength(1);
    expect(home.body.attempts[0]).toMatchObject({ org_name: 'Org Direct', origin: 'invite' });
    const list = await owner.get('/api/org/invitations');
    expect(list.body.invitations[0]).toMatchObject({ status: 'accepted' });

    // The simulation opens only once the email is confirmed.
    const state = `/api/attempts/${home.body.attempts[0].id}/state`;
    expect((await candidate.get(state)).body.error.code).toBe('email_unverified');
    await confirmEmail('cand@example.com');
    expect((await candidate.get(state)).status).toBe(200);
  });

  it('adds a team member straight away, who confirms their email before using the dashboard', async () => {
    const res = await owner.post('/api/org/members/invite').send({ email: 'recruiter-direct@example.com', role: 'recruiter' });
    expect(res.status).toBe(201);
    expect(templatesTo('recruiter-direct@example.com')).toEqual(['verify_email']);
    const recruiter = await signIn(ctx, 'recruiter-direct@example.com', DEFAULT_PASSWORD);
    const me = await recruiter.get('/api/auth/me');
    expect(me.body.org).toMatchObject({ name: 'Org Direct', role: 'recruiter' });
    expect(me.body.direct_accounts).toBe(true);
    expect(me.body.user.email_verified).toBe(false);

    expect((await recruiter.get('/api/org/overview')).body.error.code).toBe('email_unverified');
    await recruiter.post('/api/auth/resend-verification');
    expect(templatesTo('recruiter-direct@example.com')).toEqual(['verify_email', 'verify_email']);
    await confirmEmail('recruiter-direct@example.com');
    expect((await recruiter.get('/api/org/overview')).status).toBe(200);
  });

  it('creates an organisation whose owner can sign in, and staff accounts with the default password', async () => {
    const org = await admin.post('/api/admin/orgs').send({ name: 'New Org', owner_email: 'new-owner@example.com' });
    expect(org.body.default_password).toBe(DEFAULT_PASSWORD);
    const newOwner = await signIn(ctx, 'new-owner@example.com', DEFAULT_PASSWORD);
    expect((await newOwner.get('/api/auth/me')).body.org).toMatchObject({ name: 'New Org', role: 'owner' });
    expect(templatesTo('new-owner@example.com')).toEqual(['verify_email']);

    const staff = await admin.post('/api/admin/staff').send({ email: 'assessor-direct@example.com', name: 'Asa', role: 'assessor' });
    expect(staff.status).toBe(201);
    expect(templatesTo('assessor-direct@example.com')).toEqual(['verify_email']);
    const assessor = await signIn(ctx, 'assessor-direct@example.com', DEFAULT_PASSWORD);
    expect((await assessor.get('/api/review/queue')).body.error.code).toBe('email_unverified');
    await confirmEmail('assessor-direct@example.com');
    expect((await assessor.get('/api/review/queue')).body.error?.code).not.toBe('email_unverified');
  });

  it('confirms new accounts straight away and sends nothing while verification is off', async () => {
    const off = await createTestContext({ directAccounts: true, defaultAccountPassword: DEFAULT_PASSWORD, requireEmailVerification: false });
    try {
      await makeOrg(off, 'Org Off', 'owner-off@example.com');
      const offOwner = await signIn(off, 'owner-off@example.com');
      await offOwner.post('/api/org/invitations').send({ candidates: [{ email: 'cand-off@example.com', name: 'Cand Off' }] });
      await offOwner.post('/api/org/members/invite').send({ email: 'recruiter-off@example.com', role: 'recruiter' });
      expect(off.mailer.sent).toHaveLength(0);
      const recruiter = await signIn(off, 'recruiter-off@example.com', DEFAULT_PASSWORD);
      expect((await recruiter.get('/api/org/overview')).status).toBe(200);
    } finally {
      await off.close();
    }
  });
});
