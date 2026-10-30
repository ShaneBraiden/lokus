// Read-only check of the database behind DATABASE_URL, e.g. the production Supabase project before or after a deploy:
//   npm run db:check -- --env=.env.supabase
import type { TLSSocket } from 'node:tls';
import pg from 'pg';
import { loadConfig } from '../config';
import { loadEnvFile } from '../lib/env';
import { databaseChecks, type CheckLine } from './check';
import { pgConnectionConfig } from './client';

// Socket failures can arrive as an AggregateError (one error per address tried) with an empty message.
const reason = (err: unknown) =>
  err instanceof AggregateError ? err.errors.map((e) => (e as Error).message).join('; ') : (err as Error).message || String(err);

let config: ReturnType<typeof loadConfig>;
try {
  loadEnvFile();
  config = loadConfig();
} catch (err) {
  console.error(reason(err));
  process.exit(1);
}
if (!config.databaseUrl) {
  console.error('DATABASE_URL is not set. Pass --env=<file> to read it from a file, e.g. --env=.env.supabase');
  process.exit(1);
}

const url = new URL(config.databaseUrl);
const client = new pg.Client({ ...pgConnectionConfig(config), connectionTimeoutMillis: 10_000 });
try {
  await client.connect();
} catch (err) {
  console.error(`Could not connect to ${url.host}: ${reason(err)}`);
  process.exit(1);
}

const lines: CheckLine[] = [];
const [info] = (await client.query<{ version: string; db: string; role: string }>(
  "select current_setting('server_version') as version, current_database() as db, current_user as role",
)).rows;
lines.push({ level: 'ok', message: `connected to ${url.host}: PostgreSQL ${info.version}, database ${info.db}, role ${info.role}` });

if (url.hostname.endsWith('.pooler.supabase.com')) {
  lines.push(
    url.port === '6543'
      ? { level: 'fail', message: 'transaction pooler (port 6543): use the session pooler (port 5432), the app holds row locks in transactions' }
      : { level: 'ok', message: 'Supabase session pooler' },
  );
}

// node-postgres keeps its socket on client.connection.stream; after the TLS upgrade it is a TLSSocket.
const socket = (client as unknown as { connection: { stream: Partial<TLSSocket> } }).connection.stream;
const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
if (!socket.encrypted) lines.push({ level: local ? 'note' : 'fail', message: 'connection is not encrypted (DATABASE_SSL=off)' });
else if (socket.authorized) lines.push({ level: 'ok', message: `${socket.getProtocol?.()}, server certificate verified` });
else lines.push({ level: 'note', message: `${socket.getProtocol?.()}, server certificate not verified (set DATABASE_SSL_CA to verify it)` });

lines.push(...(await databaseChecks(async (text) => (await client.query(text)).rows)));
await client.end();

const mark = { ok: 'ok  ', note: 'note', fail: 'FAIL' } as const;
for (const line of lines) console.log(`${mark[line.level]}  ${line.message}`);
const failed = lines.filter((l) => l.level === 'fail').length;
console.log(failed ? `\n${failed} problem${failed === 1 ? '' : 's'} found.` : '\nNo problems found.');
process.exit(failed ? 1 : 0);
