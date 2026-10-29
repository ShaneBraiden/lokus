import type { Logger } from 'pino';
import type { AppConfig } from './config';
import type { Db } from './db/client';
import type { Clock } from './lib/clock';
import type { Mailer } from './lib/mailer';

/** Everything a route or service needs; tests swap in PGlite, a FakeClock and a MemoryMailer. */
export interface AppDeps {
  config: AppConfig;
  db: Db;
  clock: Clock;
  mailer: Mailer;
  log: Logger;
}
