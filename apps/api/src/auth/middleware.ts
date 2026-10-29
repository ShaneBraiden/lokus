import type { RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import type { AppDeps } from '../context';
import type { Db } from '../db/client';
import { memberships, organizations } from '../db/schema';
import { forbidden, unauthorized } from '../lib/errors';
import { resolveSession, SESSION_COOKIE, type UserRow } from './sessions';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  kind: 'candidate' | 'employer' | 'staff';
  platformRole: 'admin' | 'assessor' | null;
  emailVerified: boolean;
  totpEnabled: boolean;
}

export interface AuthOrg {
  id: string;
  name: string;
  role: 'owner' | 'recruiter';
  status: string;
}

export interface AuthContext {
  sessionId: string;
  user: AuthUser;
  mfaVerified: boolean;
  org: AuthOrg | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function toAuthUser(user: UserRow): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    kind: user.kind as AuthUser['kind'],
    platformRole: (user.platformRole as AuthUser['platformRole']) ?? null,
    emailVerified: Boolean(user.emailVerifiedAt),
    totpEnabled: Boolean(user.totpEnabledAt),
  };
}

/** An employer user belongs to exactly one organisation (V1). */
export async function loadOrgFor(db: Db, user: Pick<UserRow, 'id' | 'kind'>): Promise<AuthOrg | null> {
  if (user.kind !== 'employer') return null;
  const [m] = await db
    .select({ id: organizations.id, name: organizations.name, role: memberships.role, status: organizations.status })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(eq(memberships.userId, user.id))
    .limit(1);
  return m ? { ...m, role: m.role as AuthOrg['role'] } : null;
}

/** Loads the session (if any) for every request. Never rejects: guards below decide access. */
export function attachAuth(deps: Pick<AppDeps, 'db' | 'clock'>): RequestHandler {
  return async (req, _res, next) => {
    const resolved = await resolveSession(deps, req.cookies?.[SESSION_COOKIE]);
    if (resolved) {
      const { session, user } = resolved;
      req.auth = { sessionId: session.id, user: toAuthUser(user), mfaVerified: Boolean(session.mfaVerifiedAt), org: await loadOrgFor(deps.db, user) };
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => next(req.auth ? undefined : unauthorized());

export const requireCandidate: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(unauthorized());
  next(req.auth.user.kind === 'candidate' ? undefined : forbidden('candidate_only', 'This area is for candidates.'));
};

export const requireEmployer: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(unauthorized());
  const { user, org } = req.auth;
  if (user.kind !== 'employer' || !org) return next(forbidden('employer_only', 'This area is for employer teams.'));
  next(org.status === 'active' ? undefined : forbidden('organization_suspended', 'Your organisation is suspended. Contact Lokus support.'));
};

export const requireOrgOwner: RequestHandler = (req, _res, next) => {
  next(req.auth?.org?.role === 'owner' ? undefined : forbidden('owner_only', 'Only organisation owners can do this.'));
};

/** Lokus staff guard; enforces authenticator-app two-step sign-in when REQUIRE_STAFF_MFA is on. */
export function requireStaff(deps: Pick<AppDeps, 'config'>, roles: ('admin' | 'assessor')[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    const { user, mfaVerified } = req.auth;
    if (user.kind !== 'staff' || !user.platformRole || !roles.includes(user.platformRole)) return next(forbidden('staff_only', 'This area is for Lokus staff.'));
    if (deps.config.requireStaffMfa) {
      if (!user.totpEnabled) return next(forbidden('mfa_setup_required', 'Set up two-step sign-in to continue.'));
      if (!mfaVerified) return next(forbidden('mfa_required', 'Enter the code from your authenticator app to continue.'));
    }
    next();
  };
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** CSRF defence in depth (cookies are SameSite=Lax): state-changing requests must not come from another origin. */
export function originCheck(deps: Pick<AppDeps, 'config'>): RequestHandler {
  const allowed = new URL(deps.config.appUrl).origin;
  return (req, _res, next) => {
    if (!UNSAFE.has(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next();
    const self = `${req.protocol}://${req.get('host')}`;
    next(origin === allowed || origin === self ? undefined : forbidden('bad_origin', 'Cross-site request blocked.'));
  };
}
