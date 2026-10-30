import path from 'node:path';
import { z } from 'zod';
import { findRepoRoot } from './lib/paths';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1')
  .optional();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.url().default('http://localhost:5173'),
  /** postgres://… (Supabase session pooler in production). When absent the API uses embedded PGlite. */
  DATABASE_URL: z.string().min(1).optional(),
  /** TLS for DATABASE_URL: off | no-verify (encrypted, certificate not checked) | verify. Default: no-verify unless localhost. */
  DATABASE_SSL: z.enum(['off', 'no-verify', 'verify']).optional(),
  /** PGlite data directory for local development (relative paths resolve from the repo root). */
  PGLITE_DIR: z.string().default('.data/pglite'),
  SESSION_SECRET: z.string().min(32).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().default('Lokus <no-reply@lokus.example>'),
  /** Require TOTP two-factor authentication for Lokus staff (admin, assessor). */
  REQUIRE_STAFF_MFA: bool,
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  WEB_DIST_DIR: z.string().optional(),
  SEED_ADMIN_EMAIL: z.email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
  SEED_DEMO: bool,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
});

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  appUrl: string;
  databaseUrl: string | null;
  databaseSsl: 'off' | 'no-verify' | 'verify';
  pgliteDir: string | null;
  sessionSecret: string;
  resendApiKey: string | null;
  emailFrom: string;
  requireStaffMfa: boolean;
  trustProxy: number;
  webDistDir: string;
  seedAdminEmail: string | null;
  seedAdminPassword: string | null;
  seedDemo: boolean;
  logLevel: string;
  secureCookies: boolean;
}

const DEV_SECRET = 'lokus-development-secret-change-me-0123456789';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const e = EnvSchema.parse(env);
  const production = e.NODE_ENV === 'production';
  if (production && !e.SESSION_SECRET) throw new Error('SESSION_SECRET (at least 32 characters) is required in production');
  if (production && !e.DATABASE_URL) throw new Error('DATABASE_URL is required in production');
  const root = findRepoRoot();
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    appUrl: e.APP_URL.replace(/\/$/, ''),
    databaseUrl: e.DATABASE_URL ?? null,
    databaseSsl: e.DATABASE_SSL ?? (e.DATABASE_URL && !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(e.DATABASE_URL) ? 'no-verify' : 'off'),
    pgliteDir: e.DATABASE_URL ? null : path.resolve(root, e.PGLITE_DIR),
    sessionSecret: e.SESSION_SECRET ?? DEV_SECRET,
    resendApiKey: e.RESEND_API_KEY ?? null,
    emailFrom: e.EMAIL_FROM,
    requireStaffMfa: e.REQUIRE_STAFF_MFA ?? production,
    trustProxy: e.TRUST_PROXY || (production ? 1 : 0),
    webDistDir: e.WEB_DIST_DIR ? path.resolve(e.WEB_DIST_DIR) : path.resolve(root, 'client/dist'),
    seedAdminEmail: e.SEED_ADMIN_EMAIL ?? null,
    seedAdminPassword: e.SEED_ADMIN_PASSWORD ?? null,
    seedDemo: e.SEED_DEMO ?? e.NODE_ENV === 'development',
    logLevel: e.LOG_LEVEL ?? (e.NODE_ENV === 'test' ? 'silent' : 'info'),
    secureCookies: production,
  };
}

/** Configuration for automated tests: in-memory database, no MFA unless a test turns it on. */
export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv),
    pgliteDir: null,
    databaseUrl: null,
    seedDemo: false,
    ...overrides,
  };
}
