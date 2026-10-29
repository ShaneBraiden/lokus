import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { consentEvents, resultShares } from '../src/db/schema';
import { allKeys, createTestContext, makeOrg, makeUser, PASSWORD, signIn, userByEmail, type TestContext } from './helpers';

let ctx: TestContext;
type Agent = Awaited<ReturnType<typeof signIn>>;
let ownerA: Agent;
let ownerB: Agent;
let ownerC: Agent;

const SCORE_KEYS = ['score', 'scores', 'rating', 'ratings', 'outcome', 'gate', 'gates', 'points', 'points_q', 'score_q', 'competencies', 'criteria', 't1_q', 't2_q'];

beforeAll(async () => {
  ctx = await createTestContext();
  await makeOrg(ctx, 'Org A', 'owner-a@example.com');
  await makeOrg(ctx, 'Org B', 'owner-b@example.com');
  await makeOrg(ctx, 'Org C', 'owner-c@example.com');
  ownerA = await signIn(ctx, 'owner-a@example.com');
  ownerB = await signIn(ctx, 'owner-b@example.com');
  ownerC = await signIn(ctx, 'owner-c@example.com');
});
afterAll(() => ctx.close());

async function invite(owner: Agent, email: string, name = 'Kiran Rao') {
  const res = await owner.post('/api/org/invitations').send({ candidates: [{ email, name }] });
  expect(res.status).toBe(201);
  return { id: res.body.results[0].id as string, token: ctx.mailer.tokenFrom(email, '/invite') };
}

const progressOf = async (owner: Agent, id: string) => (await owner.get('/api/org/invitations')).body.invitations.find((i: { id: string }) => i.id === id);

describe('candidate invitations', () => {
  let candidate: Agent;

  it('emails an invitation link that previews the organisation', async () => {
    const { token } = await invite(ownerA, 'Kiran@Example.com');
    const preview = await ctx.agent().post('/api/invites/preview').send({ token });
    expect(preview.body).toMatchObject({ org_name: 'Org A', email: 'kiran@example.com', account_exists: false });
    expect(preview.body.simulation_title).toContain('NorthrSim');
  });

  it('accepts as a new candidate: creates the account, the attempt and an invite share with consent', async () => {
    const { id, token } = await invite(ownerA, 'kiran2@example.com');
    candidate = ctx.agent();
    const missing = await candidate.post('/api/invites/accept').send({ token, consent: true });
    expect(missing.body.error.code).toBe('account_details_required');
    const res = await candidate.post('/api/invites/accept').send({ token, consent: true, name: 'Kiran Two', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ shared: true, share_request_id: null, org_name: 'Org A' });

    const me = await candidate.get('/api/auth/me');
    expect(me.body.user).toMatchObject({ kind: 'candidate', email_verified: true });
    const home = await candidate.get('/api/candidate/home');
    expect(home.body.attempts).toHaveLength(1);
    expect(home.body.attempts[0]).toMatchObject({ org_name: 'Org A', status: 'not_started', status_label: 'Not started', origin: 'invite' });
    expect([...allKeys(home.body)].filter((k) => SCORE_KEYS.includes(k))).toEqual([]);

    const user = await userByEmail(ctx, 'kiran2@example.com');
    const consents = await ctx.deps.db.select().from(consentEvents).where(and(eq(consentEvents.userId, user.id), eq(consentEvents.kind, 'result_share')));
    expect(consents).toHaveLength(1);
    expect(await progressOf(ownerA, id)).toMatchObject({ status: 'accepted', progress: 'Not started' });
    expect((await progressOf(ownerA, id)).attempt_id).toBeTruthy();
  });

  it('turns a second employer’s invitation into a share request that looks like a fresh invite until approved', async () => {
    const { id, token } = await invite(ownerB, 'kiran2@example.com');
    expect((await ctx.agent().post('/api/invites/accept').send({ token, consent: true })).body.error.code).toBe('login_required');
    const res = await candidate.post('/api/invites/accept').send({ token, consent: true });
    expect(res.body).toMatchObject({ shared: false });
    expect(res.body.share_request_id).toBeTruthy();

    const pending = await progressOf(ownerB, id);
    expect(pending).toMatchObject({ status: 'accepted', progress: 'Not started', attempt_id: null });

    const requests = await candidate.get('/api/candidate/share-requests');
    expect(requests.body.share_requests[0]).toMatchObject({ org_name: 'Org B', status: 'pending' });
    expect((await candidate.post(`/api/candidate/share-requests/${res.body.share_request_id}/approve`)).status).toBe(200);
    expect((await candidate.post(`/api/candidate/share-requests/${res.body.share_request_id}/approve`)).body.error.code).toBe('already_decided');
    expect((await progressOf(ownerB, id)).attempt_id).toBeTruthy();
    const shares = await ctx.deps.db.select().from(resultShares).where(eq(resultShares.basis, 'reuse_consent'));
    expect(shares).toHaveLength(1);
  });

  it('shows a declined request as withdrawn', async () => {
    const { id, token } = await invite(ownerC, 'kiran2@example.com');
    const res = await candidate.post('/api/invites/accept').send({ token, consent: true });
    expect((await candidate.post(`/api/candidate/share-requests/${res.body.share_request_id}/decline`)).status).toBe(200);
    expect(await progressOf(ownerC, id)).toMatchObject({ progress: 'Withdrawn', attempt_id: null });
  });

  it('lets the candidate revoke an employer’s access later', async () => {
    const privacy = await candidate.get('/api/candidate/privacy');
    const shareB = privacy.body.shares.find((s: { org_name: string }) => s.org_name === 'Org B');
    expect((await candidate.post(`/api/candidate/shares/${shareB.id}/revoke`)).status).toBe(200);
    const after = await candidate.get('/api/candidate/privacy');
    expect(after.body.shares.find((s: { id: string }) => s.id === shareB.id).revoked_at).toBeTruthy();
  });

  it('refuses employer and staff accounts as candidates', async () => {
    const { token } = await invite(ownerA, 'owner-b@example.com');
    expect((await ownerB.post('/api/invites/accept').send({ token, consent: true })).body.error.code).toBe('not_a_candidate_account');
  });

  it('reports bulk results, including duplicates and existing invitations', async () => {
    const res = await ownerA.post('/api/org/invitations').send({
      candidates: [{ email: 'bulk1@example.com' }, { email: 'BULK1@example.com' }, { email: 'kiran2@example.com' }, { email: 'bulk2@example.com', name: 'Bulk Two' }],
    });
    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual(['invited', 'duplicate_in_batch', 'already_invited', 'invited']);
  });

  it('withdraws revoked links and expires old ones', async () => {
    const revoked = await invite(ownerA, 'revoked@example.com');
    expect((await ownerA.post(`/api/org/invitations/${revoked.id}/revoke`)).status).toBe(200);
    expect((await ctx.agent().post('/api/invites/preview').send({ token: revoked.token })).body.error.code).toBe('invitation_revoked');

    const old = await invite(ownerA, 'late@example.com');
    ctx.clock.advanceMinutes(31 * 24 * 60);
    expect((await ctx.agent().post('/api/invites/preview').send({ token: old.token })).body.error.code).toBe('invitation_expired');
    // Resending issues a fresh link (the owner's 7-day session expired during the jump, so sign in again).
    ownerA = await signIn(ctx, 'owner-a@example.com');
    expect((await ownerA.post(`/api/org/invitations/${old.id}/resend`)).status).toBe(200);
    const fresh = ctx.mailer.tokenFrom('late@example.com', '/invite');
    expect((await ctx.agent().post('/api/invites/preview').send({ token: fresh })).status).toBe(200);
  });
});

describe('self-sign-up attempts and the talent pool', () => {
  it('requires a verified email and allows one attempt per simulation version', async () => {
    await makeUser(ctx, { email: 'self@example.com', kind: 'candidate', verified: false });
    const agent = await signIn(ctx, 'self@example.com');
    expect((await agent.post('/api/candidate/attempts').send({ consent: true })).body.error.code).toBe('email_unverified');
    await agent.post('/api/auth/resend-verification');
    const token = ctx.mailer.tokenFrom('self@example.com', '/verify');
    await ctx.agent().post('/api/auth/verify-email').send({ token });
    expect((await agent.post('/api/candidate/attempts').send({ consent: true })).status).toBe(201);
    expect((await agent.post('/api/candidate/attempts').send({ consent: true })).body.error.code).toBe('attempt_exists');
  });

  it('records every talent-pool opt-in and opt-out as a consent event', async () => {
    const agent = await signIn(ctx, 'self@example.com');
    expect((await agent.get('/api/candidate/privacy')).body.talent_pool).toMatchObject({ listed: false, eligible: true });
    await agent.put('/api/candidate/talent-pool').send({ listed: true });
    await agent.put('/api/candidate/talent-pool').send({ listed: false });
    await agent.put('/api/candidate/talent-pool').send({ listed: true });
    expect((await agent.get('/api/candidate/privacy')).body.talent_pool.listed).toBe(true);
    const user = await userByEmail(ctx, 'self@example.com');
    const rows = await ctx.deps.db.select().from(consentEvents).where(and(eq(consentEvents.userId, user.id), eq(consentEvents.kind, 'talent_pool')));
    expect(rows.map((r) => r.action)).toEqual(['grant', 'withdraw', 'grant']);
  });

  it('blocks a self-start when the candidate already holds an invited attempt', async () => {
    const agent = await signIn(ctx, 'kiran2@example.com');
    expect((await agent.post('/api/candidate/attempts').send({ consent: true })).body.error.code).toBe('attempt_exists');
  });
});
