import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config';
import { findRepoRoot } from '../lib/paths';
import { openDatabase } from './client';

const envFile = path.join(findRepoRoot(), '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig();
const handle = await openDatabase(config);
await handle.migrate();
await handle.close();
console.log(`Migrations applied (${handle.driver}).`);
