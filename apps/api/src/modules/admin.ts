import { Router } from 'express';
import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { sendSetPasswordEmail } from '../auth/routes';
import { revokeAllSessions } from '../auth/sessions';
import type { AppDeps } from '../context';
import { auditLog, memberships, organizations, users } from '../db/schema';
import { audit } from '../lib/audit';
import { conflict, notFound } from '../lib/errors';
import { normaliseEmail, parseBody, parseParams, parseQuery } from '../lib/http';
import { inviteTeamMember } from './team';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'org'
  );
}

/** Lokus admin: organisations, users and staff. Mounted at /api/admin behind requireStaff(['admin']). */
export function adminRouter(deps: AppDeps): Router {
  const r = Router();

  r.get('/orgs', async (_req, res) => {
    const rows = await deps.db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, status: organizations.status, created_at: organizations.createdAt, members: count(memberships.userId) })
      .from(organizations)
      .leftJoin(memberships, eq(memberships.orgId, organizations.id))
      .groupBy(organizations.id)
      .orderBy(asc(organizations.name));
    res.json({ organizations: rows });
  });

  /** Creates an employer organisation and emails its first owner an invitation. */
  r.post('/orgs', async (req, res) => {
    const body = parseBody(z.object({ name: z.string().trim().min(2).max(120), owner_email: z.email().max(254) }), req);
    let slug = slugify(body.name);
    for (let i = 2; ; i++) {
      const [taken] = await deps.db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug));
      if (!taken) break;
      slug = `${slugify(body.name)}-${i}`;
    }
    const [org] = await deps.db.insert(organizations).values({ name: body.name, slug, createdBy: req.auth!.user.id }).returning();
    await inviteTeamMember(deps, { orgId: org.id, orgName: org.name, email: body.owner_email, role: 'owner', invitedBy: req.auth!.user.id });
    await audit(deps.db, req, { action: 'org.created', targetType: 'organization', targetId: org.id, orgId: org.id, details: { owner_email: normaliseEmail(body.owner_email) } });
    res.status(201).json({ id: org.id, slug: org.slug });
  });

  r.patch('/orgs/:id', async (req, res) => {
    const { id } = parseParams(z.object({ id: z.uuid() }), req);
    const body = parseBody(z.object({ status: z.enum(['active', 'suspended']) }), req);
    const [org] = await deps.db.update(organizations).set({ status: body.status }).where(eq(organizations.id, id)).returning();
    if (!org) throw notFound('Organisation not found.');
    await audit(deps.db, req, { action: `org.${body.status === 'active' ? 'reactivated' : 'suspended'}`, targetType: 'organization', targetId: id, orgId: id });
    res.json({ ok: true });
  });

  r.get('/users', async (req, res) => {
    const q = parseQuery(z.object({ query: z.string().trim().max(120).optional(), kind: z.enum(['candidate', 'employer', 'staff']).optional() }), req);
    const conds: SQL[] = [];
    if (q.query) conds.push(or(ilike(users.email, `%${q.query}%`), ilike(users.name, `%${q.query}%`))!);
    if (q.kind) conds.push(eq(users.kind, q.kind));
    const rows = await deps.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        kind: users.kind,
        platform_role: users.platformRole,
        email_verified: users.emailVerifiedAt,
        mfa_enabled: users.totpEnabledAt,
        disabled_at: users.disabledAt,
        last_login_at: users.lastLoginAt,
        created_at: users.createdAt,
      })
      .from(users)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(200);
    res.json({ users: rows.map((u) => ({ ...u, email_verified: Boolean(u.email_verified), mfa_enabled: Boolean(u.mfa_enabled) })) });
  });

  /** Creates a staff account (admin or assessor) and emails a set-password link; TOTP setup follows at first sign-in. */
  r.post('/staff', async (req, res) => {
    const body = parseBody(z.object({ email: z.email().max(254), name: z.string().trim().min(1).max(120), role: z.enum(['admin', 'assessor']) }), req);
    const email = normaliseEmail(body.email);
    const [existing] = await deps.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) throw conflict('email_taken', 'An account with this email already exists.');
    const [user] = await deps.db.insert(users).values({ email, name: body.name, kind: 'staff', platformRole: body.role }).returning();
    await sendSetPasswordEmail(deps, user);
    await audit(deps.db, req, { action: 'staff.created', targetType: 'user', targetId: user.id, details: { role: body.role } });
    res.status(201).json({ id: user.id });
  });

  r.patch('/users/:id', async (req, res) => {
    const { id } = parseParams(z.object({ id: z.uuid() }), req);
    const body = parseBody(z.object({ disabled: z.boolean().optional(), platform_role: z.enum(['admin', 'assessor']).optional() }), req);
    if (id === req.auth!.user.id && (body.disabled || body.platform_role === 'assessor')) throw conflict('self_lockout', 'You cannot disable or demote your own account.');
    const [user] = await deps.db.select().from(users).where(eq(users.id, id));
    if (!user) throw notFound('User not found.');
    if (body.platform_role && user.kind !== 'staff') throw conflict('not_staff', 'Only staff accounts have a platform role.');
    await deps.db
      .update(users)
      .set({
        ...(body.disabled !== undefined ? { disabledAt: body.disabled ? deps.clock.now() : null } : {}),
        ...(body.platform_role ? { platformRole: body.platform_role } : {}),
        updatedAt: deps.clock.now(),
      })
      .where(eq(users.id, id));
    if (body.disabled) await revokeAllSessions(deps, id);
    await audit(deps.db, req, { action: 'user.updated', targetType: 'user', targetId: id, details: body });
    res.json({ ok: true });
  });

  r.get('/audit', async (req, res) => {
    const q = parseQuery(z.object({ target_type: z.string().max(40).optional(), target_id: z.string().max(80).optional(), limit: z.coerce.number().int().min(1).max(500).default(100) }), req);
    const conds: SQL[] = [];
    if (q.target_type) conds.push(eq(auditLog.targetType, q.target_type));
    if (q.target_id) conds.push(eq(auditLog.targetId, q.target_id));
    const rows = await deps.db.select().from(auditLog).where(conds.length ? and(...conds) : undefined).orderBy(desc(auditLog.id)).limit(q.limit);
    res.json({ entries: rows });
  });

  return r;
}
