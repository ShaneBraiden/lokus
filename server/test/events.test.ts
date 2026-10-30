import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { ev } from '#engine';
import { attemptEvents, attempts, scoringPackages } from '../src/db/schema';
import { SIMULATION_VERSION_ID } from '../src/db/seed';
import { createAttempt } from '../src/services/attempts';
import { appendEvents, listEvents, verifyChain, withAttemptLock } from '../src/services/eventStore';
import { createTestContext, makeUser, type TestContext } from './helpers';

let ctx: TestContext;
let attemptId: string;

beforeAll(async () => {
  ctx = await createTestContext();
  const candidate = await makeUser(ctx, { email: 'events@example.com', kind: 'candidate' });
  const attempt = await ctx.deps.db.transaction((tx) => createAttempt(tx, { candidateId: candidate.id, simulationVersionId: SIMULATION_VERSION_ID, origin: 'self' }));
  attemptId = attempt.id;
});
afterAll(() => ctx.close());

const append = (drafts = [ev.recordOpened('AHS-007-DM-206')]) => withAttemptLock(ctx.deps.db, attemptId, (tx, attempt) => appendEvents(tx, ctx.clock, attempt, drafts));

async function rejects(statement: Promise<unknown>) {
  let error: unknown = null;
  try {
    await statement;
  } catch (e) {
    error = e;
  }
  expect(error, 'statement should have been rejected').not.toBeNull();
  return String((error as { cause?: Error })?.cause?.message ?? (error as Error).message);
}

describe('append-only evidence log', () => {
  it('appends with authoritative server time, gapless sequence and a valid hash chain', async () => {
    const rows = await append([ev.taskStarted('T1'), ev.instructionViewed('skip_s4'), ev.recordOpened('AHS-007-DM-206')]);
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3]);
    expect(rows.every((r) => r.serverTs.getTime() === ctx.clock.now().getTime())).toBe(true);
    expect(await verifyChain(ctx.deps.db, attemptId)).toEqual({ ok: true, length: 3 });
  });

  it('refuses UPDATE, DELETE and TRUNCATE on events', async () => {
    expect(await rejects(ctx.deps.db.update(attemptEvents).set({ eventType: 'tampered' }).where(eq(attemptEvents.attemptId, attemptId)))).toMatch(/append-only/);
    expect(await rejects(ctx.deps.db.delete(attemptEvents).where(eq(attemptEvents.attemptId, attemptId)))).toMatch(/append-only/);
    expect(await rejects(ctx.deps.db.execute(sql`truncate table attempt_events`))).toMatch(/append-only/);
    expect((await listEvents(ctx.deps.db, attemptId)).length).toBe(3);
  });

  it('assigns gapless sequence numbers under 50 concurrent appends', async () => {
    const before = (await listEvents(ctx.deps.db, attemptId)).length;
    await Promise.all(Array.from({ length: 50 }, (_, i) => append([ev.recordOpened(`P-${i}`)])));
    const rows = await listEvents(ctx.deps.db, attemptId);
    expect(rows.map((r) => r.seq)).toEqual(Array.from({ length: before + 50 }, (_, i) => i + 1));
    expect(new Set(rows.map((r) => r.eventId)).size).toBe(rows.length);
    expect((await verifyChain(ctx.deps.db, attemptId)).ok).toBe(true);
  });

  it('detects tampering through the hash chain (trigger disabled only for this check)', async () => {
    await ctx.deps.db.execute(sql`alter table attempt_events disable trigger attempt_events_append_only`);
    await ctx.deps.db.update(attemptEvents).set({ objectId: 'AHS-007-DM-220' }).where(sql`${attemptEvents.attemptId} = ${attemptId} and ${attemptEvents.seq} = 2`);
    await ctx.deps.db.execute(sql`alter table attempt_events enable trigger attempt_events_append_only`);
    expect(await verifyChain(ctx.deps.db, attemptId)).toEqual({ ok: false, brokenAtSeq: 2 });
  });

  it('locks a task once it has been submitted', async () => {
    await ctx.deps.db.update(attempts).set({ t1SubmittedAt: ctx.clock.now() }).where(eq(attempts.id, attemptId));
    const err = await withAttemptLock(ctx.deps.db, attemptId, (tx, a) => appendEvents(tx, ctx.clock, a, [ev.recordOpened('AHS-007-DM-206')])).catch((e) => e);
    expect(err).toMatchObject({ status: 409, code: 'task_locked' });
    // Workday 2 events are still accepted.
    await expect(withAttemptLock(ctx.deps.db, attemptId, (tx, a) => appendEvents(tx, ctx.clock, a, [ev.taskStarted('T2')]))).resolves.toHaveLength(1);
  });
});

describe('scoring package integrity', () => {
  it('refuses changes to a published package and its answer key', async () => {
    expect(await rejects(ctx.deps.db.update(scoringPackages).set({ parameters: { BAND_MEETS: 50 } }).where(eq(scoringPackages.id, 'v1.1-sme-draft-1')))).toMatch(/immutable/);
    expect(await rejects(ctx.deps.db.execute(sql`update confidential.answer_keys set key = '[]'::jsonb`))).toMatch(/immutable/);
    expect(await rejects(ctx.deps.db.delete(scoringPackages).where(eq(scoringPackages.id, 'v1.1-sme-draft-1')))).toMatch(/cannot be deleted/);
  });

  it('records the passing regression run that published the default package', async () => {
    const [pkg] = await ctx.deps.db.select().from(scoringPackages).where(eq(scoringPackages.id, 'v1.1-sme-draft-1'));
    expect(pkg.status).toBe('published');
    expect(pkg.regressionRunId).toBeTruthy();
  });
});

describe('row-level security', () => {
  it('is enabled on every application table (closes the Supabase Data API)', async () => {
    const res = await ctx.deps.db.execute(sql`
      select n.nspname || '.' || c.relname as name, c.relrowsecurity as rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname in ('public', 'confidential')`);
    const rows = res.rows as { name: string; rls: boolean }[];
    expect(rows.length).toBeGreaterThanOrEqual(25);
    expect(rows.filter((r) => !r.rls).map((r) => r.name)).toEqual([]);
  });
});
