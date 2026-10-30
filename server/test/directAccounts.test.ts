import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, makeOrg, makeUser, signIn, type TestContext } from './helpers';

const DEFAULT_PASSWORD = 'Lokus@2026';

let ctx: TestContext;
type Agent = Awaited<ReturnType<typeof signIn>>;
let owner: Agent;
let admin: Agent;

beforeAll(async () => {
  ctx = await createTestContext({ directAccounts: true, defaultAccountPassword: DEFAULT_PASSWORD });
  await makeOrg(ctx, 'Org Direct', 'owner-direct@example.com');
  await makeUser(ctx, { email: 'admin-direct@example.com', kind: 'staff', platformRole: 'admin' });
  owner = await signIn(ctx, 'owner-direct@example.com');
  admin = await signIn(ctx, 'admin-direct@example.com');
});
afterAll(() => ctx.close());

describe('direct accounts (testing phase)', () => {
  it('invites a candidate without email: the account exists with the default password and the attempt is shared', async () => {
    const res = await owner.post('/api/org/invitations').send({ candidates: [{ email: 'Cand@Example.com', name: 'Cand One' }] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ results: [{ status: 'invited' }], default_password: DEFAULT_PASSWORD });
    expect(ctx.mailer.sent).toHaveLength(0);

    const candidate = await signIn(ctx, 'cand@example.com', DEFAULT_PASSWORD);
    const home = await candidate.get('/api/candidate/home');
    expect(home.body.attempts).toHaveLength(1);
    expect(home.body.attempts[0]).toMatchObject({ org_name: 'Org Direct', origin: 'invite' });
    const list = await owner.get('/api/org/invitations');
    expect(list.body.invitations[0]).toMatchObject({ status: 'accepted' });
  });

  it('adds a team member straight away', async () => {
    const res = await owner.post('/api/org/members/invite').send({ email: 'recruiter-direct@example.com', role: 'recruiter' });
    expect(res.status).toBe(201);
    const recruiter = await signIn(ctx, 'recruiter-direct@example.com', DEFAULT_PASSWORD);
    const me = await recruiter.get('/api/auth/me');
    expect(me.body.org).toMatchObject({ name: 'Org Direct', role: 'recruiter' });
    expect(me.body.direct_accounts).toBe(true);
  });

  it('creates an organisation whose owner can sign in, and staff accounts with the default password', async () => {
    const org = await admin.post('/api/admin/orgs').send({ name: 'New Org', owner_email: 'new-owner@example.com' });
    expect(org.body.default_password).toBe(DEFAULT_PASSWORD);
    const newOwner = await signIn(ctx, 'new-owner@example.com', DEFAULT_PASSWORD);
    expect((await newOwner.get('/api/auth/me')).body.org).toMatchObject({ name: 'New Org', role: 'owner' });

    const staff = await admin.post('/api/admin/staff').send({ email: 'assessor-direct@example.com', name: 'Asa', role: 'assessor' });
    expect(staff.status).toBe(201);
    await signIn(ctx, 'assessor-direct@example.com', DEFAULT_PASSWORD);
    expect(ctx.mailer.sent).toHaveLength(0);
  });
});
