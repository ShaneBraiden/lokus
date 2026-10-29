import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Walks up from this file to the npm-workspaces root (works from src/ in development and dist/ in production). */
export function findRepoRoot(start = path.dirname(fileURLToPath(import.meta.url))): string {
  let dir = start;
  for (;;) {
    const pkg = path.join(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, 'utf8')).workspaces) return dir;
      } catch {
        // keep walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

/** The API package's drizzle migrations folder. */
export function migrationsFolder(): string {
  return path.join(findRepoRoot(), 'apps', 'api', 'drizzle');
}
