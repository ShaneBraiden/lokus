import { readFileSync } from 'node:fs';
import path from 'node:path';
import { migrationsFolder } from '../lib/paths';

export interface CheckLine {
  level: 'ok' | 'note' | 'fail';
  message: string;
}

/** Runs one read-only SQL statement and returns its rows. */
export type Query = (text: string) => Promise<Record<string, unknown>[]>;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Read-only checks of a database's state: applied migrations, row-level security (which keeps Supabase's Data API
 * closed), the confidential schema's privileges, the platform seed, and demo accounts that must never reach it.
 */
export async function databaseChecks(query: Query): Promise<CheckLine[]> {
  const rows = async <T>(text: string) => (await query(text)) as T[];
  const lines: CheckLine[] = [];
  const ok = (message: string) => lines.push({ level: 'ok', message });
  const note = (message: string) => lines.push({ level: 'note', message });
  const fail = (message: string) => lines.push({ level: 'fail', message });

  const journal = JSON.parse(readFileSync(path.join(migrationsFolder(), 'meta', '_journal.json'), 'utf8')) as { entries: unknown[] };
  const total = journal.entries.length;
  const [registered] = await rows<{ t: string | null }>("select to_regclass('drizzle.__drizzle_migrations')::text as t");
  const applied = registered.t ? (await rows<{ n: number }>('select count(*)::int as n from drizzle.__drizzle_migrations'))[0].n : 0;
  if (applied === total) ok(`migrations: ${applied} of ${total} applied`);
  else if (applied < total) note(`migrations: ${applied} of ${total} applied (the app applies the rest when it starts, or run npm run db:migrate)`);
  else note(`migrations: ${applied} applied, more than the ${total} in this checkout (the database is ahead of the code)`);

  const tables = await rows<{ name: string; rls: boolean }>(`
    select n.nspname || '.' || c.relname as name, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and n.nspname in ('public', 'confidential')
    order by 1`);
  const unprotected = tables.filter((t) => !t.rls).map((t) => t.name);
  if (unprotected.length) fail(`row-level security is off for ${unprotected.join(', ')}`);
  else if (tables.length) ok(`row-level security on all ${tables.length} tables`);

  const policies = await rows<{ name: string }>(`
    select schemaname || '.' || tablename || ' (' || policyname || ')' as name
    from pg_policies where schemaname in ('public', 'confidential')
    order by 1`);
  if (policies.length) fail(`row-level security policies expose rows to the Data API: ${policies.map((p) => p.name).join(', ')}`);
  else if (tables.length) ok("no row-level security policies, so Supabase's Data API (anon, authenticated) sees no rows");

  const roles = await rows<{ role: string; usage: boolean | null }>(`
    select rolname as role,
      case when to_regnamespace('confidential') is null then null
           else has_schema_privilege(rolname, 'confidential', 'USAGE') end as usage
    from pg_roles where rolname in ('anon', 'authenticated')
    order by 1`);
  const exposed = roles.filter((r) => r.usage).map((r) => r.role);
  if (exposed.length) fail(`${exposed.join(' and ')} can use the confidential schema (answer keys)`);
  else if (roles.some((r) => r.usage === false)) ok('the confidential schema (answer keys) is closed to anon and authenticated');

  // The remaining checks read application tables, which exist once every migration has run.
  if (applied < total) return lines;
  const [seed] = await rows<{ versions: number; packages: number; admins: number; demo: number }>(`
    select (select count(*)::int from simulation_versions) as versions,
      (select count(*)::int from scoring_packages where status = 'published') as packages,
      (select count(*)::int from users where platform_role = 'admin') as admins,
      (select count(*)::int from users where email like '%@lokus.local') as demo`);
  if (seed.versions && seed.packages) ok(`platform seeded: ${plural(seed.versions, 'simulation version')}, ${plural(seed.packages, 'published scoring package')}`);
  else note('platform not seeded yet (the app seeds it when it starts)');
  if (seed.admins) ok(plural(seed.admins, 'admin account'));
  else note('no admin account yet (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD for the first start)');
  if (seed.demo) fail(`${plural(seed.demo, 'demo account')} (@lokus.local), which use the demo password published in .env.example`);
  return lines;
}
