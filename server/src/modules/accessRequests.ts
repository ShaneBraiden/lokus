import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { directPassword } from '../auth/directAccounts';
import type { AppDeps } from '../context';
import { employerAccessRequests, users } from '../db/schema';
import { audit } from '../lib/audit';
import { emails, sendEmail } from '../lib/emails';
import { conflict, notFound } from '../lib/errors';
import { normaliseEmail, parseBody, parseParams, parseQuery } from '../lib/http';
import { createOrganization } from './admin';

const TEAM_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;

/** Public: the employer access request form. Mounted at /api/access-requests. */
export function publicAccessRequestsRouter(deps: AppDeps): Router {
  const r = Router();
  const limiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: deps.config.env === 'test' ? 10_000 : 5, standardHeaders: 'draft-7', legacyHeaders: false });

  r.post('/', limiter, async (req, res) => {
    const body = parseBody(
      z.object({
        org_name: z.string().trim().min(2).max(120),
        contact_name: z.string().trim().min(1).max(120),
        email: z.email().max(254),
        job_title: z.string().trim().max(120).default(''),
        website: z.string().trim().max(254).default(''),
        team_size: z.enum(TEAM_SIZES).or(z.literal('')).default(''),
        hiring_needs: z.string().trim().max(2000).default(''),
        accept_terms: z.literal(true),
      }),
      req,
    );
    const email = normaliseEmail(body.email);
    const [existing] = await deps.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) throw conflict('email_taken', 'An account with this email already exists. Sign in instead.');
    const [pending] = await deps.db
      .select({ id: employerAccessRequests.id })
      .from(employerAccessRequests)
      .where(and(eq(employerAccessRequests.email, email), eq(employerAccessRequests.status, 'pending')));
    if (pending) throw conflict('request_pending', 'A request from this email is already waiting for review. We will email you once it has been decided.');
    const [row] = await deps.db
      .insert(employerAccessRequests)
      .values({
        orgName: body.org_name,
        contactName: body.contact_name,
        email,
        jobTitle: body.job_title,
        website: body.website,
        teamSize: body.team_size,
        hiringNeeds: body.hiring_needs,
        ip: req.ip,
      })
      .returning({ id: employerAccessRequests.id });
    if (!deps.config.directAccounts) await sendEmail(deps, email, emails.accessRequestReceived({ name: body.contact_name, orgName: body.org_name }));
    await audit(deps.db, req, { action: 'access_request.submitted', targetType: 'access_request', targetId: row.id, details: { org_name: body.org_name } });
    res.status(201).json({ ok: true });
  });

  return r;
}

/** Lokus admin: review employer access requests. Mounted inside the admin router. */
export function adminAccessRequestsRouter(deps: AppDeps): Router {
  const r = Router();
  const idParam = z.object({ id: z.uuid() });

  async function loadPending(id: string) {
    const [row] = await deps.db.select().from(employerAccessRequests).where(eq(employerAccessRequests.id, id));
    if (!row) throw notFound('Access request not found.');
    if (row.status !== 'pending') throw conflict('already_decided', `This request was already ${row.status}.`);
    return row;
  }

  r.get('/access-requests', async (req, res) => {
    const q = parseQuery(z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() }), req);
    const conds: SQL[] = [];
    if (q.status) conds.push(eq(employerAccessRequests.status, q.status));
    const rows = await deps.db
      .select({
        id: employerAccessRequests.id,
        org_name: employerAccessRequests.orgName,
        contact_name: employerAccessRequests.contactName,
        email: employerAccessRequests.email,
        job_title: employerAccessRequests.jobTitle,
        website: employerAccessRequests.website,
        team_size: employerAccessRequests.teamSize,
        hiring_needs: employerAccessRequests.hiringNeeds,
        status: employerAccessRequests.status,
        decision_note: employerAccessRequests.decisionNote,
        decided_at: employerAccessRequests.decidedAt,
        decided_by: users.name,
        org_id: employerAccessRequests.orgId,
        created_at: employerAccessRequests.createdAt,
      })
      .from(employerAccessRequests)
      .leftJoin(users, eq(users.id, employerAccessRequests.decidedBy))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(employerAccessRequests.createdAt))
      .limit(200);
    res.json({ requests: rows });
  });

  /** Approves a request: creates the organisation and invites the requester as its owner. */
  r.post('/access-requests/:id/approve', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const body = parseBody(z.object({ org_name: z.string().trim().min(2).max(120).optional(), note: z.string().trim().max(1000).default('') }), req);
    const row = await loadPending(id);
    const org = await createOrganization(deps, req, { name: body.org_name ?? row.orgName, ownerEmail: row.email, ownerName: row.contactName });
    await deps.db
      .update(employerAccessRequests)
      .set({ status: 'approved', decisionNote: body.note, decidedBy: req.auth!.user.id, decidedAt: deps.clock.now(), orgId: org.id })
      .where(eq(employerAccessRequests.id, id));
    await audit(deps.db, req, { action: 'access_request.approved', targetType: 'access_request', targetId: id, orgId: org.id });
    res.json({ org_id: org.id, ...directPassword(deps) });
  });

  r.post('/access-requests/:id/reject', async (req, res) => {
    const { id } = parseParams(idParam, req);
    const body = parseBody(z.object({ note: z.string().trim().max(1000).default('') }), req);
    const row = await loadPending(id);
    await deps.db
      .update(employerAccessRequests)
      .set({ status: 'rejected', decisionNote: body.note, decidedBy: req.auth!.user.id, decidedAt: deps.clock.now() })
      .where(eq(employerAccessRequests.id, id));
    if (!deps.config.directAccounts) await sendEmail(deps, row.email, emails.accessRequestRejected({ name: row.contactName, orgName: row.orgName, note: body.note }));
    await audit(deps.db, req, { action: 'access_request.rejected', targetType: 'access_request', targetId: id });
    res.json({ ok: true });
  });

  return r;
}
