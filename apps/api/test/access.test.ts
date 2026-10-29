import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, makeOrg, makeUser, signIn, type TestContext } from './helpers';

let ctx: TestContext;
type Agent = Awaited<ReturnType<typeof signIn>>;
const agents: Record<string, Agent> = {};

beforeAll(async () => {
  ctx = await createTestContext();
  await makeUser(ctx, { email: 'cand@example.com', kind: 'candidate' });
  await makeOrg(ctx, 'Org A', 'owner-a@example.com', 'recruiter-a@example.com');
  await makeOrg(ctx, 'Org B', 'owner-b@example.com');
  await makeUser(ctx, { email: 'assessor@lokus.test', kind: 'staff', platformRole: 'assessor' });
  await makeUser(ctx, { email: 'admin@lokus.test', kind: 'staff', platformRole: 'admin' });
  agents.anon = ctx.agent();
  agents.candidate = await signIn(ctx, 'cand@example.com');
  agents.owner = await signIn(ctx, 'owner-a@example.com');
  agents.recruiter = await signIn(ctx, 'recruiter-a@example.com');
  agents.ownerB = await signIn(ctx, 'owner-b@example.com');
  agents.assessor = await signIn(ctx, 'assessor@lokus.test');
  agents.admin = await signIn(ctx, 'admin@lokus.test');
});
afterAll(() => ctx.close());

// route → expected status per role (anon, candidate, owner, recruiter, assessor, admin)
const MATRIX: [string, string, Record<string, number>, object?][] = [
  ['GET', '/api/candidate/home', { anon: 401, candidate: 200, owner: 403, recruiter: 403, assessor: 403, admin: 403 }],
  ['GET', '/api/candidate/privacy', { anon: 401, candidate: 200, owner: 403, recruiter: 403, assessor: 403, admin: 403 }],
  ['GET', '/api/org', { anon: 401, candidate: 403, owner: 200, recruiter: 200, assessor: 403, admin: 403 }],
  ['GET', '/api/org/members', { anon: 401, candidate: 403, owner: 200, recruiter: 200, assessor: 403, admin: 403 }],
  ['GET', '/api/org/invitations', { anon: 401, candidate: 403, owner: 200, recruiter: 200, assessor: 403, admin: 403 }],
  ['PATCH', '/api/org', { anon: 401, candidate: 403, owner: 200, recruiter: 403, assessor: 403, admin: 403 }, { invite_deadline_days: 21 }],
  ['GET', '/api/admin/orgs', { anon: 401, candidate: 403, owner: 403, recruiter: 403, assessor: 403, admin: 200 }],
  ['GET', '/api/admin/users', { anon: 401, candidate: 403, owner: 403, recruiter: 403, assessor: 403, admin: 200 }],
  ['GET', '/api/admin/audit', { anon: 401, candidate: 403, owner: 403, recruiter: 403, assessor: 403, admin: 200 }],
];

describe('authorisation matrix (route × role)', () => {
  for (const [method, path, expected, body] of MATRIX) {
    for (const [role, status] of Object.entries(expected)) {
      it(`${method} ${path} as ${role} → ${status}`, async () => {
        const a = agents[role];
        const req = method === 'GET' ? a.get(path) : method === 'PATCH' ? a.patch(path).send(body ?? {}) : a.post(path).send(body ?? {});
        expect((await req).status).toBe(status);
      });
    }
  }
});

describe('tenant isolation between organisations', () => {
  let inviteA: string;
  beforeAll(async () => {
    const res = await agents.owner.post('/api/org/invitations').send({ candidates: [{ email: 'shared@example.com', name: 'Shared Candidate' }] });
    expect(res.status).toBe(201);
    inviteA = res.body.results[0].id;
  });

  it('lists only the caller organisation’s invitations', async () => {
    const b = await agents.ownerB.get('/api/org/invitations');
    expect(b.body.invitations).toEqual([]);
    const a = await agents.recruiter.get('/api/org/invitations');
    expect(a.body.invitations.map((i: { id: string }) => i.id)).toContain(inviteA);
  });

  it('cannot resend or revoke another organisation’s invitation', async () => {
    expect((await agents.ownerB.post(`/api/org/invitations/${inviteA}/resend`)).status).toBe(404);
    expect((await agents.ownerB.post(`/api/org/invitations/${inviteA}/revoke`)).status).toBe(404);
  });

  it('cannot see another organisation’s members', async () => {
    const b = await agents.ownerB.get('/api/org/members');
    const emails = b.body.members.map((m: { email: string }) => m.email);
    expect(emails).toEqual(['owner-b@example.com']);
  });

  it('lets only owners invite team members', async () => {
    expect((await agents.recruiter.post('/api/org/members/invite').send({ email: 'new@example.com', role: 'recruiter' })).body.error.code).toBe('owner_only');
    expect((await agents.owner.post('/api/org/members/invite').send({ email: 'new@example.com', role: 'recruiter' })).status).toBe(201);
  });

  it('suspending an organisation locks its team out', async () => {
    const orgs = await agents.admin.get('/api/admin/orgs');
    const orgB = orgs.body.organizations.find((o: { name: string }) => o.name === 'Org B');
    expect((await agents.admin.patch(`/api/admin/orgs/${orgB.id}`).send({ status: 'suspended' })).status).toBe(200);
    expect((await agents.ownerB.get('/api/org')).body.error.code).toBe('organization_suspended');
    await agents.admin.patch(`/api/admin/orgs/${orgB.id}`).send({ status: 'active' });
    expect((await agents.ownerB.get('/api/org')).status).toBe(200);
  });
});

describe('admin onboarding', () => {
  it('creates an organisation and emails its first owner, who joins with a new account', async () => {
    const res = await agents.admin.post('/api/admin/orgs').send({ name: 'Acme Trials', owner_email: 'boss@acme.example' });
    expect(res.status).toBe(201);
    const token = ctx.mailer.tokenFrom('boss@acme.example', '/team-invite');
    const preview = await ctx.agent().post('/api/team-invites/preview').send({ token });
    expect(preview.body).toMatchObject({ org_name: 'Acme Trials', role: 'owner', account_exists: false });
    const owner = ctx.agent();
    expect((await owner.post('/api/team-invites/accept').send({ token, name: 'Boss', password: 'boss-password-123' })).status).toBe(200);
    const me = await owner.get('/api/auth/me');
    expect(me.body).toMatchObject({ home: '/org', org: { name: 'Acme Trials', role: 'owner' } });
    // Single use.
    expect((await ctx.agent().post('/api/team-invites/preview').send({ token })).status).toBe(410);
  });

  it('creates staff accounts with a set-password email and writes the audit log', async () => {
    const res = await agents.admin.post('/api/admin/staff').send({ email: 'rater@lokus.test', name: 'Rita Rater', role: 'assessor' });
    expect(res.status).toBe(201);
    const token = ctx.mailer.tokenFrom('rater@lokus.test', '/reset');
    expect((await ctx.agent().post('/api/auth/reset-password').send({ token, password: 'rater-password-123' })).status).toBe(200);
    const me = await (await signIn(ctx, 'rater@lokus.test', 'rater-password-123')).get('/api/auth/me');
    expect(me.body.user).toMatchObject({ kind: 'staff', platform_role: 'assessor', email_verified: true });
    const log = await agents.admin.get('/api/admin/audit');
    const actions = log.body.entries.map((e: { action: string }) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['staff.created', 'org.created', 'invitation.created']));
  });

  it('stops an admin from disabling their own account', async () => {
    const me = await agents.admin.get('/api/auth/me');
    expect((await agents.admin.patch(`/api/admin/users/${me.body.user.id}`).send({ disabled: true })).body.error.code).toBe('self_lockout');
  });
});
