import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, makeUser, PASSWORD, signIn, type TestContext } from './helpers';

let ctx: TestContext;
let admin: Awaited<ReturnType<typeof signIn>>;

const form = (over: Record<string, unknown> = {}) => ({
  org_name: 'Beacon Trials',
  contact_name: 'Bea Contact',
  email: 'bea@beacon.test',
  job_title: 'Head of Talent',
  team_size: '11-50',
  hiring_needs: 'Hiring 4 CTAs this quarter.',
  accept_terms: true,
  ...over,
});

beforeAll(async () => {
  ctx = await createTestContext();
  await makeUser(ctx, { email: 'root@lokus.test', name: 'Rita Admin', kind: 'staff', platformRole: 'admin' });
  await makeUser(ctx, { email: 'cand@example.com', kind: 'candidate' });
  admin = await signIn(ctx, 'root@lokus.test');
});
afterAll(() => ctx.close());

describe('employer access requests', () => {
  it('accepts a request from the public form and blocks duplicates', async () => {
    const res = await ctx.agent().post('/api/access-requests').send(form());
    expect(res.status).toBe(201);
    expect(ctx.mailer.sent.some((m) => m.to === 'bea@beacon.test')).toBe(true);
    const dup = await ctx.agent().post('/api/access-requests').send(form({ email: 'BEA@beacon.test' }));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('request_pending');
    const taken = await ctx.agent().post('/api/access-requests').send(form({ email: 'cand@example.com' }));
    expect(taken.status).toBe(409);
  });

  it('is admin only', async () => {
    expect((await ctx.agent().get('/api/admin/access-requests')).status).toBe(401);
  });

  it('approves a request: the organisation is created and the requester is invited as owner', async () => {
    const list = await admin.get('/api/admin/access-requests?status=pending');
    expect(list.body.requests).toHaveLength(1);
    const id = list.body.requests[0].id;
    const res = await admin.post(`/api/admin/access-requests/${id}/approve`).send({});
    expect(res.status).toBe(200);
    const orgs = await admin.get('/api/admin/orgs');
    expect(orgs.body.organizations.map((o: { name: string }) => o.name)).toContain('Beacon Trials');

    const token = ctx.mailer.tokenFrom('bea@beacon.test', '/team-invite');
    const accepted = await ctx.agent().post('/api/team-invites/accept').send({ token, name: 'Bea Contact', password: PASSWORD });
    expect(accepted.status).toBeLessThan(300);

    const again = await admin.post(`/api/admin/access-requests/${id}/approve`).send({});
    expect(again.status).toBe(409);
    const after = await admin.get('/api/admin/access-requests?status=approved');
    expect(after.body.requests[0]).toMatchObject({ status: 'approved', decided_by: 'Rita Admin' });
  });

  it('rejects a request with a note emailed to the requester', async () => {
    await ctx.agent().post('/api/access-requests').send(form({ email: 'nope@spam.test', org_name: 'Spam Co' }));
    const list = await admin.get('/api/admin/access-requests?status=pending');
    const id = list.body.requests[0].id;
    const res = await admin.post(`/api/admin/access-requests/${id}/reject`).send({ note: 'We only work with clinical research organisations.' });
    expect(res.status).toBe(200);
    const mail = ctx.mailer.sent.filter((m) => m.to === 'nope@spam.test').at(-1)!;
    expect(mail.text).toContain('clinical research organisations');
  });
});
