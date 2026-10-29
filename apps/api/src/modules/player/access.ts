import type { Request, RequestHandler } from 'express';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { buildEvidence, type Evidence, type ScoringPackage } from '@lokus/engine';
import type { AttemptPhase } from '@lokus/shared';
import type { AppDeps } from '../../context';
import type { Tx } from '../../db/client';
import { attempts, invitations, organizations, simulationVersions } from '../../db/schema';
import { conflict, notFound } from '../../lib/errors';
import { parseParams } from '../../lib/http';
import { listEvents, toEngineEvents, withAttemptLock, type AttemptRow, type StoredEvent } from '../../services/eventStore';
import { recomputeResult } from '../../services/scoring';
import { loadScoringPackage } from '../../services/scoringPackages';

export interface AttemptContext {
  attempt: AttemptRow;
  simulationTitle: string;
  orgName: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      attemptCtx?: AttemptContext;
    }
  }
}

const ACTIVE = new Set(['not_started', 'w1_in_progress', 'w1_submitted', 'w2_in_progress']);

export function phaseOf(a: Pick<AttemptRow, 'status'>): AttemptPhase {
  switch (a.status) {
    case 'not_started':
      return 'intro';
    case 'w1_in_progress':
      return 'workday1';
    case 'w1_submitted':
      return 'between';
    case 'w2_in_progress':
      return 'workday2';
    case 'submitted':
      return 'done';
    default:
      return 'closed';
  }
}

const PHASE_MESSAGES: Record<AttemptPhase, string> = {
  intro: 'Start Workday 1 first.',
  workday1: 'This is not available during Workday 1.',
  between: 'Workday 1 has been submitted. Start Workday 2 to continue.',
  workday2: 'This is not available during Workday 2.',
  done: 'Your assessment has been submitted.',
  closed: 'This assessment is closed.',
};

export function assertPhase(attempt: AttemptRow, phases: AttemptPhase[]): void {
  const phase = phaseOf(attempt);
  if (!phases.includes(phase)) throw conflict(phase === 'closed' ? 'attempt_closed' : 'wrong_phase', PHASE_MESSAGES[phase], { phase });
}

/** Closes an unfinished attempt whose deadline has passed (outcome: Incomplete) the next time anyone touches it. */
export async function expireIfDue(deps: Pick<AppDeps, 'db' | 'clock'>, attempt: AttemptRow): Promise<AttemptRow> {
  if (!attempt.deadlineAt || !ACTIVE.has(attempt.status) || deps.clock.now().getTime() <= attempt.deadlineAt.getTime()) return attempt;
  const updated = await withAttemptLock(deps.db, attempt.id, async (tx, a) => {
    if (!ACTIVE.has(a.status)) return a;
    const now = deps.clock.now();
    const [u] = await tx.update(attempts).set({ status: 'closed', closedAt: now, closeReason: 'expired', updatedAt: now }).where(eq(attempts.id, a.id)).returning();
    return u;
  });
  await recomputeResult(deps, attempt.id, 'close');
  return updated;
}

/** Loads the signed-in candidate's own attempt (anyone else's is a 404) and applies deadline expiry. */
export function loadOwnAttempt(deps: Pick<AppDeps, 'db' | 'clock'>): RequestHandler {
  return async (req, _res, next) => {
    const parsed = z.object({ attemptId: z.uuid() }).safeParse(req.params);
    if (!parsed.success) throw notFound('Assessment not found.');
    const [row] = await deps.db
      .select({ a: attempts, simTitle: simulationVersions.title, orgName: organizations.name })
      .from(attempts)
      .innerJoin(simulationVersions, eq(simulationVersions.id, attempts.simulationVersionId))
      .leftJoin(invitations, eq(invitations.id, attempts.invitationId))
      .leftJoin(organizations, eq(organizations.id, invitations.orgId))
      .where(and(eq(attempts.id, parsed.data.attemptId), eq(attempts.candidateId, req.auth!.user.id)));
    if (!row) throw notFound('Assessment not found.');
    req.attemptCtx = { attempt: await expireIfDue(deps, row.a), simulationTitle: row.simTitle, orgName: row.orgName ?? null };
    next();
  };
}

export const requirePhase =
  (...phases: AttemptPhase[]): RequestHandler =>
  (req, _res, next) => {
    assertPhase(req.attemptCtx!.attempt, phases);
    next();
  };

export interface LockedEvidence {
  rows: StoredEvent[];
  evidence: Evidence;
  pkg: ScoringPackage;
}

/** Runs a command under the attempt lock with the current evidence, re-checking the phase on the locked row. */
export async function withEvidence<T>(
  deps: Pick<AppDeps, 'db'>,
  attemptId: string,
  phases: AttemptPhase[] | null,
  fn: (tx: Tx, attempt: AttemptRow, ev: LockedEvidence) => Promise<T>,
): Promise<T> {
  return withAttemptLock(deps.db, attemptId, async (tx, attempt) => {
    if (phases) assertPhase(attempt, phases);
    const pkg = await loadScoringPackage(tx, attempt.scoringPackageId);
    const rows = await listEvents(tx, attempt.id);
    return fn(tx, attempt, { rows, evidence: buildEvidence(toEngineEvents(rows), pkg), pkg });
  });
}

/** Next human-friendly identifier for an object created by a command, e.g. F-003 for the third finding. */
export function nextObjectId(rows: StoredEvent[], prefix: string, match: (r: StoredEvent) => boolean): string {
  return `${prefix}-${String(rows.filter(match).length + 1).padStart(3, '0')}`;
}

export { parseParams };

/** Every player event records the signed-in candidate as its actor. */
export const actor = (req: Request) => ({ actorUserId: req.auth!.user.id });
