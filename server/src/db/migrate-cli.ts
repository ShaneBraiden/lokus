import { loadConfig } from '../config';
import { loadEnvFile } from '../lib/env';
import { openDatabase } from './client';

loadEnvFile();

const config = loadConfig();
const handle = await openDatabase(config);
await handle.migrate();
await handle.close();
console.log(`Migrations applied (${handle.driver}).`);
