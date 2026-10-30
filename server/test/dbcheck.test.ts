import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { databaseChecks, type Query } from '../src/db/check';
import { seedDemo } from '../src/db/seed';
import { createTestContext, type TestContext } from './helpers';

let ctx: TestContext;
let query: Query;

beforeAll(async () => {
  ctx = await createTestContext();
  query = async (text) => (await ctx.deps.db.execute(sql.raw(text))).rows;
});
afterAll(() => ctx.close());

describe('database checks (npm run db:check)', () => {
  it('pass on a migrated and seeded database', async () => {
    const lines = await databaseChecks(query);
    expect(lines.filter((l) => l.level === 'fail')).toEqual([]);
    const messages = lines.map((l) => l.message);
    expect(messages).toContainEqual(expect.stringMatching(/^migrations: (\d+) of \1 applied$/));
    expect(messages).toContainEqual(expect.stringMatching(/^row-level security on all \d+ tables$/));
    expect(messages).toContainEqual(expect.stringMatching(/^platform seeded: 1 simulation version, 1 published scoring package$/));
    expect(messages).toContainEqual(expect.stringMatching(/^no admin account yet/));
  });

  it('fail on a table without row-level security, a policy, or demo accounts', async () => {
    await ctx.deps.db.execute(sql`create table stray_notes (id int)`);
    await ctx.deps.db.execute(sql`create policy everyone on users for select using (true)`);
    await seedDemo(ctx.deps);
    const failures = (await databaseChecks(query)).filter((l) => l.level === 'fail').map((l) => l.message);
    expect(failures).toEqual([
      'row-level security is off for public.stray_notes',
      'row-level security policies expose rows to the Data API: public.users (everyone)',
      expect.stringMatching(/^4 demo accounts \(@lokus\.local\)/),
    ]);
  });
});
