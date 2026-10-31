import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { pgConnectionConfig } from '../src/db/client';

const SUPABASE = 'postgresql://postgres.projectref:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';
const LOCAL = 'postgres://lokus:secret@localhost:2007/lokus';
const PEM = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
const dev = (vars: Record<string, string> = {}) => loadConfig({ NODE_ENV: 'development', ...vars } as NodeJS.ProcessEnv);

describe('database configuration', () => {
  it('encrypts remote connections without certificate verification by default', () => {
    const config = dev({ DATABASE_URL: SUPABASE });
    expect(config.databaseSsl).toBe('no-verify');
    expect(config.pgliteDir).toBeNull();
    expect(pgConnectionConfig(config)).toEqual({ connectionString: SUPABASE, ssl: { rejectUnauthorized: false } });
  });

  it('verifies the server certificate against DATABASE_SSL_CA, accepting escaped line breaks', () => {
    const config = dev({ DATABASE_URL: SUPABASE, DATABASE_SSL_CA: PEM.replace(/\n/g, '\\n') });
    expect(config.databaseSsl).toBe('verify');
    expect(config.databaseSslCa).toBe(PEM);
    expect(pgConnectionConfig(config).ssl).toEqual({ rejectUnauthorized: true, ca: PEM });
  });

  it('leaves TLS off for a local server, and DATABASE_SSL overrides the default', () => {
    expect(pgConnectionConfig(dev({ DATABASE_URL: LOCAL })).ssl).toBeUndefined();
    expect(pgConnectionConfig(dev({ DATABASE_URL: SUPABASE, DATABASE_SSL: 'verify' })).ssl).toEqual({ rejectUnauthorized: true });
    expect(pgConnectionConfig(dev({ DATABASE_URL: SUPABASE, DATABASE_SSL_CA: PEM, DATABASE_SSL: 'no-verify' })).ssl).toMatchObject({ rejectUnauthorized: false });
  });

  it('drops sslmode-style URL parameters so DATABASE_SSL alone decides', () => {
    expect(pgConnectionConfig(dev({ DATABASE_URL: `${SUPABASE}?sslmode=require` })).connectionString).toBe(SUPABASE);
  });

  it('seeds demo accounts only into the embedded development database unless asked to', () => {
    expect(dev().seedDemo).toBe(true);
    expect(dev({ DATABASE_URL: SUPABASE }).seedDemo).toBe(false);
    expect(dev({ DATABASE_URL: LOCAL, SEED_DEMO: 'true' }).seedDemo).toBe(true);
  });

  it("rejects Supabase's password placeholder and a CA that is not a PEM certificate", () => {
    expect(() => dev({ DATABASE_URL: SUPABASE.replace('secret', '[YOUR-PASSWORD]') })).toThrow(/placeholder/);
    expect(() => dev({ DATABASE_URL: SUPABASE.replace('secret', '%5BYOUR-PASSWORD%5D') })).toThrow(/placeholder/);
    expect(() => dev({ DATABASE_URL: SUPABASE, DATABASE_SSL_CA: 'not a certificate' })).toThrow(/PEM/);
  });
});

describe('email configuration', () => {
  it('requires email verification whenever Resend is set up, unless turned off', () => {
    expect(dev().requireEmailVerification).toBe(false);
    expect(dev({ RESEND_API_KEY: 're_test' }).requireEmailVerification).toBe(true);
    expect(dev({ RESEND_API_KEY: 're_test', REQUIRE_EMAIL_VERIFICATION: 'false' }).requireEmailVerification).toBe(false);
    expect(dev({ REQUIRE_EMAIL_VERIFICATION: 'true' }).requireEmailVerification).toBe(true);
  });
});
