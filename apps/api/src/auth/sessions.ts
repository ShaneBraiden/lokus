import type { Request, Response } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import type { AppDeps } from '../context';
import { sessions, users } from '../db/schema';
import { randomToken, sha256 } from '../lib/crypto';

export const SESSION_COOKIE = 'lokus_session';
const DAY = 24 * 60 * 60 * 1000;
/** Candidates and employers stay signed in for 7 days; staff sessions last 12 hours. */
const TTL_MS = { default: 7 * DAY, staff: 12 * 60 * 60 * 1000 };
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;

export async function createSession(deps: Pick<AppDeps, 'db' | 'clock' | 'config'>, user: UserRow, req: Request, res: Response): Promise<string> {
  const token = randomToken(32);
  const now = deps.clock.now();
  const ttl = user.kind === 'staff' ? TTL_MS.staff : TTL_MS.default;
  await deps.db.insert(sessions).values({
    id: sha256(token),
    userId: user.id,
    createdAt: now,
    expiresAt: new Date(now.getTime() + ttl),
    lastSeenAt: now,
    ip: req.ip ?? null,
    userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: deps.config.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: ttl,
  });
  return sha256(token);
}

export function clearSessionCookie(deps: Pick<AppDeps, 'config'>, res: Response): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: deps.config.secureCookies, sameSite: 'lax', path: '/' });
}

/** Resolves the cookie token to a live session and an enabled user, sliding `last_seen_at` at most every 5 minutes. */
export async function resolveSession(deps: Pick<AppDeps, 'db' | 'clock'>, token: string | undefined): Promise<{ session: SessionRow; user: UserRow } | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const [row] = await deps.db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), isNull(sessions.revokedAt)));
  if (!row) return null;
  const now = deps.clock.now();
  if (row.session.expiresAt.getTime() <= now.getTime() || row.user.disabledAt) return null;
  if (now.getTime() - row.session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await deps.db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.session.id));
  }
  return row;
}

export async function revokeSession(deps: Pick<AppDeps, 'db' | 'clock'>, sessionId: string): Promise<void> {
  await deps.db.update(sessions).set({ revokedAt: deps.clock.now() }).where(eq(sessions.id, sessionId));
}

export async function revokeAllSessions(deps: Pick<AppDeps, 'db' | 'clock'>, userId: string, exceptSessionId?: string): Promise<void> {
  const rows = await deps.db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  for (const r of rows) if (r.id !== exceptSessionId) await revokeSession(deps, r.id);
}

export async function markSessionMfaVerified(deps: Pick<AppDeps, 'db' | 'clock'>, sessionId: string): Promise<void> {
  await deps.db.update(sessions).set({ mfaVerifiedAt: deps.clock.now() }).where(eq(sessions.id, sessionId));
}
