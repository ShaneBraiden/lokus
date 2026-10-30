import pino from 'pino';
import { loadConfig } from '../config';
import { systemClock } from '../lib/clock';
import { loadEnvFile } from '../lib/env';
import { openDatabase } from './client';
import { seedAdmin, seedDemo, seedPlatform } from './seed';

loadEnvFile();

const config = loadConfig();
const log = pino({ level: 'info' });
const handle = await openDatabase(config);
await handle.migrate();
const deps = { db: handle.db, clock: systemClock, log };
await seedPlatform(deps);
if (config.seedAdminEmail && config.seedAdminPassword) await seedAdmin(deps, config.seedAdminEmail, config.seedAdminPassword);
if (config.seedDemo && config.env !== 'production') await seedDemo(deps);
await handle.close();
