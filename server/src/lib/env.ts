import { existsSync } from 'node:fs';
import path from 'node:path';
import { findRepoRoot } from './paths';

/**
 * Loads environment variables from `--env=<file>` (relative to the repository root) or, without the flag, from the
 * root `.env` when it exists. Variables already set in the process environment win. A file named by the flag must
 * exist, so e.g. `npm run db:check -- --env=.env.supabase` never silently falls back to the local database.
 */
export function loadEnvFile(argv: string[] = process.argv): void {
  const flag = argv.find((a) => a.startsWith('--env='));
  const file = path.resolve(findRepoRoot(), flag ? flag.slice('--env='.length) : '.env');
  if (existsSync(file)) process.loadEnvFile(file);
  else if (flag) throw new Error(`env file not found: ${file}`);
}
