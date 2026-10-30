import { Router, type Request } from 'express';
import { and, desc, eq, ilike, isNull, ne, or } from 'drizzle-orm';
import { z } from 'zod';
import type { AssessmentResult } from '#engine';
import { ATTEMPT_STATUS_LABELS, LOCKDOWN_STRIKE_LIMIT, type AttemptStatus } from '@lokus/shared';
import type { AppDeps } from '../context';
import { assessmentResults, attempts, candidateProfiles, invitations, resultShares, shareRequests, users } from '../db/schema';
import { audit } from '../lib/audit';
import { notFound } from '../lib/errors';
import { parseParams, parseQuery } from '../lib/http';
import { listEvents } from '../services/eventStore';
import { buildEmployerReport, employerResult, type EmployerResult } from '../services/employerReport';
import { latestVersions } from '../services/scoring';
import { loadScoringPackage } from '../services/scoringPackages';
import { renderReportPdf } from '../services/reportPdf';

const DAY = 24 * 60 * 60 * 1000;
const attemptParam = z.object({ attemptId: z.uuid() });
const ACTIVE = new Set(['not_started', 'w1_in_progress', 'w1_submitted', 'w2_in_progress']);

type Progress = 'invited' | 'not_started' | 'in_progress' | 'submitted' | 'closed' | 'withdrawn';

/**
 * Employer area (/api/org, behind requireEmployer). An organisation only ever reaches an attempt through an
 * active result share (its own invitation, or the candidate's approval), or through the talent pool for
 * candidates who opted in. Every result read is audited.
 */
export function employerRouter(deps: AppDeps): Router {
  const r = Router();
  const orgOf = (req: Request) => req.auth!.org!;

  /** One row per invitation; the attempt and result only when this organisation can see them. */
  async function candidateRows(orgId: string) {
    const lv = latestVersions(deps.db);
    const rows = await deps.db
      .select({
        inv: invitations,
        attempt: { id: attempts.id, status: attempts.status, startedAt: attempts.startedAt, submittedAt: attempts.t2SubmittedAt, deadlineAt: attempts.deadlineAt, origin: attempts.origin },
        share: { id: resultShares.id, basis: resultShares.basis },
        request: { status: shareRequests.status },
        result: { result: assessmentResults.result, computedAt: assessmentResults.computedAt, packageId: assessmentResults.scoringPackageId },
      })
      .from(invitations)
      .leftJoin(attempts, eq(attempts.id, invitations.attemptId))
      .leftJoin(resultShares, and(eq(resultShares.attemptId, invitations.attemptId), eq(resultShares.orgId, orgId), isNull(resultShares.revokedAt)))
      .leftJoin(shareRequests, eq(shareRequests.id, invitations.shareRequestId))
      .leftJoin(lv, eq(lv.attemptId, invitations.attemptId))
      .leftJoin(assessmentResults, and(eq(assessmentResults.attemptId, invitations.attemptId), eq(assessmentResults.resultVersion, lv.version)))
      .where(and(eq(invitations.orgId, orgId), ne(invitations.status, 'revoked')))
      .orderBy(desc(invitations.createdAt));
    return Promise.all(
      rows.map(async ({ inv, attempt, share, request, result }) => {
        const visible = Boolean(attempt?.id && share?.id && attempt.status !== 'void');
        let progress: Progress;
        if (inv.status === 'pending') progress = 'invited';
        else if (!visible) progress = request?.status === 'declined' ? 'withdrawn' : 'not_started';
        else if (attempt!.status === 'submitted') progress = 'submitted';
        else if (attempt!.status === 'closed') progress = 'closed';
        else if (attempt!.status === 'void') progress = 'withdrawn';
        else progress = attempt!.status === 'not_started' ? 'not_started' : 'in_progress';
        const res: EmployerResult | null = visible && result?.result && (attempt!.status === 'submitted' || attempt!.status === 'closed') ? employerResult(result.result as AssessmentResult, await loadScoringPackage(deps.db, result.packageId!), result.computedAt!) : null;
        return {
          invitation_id: inv.id,
          attempt_id: visible ? attempt!.id : null,
          name: inv.name || inv.email,
          email: inv.email,
          source: share?.basis === 'reuse_consent' ? 'Shared existing result' : 'Invitation',
          progress,
          progress_label: progress === 'invited' ? 'Invited' : progress === 'withdrawn' ? 'Withdrawn' : progress === 'in_progress' ? 'In progress' : ATTEMPT_STATUS_LABELS[progress as AttemptStatus],
          invited_at: inv.createdAt,
          deadline_at: visible ? attempt!.deadlineAt : inv.deadlineAt,
          submitted_at: visible ? attempt!.submittedAt : null,
          result: res ? { outcome: res.outcome, outcome_label: res.outcome_label, t1: res.t1, t2: res.t2, scores_final: res.scores_final, flags: res.gates.filter((g) => g.fired).map((g) => g.gate_id) } : null,
        };
      }),
    );
  }

  r.get('/overview', async (req, res) => {
    const rows = await candidateRows(orgOf(req).id);
    const now = deps.clock.now().getTime();
    const finals = rows.filter((x) => x.result && x.result.outcome !== 'AWAITING_REVIEW');
    const outcomes: Record<string, number> = {};
    for (const x of rows) if (x.result) outcomes[x.result.outcome] = (outcomes[x.result.outcome] ?? 0) + 1;
    res.json({
      invited: rows.filter((x) => x.progress === 'invited').length,
      in_progress: rows.filter((x) => x.progress === 'in_progress' || x.progress === 'not_started').length,
      completed: rows.filter((x) => x.progress === 'submitted').length,
      awaiting_review: rows.filter((x) => x.result?.outcome === 'AWAITING_REVIEW').length,
      meets_rate: finals.length ? Math.round((finals.filter((x) => x.result!.outcome === 'MEETS_BAR').length / finals.length) * 100) : null,
      outcomes,
      due_soon: rows
        .filter((x) => (x.progress === 'invited' || x.progress === 'not_started' || x.progress === 'in_progress') && x.deadline_at && x.deadline_at.getTime() - now < 7 * DAY && x.deadline_at.getTime() > now)
        .slice(0, 8)
        .map((x) => ({ invitation_id: x.invitation_id, name: x.name, email: x.email, progress_label: x.progress_label, deadline_at: x.deadline_at })),
      recent: rows.filter((x) => x.result).slice(0, 6),
    });
  });

  r.get('/candidates', async (req, res) => {
    const q = parseQuery(z.object({ query: z.string().trim().max(120).optional(), progress: z.string().max(20).optional(), outcome: z.string().max(40).optional() }), req);
    let rows = await candidateRows(orgOf(req).id);
    if (q.query) {
      const needle = q.query.toLowerCase();
      rows = rows.filter((x) => x.name.toLowerCase().includes(needle) || x.email.includes(needle));
    }
    if (q.progress) rows = rows.filter((x) => x.progress === q.progress);
    if (q.outcome) rows = rows.filter((x) => x.result?.outcome === q.outcome);
    res.json({ candidates: rows });
  });

  r.get('/candidates.csv', async (req, res) => {
    const rows = await candidateRows(orgOf(req).id);
    const cell = (v: unknown) => {
      const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
      // Neutralise spreadsheet formulas and quote every cell.
      return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
    };
    const header = ['Name', 'Email', 'Source', 'Progress', 'Outcome', 'Workday 1', 'Workday 2', 'Critical flags', 'Invited', 'Deadline', 'Submitted'];
    const lines = rows.map((x) => [x.name, x.email, x.source, x.progress_label, x.result?.outcome_label ?? '', x.result?.t1 ?? '', x.result?.t2 ?? '', x.result?.flags.join(' ') ?? '', x.invited_at, x.deadline_at, x.submitted_at].map(cell).join(','));
    await audit(deps.db, req, { action: 'candidates.exported', targetType: 'organization', targetId: orgOf(req).id, orgId: orgOf(req).id });
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="lokus-candidates-${deps.clock.now().toISOString().slice(0, 10)}.csv"`);
    res.send(`﻿${[header.map(cell).join(','), ...lines].join('\r\n')}`);
  });

  /** The attempt, if this organisation holds an active share for it. Anything else is a 404 (no existence leak). */
  async function sharedAttempt(orgId: string, attemptId: string) {
    const [row] = await deps.db
      .select({ a: attempts, candidate: { name: users.name, email: users.email }, profile: { headline: candidateProfiles.headline, location: candidateProfiles.location } })
      .from(resultShares)
      .innerJoin(attempts, eq(attempts.id, resultShares.attemptId))
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .leftJoin(candidateProfiles, eq(candidateProfiles.userId, attempts.candidateId))
      .where(and(eq(resultShares.attemptId, attemptId), eq(resultShares.orgId, orgId), isNull(resultShares.revokedAt), ne(attempts.status, 'void')));
    if (!row) throw notFound('Result not found.');
    return row;
  }

  /** Lockdown record for a proctored attempt: every violation the player reported, and whether it was a strike. */
  async function integrity(a: typeof attempts.$inferSelect) {
    const [inv] = a.invitationId ? await deps.db.select({ lockdown: invitations.lockdown }).from(invitations).where(eq(invitations.id, a.invitationId)) : [];
    if (!inv?.lockdown) return { lockdown: false, strikes: 0, limit: LOCKDOWN_STRIKE_LIMIT, closed_by_lockdown: false, violations: [] };
    const violations = (await listEvents(deps.db, a.id))
      .filter((r) => r.eventType === 'lockdown_violation')
      .map((r) => {
        const m = r.metadata as { kind: string; detail?: string; strike?: boolean };
        return { kind: m.kind, detail: m.detail ?? '', strike: Boolean(m.strike), at: r.serverTs };
      });
    return { lockdown: true, strikes: violations.filter((v) => v.strike).length, limit: LOCKDOWN_STRIKE_LIMIT, closed_by_lockdown: a.closeReason === 'lockdown', violations };
  }

  async function report(row: Awaited<ReturnType<typeof sharedAttempt>>) {
    const { result, evidence } = await buildEmployerReport(deps, row.a);
    const showResult = row.a.status === 'submitted' || row.a.status === 'closed';
    return {
      candidate: { name: row.candidate.name, email: row.candidate.email, headline: row.profile?.headline ?? '', location: row.profile?.location ?? '' },
      attempt: {
        id: row.a.id,
        status: row.a.status,
        status_label: ATTEMPT_STATUS_LABELS[row.a.status as AttemptStatus],
        started_at: row.a.startedAt,
        t1_submitted_at: row.a.t1SubmittedAt,
        submitted_at: row.a.t2SubmittedAt,
        deadline_at: row.a.deadlineAt,
        in_progress: ACTIVE.has(row.a.status),
      },
      result: showResult ? result : null,
      evidence: showResult ? evidence : null,
      integrity: await integrity(row.a),
    };
  }

  r.get('/results/:attemptId', async (req, res) => {
    const { attemptId } = parseParams(attemptParam, req);
    const org = orgOf(req);
    const row = await sharedAttempt(org.id, attemptId);
    await audit(deps.db, req, { action: 'result.viewed', targetType: 'attempt', targetId: attemptId, orgId: org.id });
    res.json(await report(row));
  });

  r.get('/results/:attemptId/report.pdf', async (req, res) => {
    const { attemptId } = parseParams(attemptParam, req);
    const org = orgOf(req);
    const data = await report(await sharedAttempt(org.id, attemptId));
    if (!data.result) throw notFound('The report is available once the assessment is submitted.');
    const pdf = await renderReportPdf({ orgName: org.name, generatedAt: deps.clock.now(), ...data, result: data.result, evidence: data.evidence! });
    await audit(deps.db, req, { action: 'result.pdf_downloaded', targetType: 'attempt', targetId: attemptId, orgId: org.id });
    const slug = data.candidate.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'candidate';
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="lokus-report-${slug}.pdf"`);
    res.send(pdf);
  });

  /** Side by side: only the permitted fields, for up to four of this organisation's candidates. */
  r.get('/compare', async (req, res) => {
    const { ids } = parseQuery(z.object({ ids: z.string().max(200) }), req);
    const list = [...new Set(ids.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 4);
    const parsed = z.array(z.uuid()).min(2).safeParse(list);
    if (!parsed.success) throw notFound('Choose two to four candidates to compare.');
    const org = orgOf(req);
    const out = [];
    for (const id of parsed.data) {
      const row = await sharedAttempt(org.id, id);
      const { result } = await buildEmployerReport(deps, row.a);
      out.push({ attempt_id: id, name: row.candidate.name, status_label: ATTEMPT_STATUS_LABELS[row.a.status as AttemptStatus], result: row.a.status === 'submitted' || row.a.status === 'closed' ? result : null });
    }
    await audit(deps.db, req, { action: 'results.compared', targetType: 'attempt', targetId: parsed.data.join(','), orgId: org.id });
    res.json({ candidates: out });
  });

  /** Candidates who took the simulation on their own and opted in to be found. */
  async function poolAttempt(attemptId: string) {
    const [row] = await deps.db
      .select({ a: attempts, candidate: { name: users.name, email: users.email }, profile: { headline: candidateProfiles.headline, location: candidateProfiles.location } })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .innerJoin(candidateProfiles, and(eq(candidateProfiles.userId, attempts.candidateId), eq(candidateProfiles.talentPoolListed, true)))
      .where(and(eq(attempts.id, attemptId), eq(attempts.origin, 'self'), eq(attempts.status, 'submitted')));
    if (!row) throw notFound('This candidate is not in the talent pool.');
    return row;
  }

  r.get('/talent-pool', async (req, res) => {
    const q = parseQuery(z.object({ query: z.string().trim().max(120).optional(), outcome: z.string().max(40).optional() }), req);
    const lv = latestVersions(deps.db);
    const rows = await deps.db
      .select({ a: { id: attempts.id, submittedAt: attempts.t2SubmittedAt }, name: users.name, headline: candidateProfiles.headline, location: candidateProfiles.location, result: assessmentResults.result, computedAt: assessmentResults.computedAt, packageId: assessmentResults.scoringPackageId })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .innerJoin(candidateProfiles, and(eq(candidateProfiles.userId, attempts.candidateId), eq(candidateProfiles.talentPoolListed, true)))
      .innerJoin(lv, eq(lv.attemptId, attempts.id))
      .innerJoin(assessmentResults, and(eq(assessmentResults.attemptId, attempts.id), eq(assessmentResults.resultVersion, lv.version)))
      .where(and(eq(attempts.origin, 'self'), eq(attempts.status, 'submitted'), q.query ? or(ilike(users.name, `%${q.query}%`), ilike(candidateProfiles.headline, `%${q.query}%`), ilike(candidateProfiles.location, `%${q.query}%`)) : undefined))
      .orderBy(desc(attempts.t2SubmittedAt))
      .limit(200);
    let out = await Promise.all(
      rows.map(async (x) => {
        const er = employerResult(x.result as AssessmentResult, await loadScoringPackage(deps.db, x.packageId), x.computedAt);
        return { attempt_id: x.a.id, name: x.name, headline: x.headline, location: x.location, submitted_at: x.a.submittedAt, result: { outcome: er.outcome, outcome_label: er.outcome_label, t1: er.t1, t2: er.t2, flags: er.gates.filter((g) => g.fired).map((g) => g.gate_id), competencies: er.competencies } };
      }),
    );
    if (q.outcome) out = out.filter((x) => x.result.outcome === q.outcome);
    await audit(deps.db, req, { action: 'talent_pool.searched', targetType: 'organization', targetId: orgOf(req).id, orgId: orgOf(req).id, details: { query: q.query ?? null } });
    res.json({ candidates: out });
  });

  r.get('/talent-pool/:attemptId', async (req, res) => {
    const { attemptId } = parseParams(attemptParam, req);
    const row = await poolAttempt(attemptId);
    await audit(deps.db, req, { action: 'talent_pool.viewed', targetType: 'attempt', targetId: attemptId, orgId: orgOf(req).id });
    res.json({ ...(await report(row)), talent_pool: true });
  });

  return r;
}

