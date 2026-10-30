import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';
import type { AppConfig } from '../config';
import { migrationsFolder } from '../lib/paths';
import * as schema from './schema';

/** Both drivers expose the same Drizzle query API; PGlite handles are typed as the node-postgres database. */
export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;

export interface DbHandle {
  db: Db;
  driver: 'pg' | 'pglite';
  migrate(): Promise<void>;
  close(): Promise<void>;
}

export interface OpenOptions {
  /** Called when an idle pooled connection fails (e.g. the pooler restarts). Without a listener the process would crash. */
  onError?: (err: Error) => void;
}

function connectionStringWithoutSslParams(url: string): string {
  const u = new URL(url);
  for (const p of ['sslmode', 'ssl', 'sslrootcert', 'uselibpqcompat']) u.searchParams.delete(p);
  return u.toString();
}

/** node-postgres settings for DATABASE_URL: TLS per DATABASE_SSL, checked against DATABASE_SSL_CA when one is given. */
export function pgConnectionConfig(config: Pick<AppConfig, 'databaseUrl' | 'databaseSsl' | 'databaseSslCa'>): pg.ClientConfig {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not set');
  const ssl =
    config.databaseSsl === 'off'
      ? undefined
      : { rejectUnauthorized: config.databaseSsl === 'verify', ...(config.databaseSslCa ? { ca: config.databaseSslCa } : {}) };
  return { connectionString: connectionStringWithoutSslParams(config.databaseUrl), ssl };
}

/** Opens PostgreSQL when DATABASE_URL is set (Supabase/production), otherwise embedded PGlite (dev/tests). */
export async function openDatabase(
  config: Pick<AppConfig, 'databaseUrl' | 'databaseSsl' | 'databaseSslCa' | 'pgliteDir'>,
  options: OpenOptions = {},
): Promise<DbHandle> {
  const folder = migrationsFolder();
  if (config.databaseUrl) {
    // In Supabase's session pooler every client connection holds one of the pool's server connections, so keep the
    // pooler's pool size at 10 or more. Idle connections stay open for a minute because a remote connect costs several
    // round trips; an unreachable database fails after 10 s instead of hanging requests.
    const pool = new pg.Pool({ ...pgConnectionConfig(config), max: 10, idleTimeoutMillis: 60_000, connectionTimeoutMillis: 10_000, keepAlive: true });
    pool.on('error', options.onError ?? ((err) => console.error(`database connection error: ${err.message}`)));
    const db = drizzlePg({ client: pool, schema });
    return {
      db,
      driver: 'pg',
      migrate: () => migratePg(db, { migrationsFolder: folder }),
      close: () => pool.end(),
    };
  }
  if (config.pgliteDir) mkdirSync(config.pgliteDir, { recursive: true });
  const client = config.pgliteDir ? new PGlite(config.pgliteDir) : new PGlite();
  await client.waitReady;
  const lite = drizzlePglite({ client, schema });
  return {
    db: lite as unknown as Db,
    driver: 'pglite',
    migrate: () => migratePglite(lite, { migrationsFolder: folder }),
    close: () => client.close(),
  };
}
