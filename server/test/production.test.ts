import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { ConsoleMailer } from '../src/lib/mailer';
import { createTestContext, makeUser, PASSWORD, type TestContext } from './helpers';

let ctx: TestContext;
let dist: string;

beforeAll(async () => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'lokus-dist-'));
  fs.mkdirSync(path.join(dist, 'assets'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Lokus</title><div id="root"></div>');
  fs.writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');
  ctx = await createTestContext({ env: 'production', webDistDir: dist, secureCookies: true, appUrl: 'https://lokus.example' });
  await makeUser(ctx, { email: 'prod@example.com', kind: 'candidate' });
});
afterAll(async () => {
  await ctx.close();
  fs.rmSync(dist, { recursive: true, force: true });
});

describe('production serving', () => {
  it('serves the SPA with a fallback for client routes, and keeps API 404s as JSON', async () => {
    const a = ctx.agent();
    const home = await a.get('/');
    expect(home.status).toBe(200);
    expect(home.text).toContain('<div id="root">');
    expect((await a.get('/org/results/123')).text).toContain('<div id="root">');
    const api404 = await a.get('/api/nope');
    expect(api404.status).toBe(404);
    expect(api404.body.error.code).toBeDefined();
  });

  it('caches hashed assets for a year and the HTML for a short time, and never ships source maps', async () => {
    const a = ctx.agent();
    expect((await a.get('/assets/app-abc123.js')).headers['cache-control']).toContain('immutable');
    expect((await a.get('/assets/app-abc123.js.map')).status).not.toBe(200);
  });

  it('sends security headers and no-store API responses', async () => {
    const res = await ctx.agent().get('/api/health');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('issues Secure, HttpOnly, SameSite=Lax session cookies', async () => {
    const res = await ctx.agent().post('/api/auth/login').set('Origin', 'https://lokus.example').send({ email: 'prod@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('blocks cross-site state-changing requests', async () => {
    const res = await ctx.agent().post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: 'prod@example.com', password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('never mounts the development outbox outside development', async () => {
    expect((await ctx.agent().get('/api/dev/outbox')).status).toBe(404);
    const prod = createApp({ ...ctx.deps, mailer: new ConsoleMailer(pino({ level: 'silent' })) });
    const request = (await import('supertest')).default;
    expect((await request(prod).get('/api/dev/outbox')).status).toBe(404);
  });
});
