import pino from 'pino';
import type { ScenarioAction } from '@lokus/engine';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app';
import { testConfig, type AppConfig } from '../src/config';
import type { AppDeps } from '../src/context';
import { openDatabase } from '../src/db/client';
import { candidateProfiles, memberships, organizations, users } from '../src/db/schema';
import { seedPlatform } from '../src/db/seed';
import { FakeClock } from '../src/lib/clock';
import { hashPassword, setPasswordHashCost } from '../src/lib/crypto';
import { MemoryMailer } from '../src/lib/mailer';

// Fast password hashing for tests (hashes record their own parameters).
setPasswordHashCost({ N: 1024, r: 8, p: 1 });

export const PASSWORD = 'correct-horse-battery';

export interface TestContext {
  deps: AppDeps;
  app: ReturnType<typeof createApp>;
  clock: FakeClock;
  mailer: MemoryMailer;
  agent: () => ReturnType<typeof request.agent>;
  close: () => Promise<void>;
}

/** A fresh in-memory PGlite database with all migrations and the platform seed, a FakeClock and a MemoryMailer. */
export async function createTestContext(overrides: Partial<AppConfig> = {}): Promise<TestContext> {
  const config = testConfig(overrides);
  const handle = await openDatabase(config);
  await handle.migrate();
  const clock = new FakeClock();
  const mailer = new MemoryMailer();
  const deps: AppDeps = { config, db: handle.db, clock, mailer, log: pino({ level: 'silent' }) };
  await seedPlatform(deps);
  const app = createApp(deps);
  return { deps, app, clock, mailer, agent: () => request.agent(app), close: () => handle.close() };
}

export async function makeUser(
  ctx: TestContext,
  u: { email: string; name?: string; kind: 'candidate' | 'employer' | 'staff'; platformRole?: 'admin' | 'assessor'; verified?: boolean },
) {
  const [user] = await ctx.deps.db
    .insert(users)
    .values({
      email: u.email.toLowerCase(),
      name: u.name ?? u.email.split('@')[0],
      kind: u.kind,
      platformRole: u.platformRole ?? null,
      passwordHash: await hashPassword(PASSWORD),
      emailVerifiedAt: u.verified === false ? null : ctx.clock.now(),
    })
    .returning();
  if (u.kind === 'candidate') await ctx.deps.db.insert(candidateProfiles).values({ userId: user.id });
  return user;
}

export async function makeOrg(ctx: TestContext, name: string, ownerEmail: string, recruiterEmail?: string) {
  const owner = await makeUser(ctx, { email: ownerEmail, kind: 'employer' });
  const [org] = await ctx.deps.db.insert(organizations).values({ name, slug: name.toLowerCase().replace(/\W+/g, '-') }).returning();
  await ctx.deps.db.insert(memberships).values({ userId: owner.id, orgId: org.id, role: 'owner' });
  let recruiter: typeof owner | null = null;
  if (recruiterEmail) {
    recruiter = await makeUser(ctx, { email: recruiterEmail, kind: 'employer' });
    await ctx.deps.db.insert(memberships).values({ userId: recruiter.id, orgId: org.id, role: 'recruiter' });
  }
  return { org, owner, recruiter };
}

export async function signIn(ctx: TestContext, email: string, password = PASSWORD) {
  const agent = ctx.agent();
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export async function userByEmail(ctx: TestContext, email: string) {
  const [u] = await ctx.deps.db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return u;
}

/** Recursively collects object keys; used to prove candidate responses carry no scoring fields. */
export function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}

/** Drives one scripted action through the real player API. */
export function perform(agent: ReturnType<typeof request.agent>, base: string, a: ScenarioAction) {
  switch (a.kind) {
    case 'task_start':
      return agent.post(`${base}/tasks/${a.task}/start`);
    case 'view_briefing':
      return agent.get(`${base}/t1/briefing`);
    case 'open_record':
      return agent.get(`${base}/t1/participants/${a.participant_id}`);
    case 'open_section':
      return agent.get(`${base}/documents/${a.document_id}/sections/${a.section_id}`);
    case 'create_finding': {
      const { id: _id, ...f } = a.finding;
      return agent.post(`${base}/t1/findings`).send(f);
    }
    case 'modify_finding': {
      const { id: _id, target: _t, ...f } = a.finding;
      return agent.patch(`${base}/t1/findings/${a.ref}`).send({ ...f, version: a.version - 1 });
    }
    case 'withdraw_finding':
      return agent.post(`${base}/t1/findings/${a.ref}/withdraw`);
    case 'no_deviation':
      return agent.put(`${base}/t1/participants/${a.participant_id}/no-deviation`).send({ recorded: a.recorded });
    case 'escalate_t1':
      return agent.post(`${base}/t1/escalations`).send({ participant_id: a.target_participant_id, to: a.to, cc: a.cc, visit: a.visit, fields: a.fields, facts: a.facts, requested_action: a.requested_action });
    case 'clarification':
      return agent.post(`${base}/t1/notes`).send({ to: a.to, subject: a.subject, text: a.text });
    case 'edit_start':
      return agent.post(`${base}/t1/edits/start`).send(a.cell);
    case 'edit_cancel':
      return agent.post(`${base}/t1/edits/cancel`).send({ ...a.cell, draft_changed: a.changed });
    case 'edit_commit':
      return agent.post(`${base}/t1/edits/commit`).send({ ...a.cell, value: a.to });
    case 'edit_revert':
      return agent.post(`${base}/t1/edits/revert`).send(a.cell);
    case 'recommend_correction':
      return agent.post(`${base}/t1/corrections`).send({ ...a.cell, proposed: a.proposed, rationale: a.rationale });
    case 'task_submit':
      return agent.post(`${base}/tasks/${a.task}/submit`);
    case 'open_email':
      return agent.get(`${base}/t2/emails/${a.email_id}`);
    case 'decide':
      return agent.put(`${base}/t2/decisions/${a.decision}`).send({ value: a.value });
    case 'reply':
      return agent.post(`${base}/t2/reply`).send({ to: a.to, cc: a.cc, subject: a.subject, body: a.body });
    case 'escalate_t2':
      return agent.post(`${base}/t2/messages`).send({ to: a.to, cc: a.cc, subject: a.subject, body: a.body });
    case 'record':
      return agent.put(`${base}/t2/record/${a.request}`).send({ summary: a.summary, status: a.status, owner: a.owner, next_step: a.next_step, date: a.date });
    case 'narrative':
      return agent.put(`${base}/t2/narrative`).send({ narrative: a.text });
  }
}
