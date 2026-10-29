import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { and, eq, gt, isNull } from 'drizzle-orm';
import QRCode from 'qrcode';
import { z } from 'zod';
import type { AppDeps } from '../context';
import { authTokens, candidateProfiles, consentEvents, users } from '../db/schema';
import { PRIVACY_VERSION, TERMS_VERSION } from '../db/seed';
import { audit } from '../lib/audit';
import { decryptSecret, encryptSecret, hashPassword, randomToken, sha256, verifyPassword } from '../lib/crypto';
import { emails, sendEmail } from '../lib/emails';
import { badRequest, conflict, forbidden, HttpError } from '../lib/errors';
import { normaliseEmail, parseBody } from '../lib/http';
import { generateTotpSecret, otpauthUrl, verifyTotp } from '../lib/totp';
import { loadOrgFor, requireAuth, toAuthUser } from './middleware';
import { clearSessionCookie, createSession, markSessionMfaVerified, revokeAllSessions, revokeSession, type UserRow } from './sessions';

const HOUR = 60 * 60 * 1000;
export const passwordSchema = z.string().min(10, 'Use at least 10 characters.').max(200);
const emailSchema = z.email().max(254);

type TokenPurpose = 'verify_email' | 'reset_password';

export async function issueToken(deps: Pick<AppDeps, 'db' | 'clock'>, userId: string, purpose: TokenPurpose, ttlMs: number): Promise<string> {
  const token = randomToken(32);
  await deps.db.insert(authTokens).values({ userId, purpose, tokenHash: sha256(token), expiresAt: new Date(deps.clock.now().getTime() + ttlMs) });
  return token;
}

async function consumeToken(deps: Pick<AppDeps, 'db' | 'clock'>, token: string, purpose: TokenPurpose): Promise<UserRow> {
  const now = deps.clock.now();
  const [row] = await deps.db
    .select({ token: authTokens, user: users })
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
    .where(and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt), gt(authTokens.expiresAt, now)));
  if (!row || row.user.disabledAt) throw badRequest('invalid_token', 'This link is invalid or has expired.');
  await deps.db.update(authTokens).set({ usedAt: now }).where(eq(authTokens.id, row.token.id));
  return row.user;
}

export async function sendVerificationEmail(deps: AppDeps, user: { id: string; email: string; name: string }): Promise<void> {
  const token = await issueToken(deps, user.id, 'verify_email', 48 * HOUR);
  await sendEmail(deps, user.email, emails.verifyEmail(user.name, `${deps.config.appUrl}/verify?token=${token}`));
}

export async function sendSetPasswordEmail(deps: AppDeps, user: { id: string; email: string; name: string }): Promise<void> {
  const token = await issueToken(deps, user.id, 'reset_password', 48 * HOUR);
  await sendEmail(deps, user.email, emails.setPassword(user.name, `${deps.config.appUrl}/reset?token=${token}`));
}

/** The signed-in identity as the web app sees it, including where its home dashboard is. */
export function meResponse(deps: Pick<AppDeps, 'config'>, req: Request) {
  const a = req.auth!;
  const mfaRequired = a.user.kind === 'staff' && deps.config.requireStaffMfa;
  return {
    user: {
      id: a.user.id,
      email: a.user.email,
      name: a.user.name,
      kind: a.user.kind,
      platform_role: a.user.platformRole,
      email_verified: a.user.emailVerified,
      mfa: { required: mfaRequired, enabled: a.user.totpEnabled, verified: a.mfaVerified },
    },
    org: a.org ? { id: a.org.id, name: a.org.name, role: a.org.role, status: a.org.status } : null,
    home: a.user.kind === 'candidate' ? '/app' : a.user.kind === 'employer' ? '/org' : '/admin',
  };
}

export function authRouter(deps: AppDeps): Router {
  const r = Router();
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: deps.config.env === 'test' ? 10_000 : 40, standardHeaders: 'draft-7', legacyHeaders: false });

  /** Candidate self-sign-up (employers are onboarded by Lokus; staff are created by an admin). */
  r.post('/signup', limiter, async (req, res) => {
    const body = parseBody(z.object({ name: z.string().trim().min(1).max(120), email: emailSchema, password: passwordSchema, accept_terms: z.literal(true) }), req);
    const email = normaliseEmail(body.email);
    const [existing] = await deps.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) throw conflict('email_taken', 'An account with this email already exists. Sign in instead.');
    const [user] = await deps.db.insert(users).values({ email, name: body.name, kind: 'candidate', passwordHash: await hashPassword(body.password) }).returning();
    await deps.db.insert(candidateProfiles).values({ userId: user.id });
    await deps.db.insert(consentEvents).values([
      { userId: user.id, kind: 'terms', action: 'grant', textVersion: TERMS_VERSION, ip: req.ip },
      { userId: user.id, kind: 'privacy', action: 'grant', textVersion: PRIVACY_VERSION, ip: req.ip },
    ]);
    await sendVerificationEmail(deps, user);
    const sessionId = await createSession(deps, user, req, res);
    req.auth = { sessionId, user: toAuthUser(user), mfaVerified: false, org: null };
    res.status(201).json(meResponse(deps, req));
  });

  r.post('/login', limiter, async (req, res) => {
    const body = parseBody(z.object({ email: emailSchema, password: z.string().min(1).max(200) }), req);
    const [user] = await deps.db.select().from(users).where(eq(users.email, normaliseEmail(body.email)));
    const invalid = new HttpError(401, 'invalid_credentials', 'Email or password is incorrect.');
    if (!user || !user.passwordHash) {
      await hashPassword(body.password); // keep timing similar for unknown accounts
      throw invalid;
    }
    if (!(await verifyPassword(body.password, user.passwordHash))) throw invalid;
    if (user.disabledAt) throw forbidden('account_disabled', 'This account has been disabled.');
    await deps.db.update(users).set({ lastLoginAt: deps.clock.now() }).where(eq(users.id, user.id));
    const sessionId = await createSession(deps, user, req, res);
    req.auth = { sessionId, user: toAuthUser(user), mfaVerified: false, org: await loadOrgFor(deps.db, user) };
    res.json(meResponse(deps, req));
  });

  r.post('/logout', async (req, res) => {
    if (req.auth) await revokeSession(deps, req.auth.sessionId);
    clearSessionCookie(deps, res);
    res.json({ ok: true });
  });

  r.get('/me', requireAuth, (req, res) => {
    res.json(meResponse(deps, req));
  });

  r.post('/verify-email', limiter, async (req, res) => {
    const { token } = parseBody(z.object({ token: z.string().min(20).max(200) }), req);
    const user = await consumeToken(deps, token, 'verify_email');
    if (!user.emailVerifiedAt) await deps.db.update(users).set({ emailVerifiedAt: deps.clock.now(), updatedAt: deps.clock.now() }).where(eq(users.id, user.id));
    res.json({ ok: true });
  });

  r.post('/resend-verification', requireAuth, limiter, async (req, res) => {
    const u = req.auth!.user;
    if (!u.emailVerified) await sendVerificationEmail(deps, u);
    res.json({ ok: true });
  });

  /** Always succeeds, so the response never reveals whether an account exists. */
  r.post('/forgot-password', limiter, async (req, res) => {
    const { email } = parseBody(z.object({ email: emailSchema }), req);
    const [user] = await deps.db.select().from(users).where(eq(users.email, normaliseEmail(email)));
    if (user && !user.disabledAt) {
      const token = await issueToken(deps, user.id, 'reset_password', HOUR);
      await sendEmail(deps, user.email, emails.resetPassword(user.name, `${deps.config.appUrl}/reset?token=${token}`));
    }
    res.json({ ok: true });
  });

  r.post('/reset-password', limiter, async (req, res) => {
    const body = parseBody(z.object({ token: z.string().min(20).max(200), password: passwordSchema }), req);
    const user = await consumeToken(deps, body.token, 'reset_password');
    const now = deps.clock.now();
    await deps.db
      .update(users)
      .set({ passwordHash: await hashPassword(body.password), emailVerifiedAt: user.emailVerifiedAt ?? now, updatedAt: now })
      .where(eq(users.id, user.id));
    await revokeAllSessions(deps, user.id);
    await audit(deps.db, null, { action: 'auth.password_reset', targetType: 'user', targetId: user.id });
    res.json({ ok: true });
  });

  r.post('/change-password', requireAuth, async (req, res) => {
    const body = parseBody(z.object({ current_password: z.string().min(1).max(200), new_password: passwordSchema }), req);
    const [user] = await deps.db.select().from(users).where(eq(users.id, req.auth!.user.id));
    if (!(await verifyPassword(body.current_password, user.passwordHash))) throw badRequest('invalid_credentials', 'Your current password is incorrect.');
    await deps.db.update(users).set({ passwordHash: await hashPassword(body.new_password), updatedAt: deps.clock.now() }).where(eq(users.id, user.id));
    await revokeAllSessions(deps, user.id, req.auth!.sessionId);
    res.json({ ok: true });
  });

  // ---- Two-step sign-in (TOTP) for Lokus staff -------------------------------------------------------------
  r.post('/mfa/setup', requireAuth, async (req, res) => {
    const a = req.auth!;
    if (a.user.kind !== 'staff') throw forbidden('staff_only', 'Two-step sign-in is set up for Lokus staff accounts.');
    if (a.user.totpEnabled) throw conflict('mfa_already_enabled', 'Two-step sign-in is already set up.');
    const secret = generateTotpSecret();
    await deps.db.update(users).set({ totpSecret: encryptSecret(secret, deps.config.sessionSecret), updatedAt: deps.clock.now() }).where(eq(users.id, a.user.id));
    const url = otpauthUrl(secret, a.user.email);
    res.json({ secret, otpauth_url: url, qr_data_url: await QRCode.toDataURL(url, { margin: 1, width: 220 }) });
  });

  async function checkCode(userId: string, code: string, requireEnabled: boolean) {
    const [user] = await deps.db.select().from(users).where(eq(users.id, userId));
    if (!user?.totpSecret) throw badRequest('mfa_not_started', 'Start two-step sign-in setup first.');
    if (requireEnabled && !user.totpEnabledAt) throw badRequest('mfa_not_enabled', 'Two-step sign-in is not set up for this account.');
    const result = verifyTotp(decryptSecret(user.totpSecret, deps.config.sessionSecret), code, deps.clock.now().getTime(), user.totpLastStep ?? null);
    if (!result.ok) throw badRequest('invalid_code', 'That code is not valid. Check your authenticator app and try again.');
    return result.step;
  }

  r.post('/mfa/enable', requireAuth, limiter, async (req, res) => {
    const { code } = parseBody(z.object({ code: z.string().min(6).max(10) }), req);
    const a = req.auth!;
    if (a.user.kind !== 'staff') throw forbidden('staff_only', 'Two-step sign-in is set up for Lokus staff accounts.');
    if (a.user.totpEnabled) throw conflict('mfa_already_enabled', 'Two-step sign-in is already set up.');
    const step = await checkCode(a.user.id, code, false);
    await deps.db.update(users).set({ totpEnabledAt: deps.clock.now(), totpLastStep: step, updatedAt: deps.clock.now() }).where(eq(users.id, a.user.id));
    await markSessionMfaVerified(deps, a.sessionId);
    await audit(deps.db, req, { action: 'auth.mfa_enabled', targetType: 'user', targetId: a.user.id });
    res.json({ ok: true });
  });

  r.post('/mfa/verify', requireAuth, limiter, async (req, res) => {
    const { code } = parseBody(z.object({ code: z.string().min(6).max(10) }), req);
    const a = req.auth!;
    const step = await checkCode(a.user.id, code, true);
    await deps.db.update(users).set({ totpLastStep: step }).where(eq(users.id, a.user.id));
    await markSessionMfaVerified(deps, a.sessionId);
    res.json({ ok: true });
  });

  return r;
}
