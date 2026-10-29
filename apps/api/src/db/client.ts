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

function connectionStringWithoutSslParams(url: string): string {
  const u = new URL(url);
  for (const p of ['sslmode', 'ssl', 'sslrootcert', 'uselibpqcompat']) u.searchParams.delete(p);
  return u.toString();
}

/** Opens PostgreSQL when DATABASE_URL is set (Supabase/production), otherwise embedded PGlite (dev/tests). */
export async function openDatabase(config: Pick<AppConfig, 'databaseUrl' | 'databaseSsl' | 'pgliteDir'>): Promise<DbHandle> {
  const folder = migrationsFolder();
  if (config.databaseUrl) {
    const ssl = config.databaseSsl === 'off' ? undefined : { rejectUnauthorized: config.databaseSsl === 'verify' };
    const pool = new pg.Pool({ connectionString: connectionStringWithoutSslParams(config.databaseUrl), ssl, max: 10 });
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
