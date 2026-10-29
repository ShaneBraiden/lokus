import { and, desc, eq, ne } from 'drizzle-orm';
import type { DbOrTx } from '../db/client';
import { attemptProgress, attempts } from '../db/schema';
import { conflict } from '../lib/errors';
import { activePackageId } from './scoringPackages';

export type AttemptRow = typeof attempts.$inferSelect;

/** The candidate's current (non-withdrawn) attempt for a simulation version, if any — retakes included. */
export async function findLiveAttempt(db: DbOrTx, candidateId: string, simulationVersionId: string): Promise<AttemptRow | null> {
  const [row] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.candidateId, candidateId), eq(attempts.simulationVersionId, simulationVersionId), ne(attempts.status, 'void')))
    .orderBy(desc(attempts.createdAt))
    .limit(1);
  return row ?? null;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}

/**
 * Creates an attempt pinned to the currently published scoring package. A candidate may hold one live attempt per
 * simulation version (database-enforced); retakes need an admin grant.
 */
export async function createAttempt(
  tx: DbOrTx,
  input: { candidateId: string; simulationVersionId: string; origin: 'invite' | 'self'; invitationId?: string | null; deadlineAt?: Date | null; isRetake?: boolean; retakeGrantId?: string | null },
): Promise<AttemptRow> {
  const scoringPackageId = await activePackageId(tx, input.simulationVersionId);
  try {
    const [attempt] = await tx
      .insert(attempts)
      .values({
        candidateId: input.candidateId,
        simulationVersionId: input.simulationVersionId,
        scoringPackageId,
        origin: input.origin,
        invitationId: input.invitationId ?? null,
        deadlineAt: input.deadlineAt ?? null,
        isRetake: input.isRetake ?? false,
        retakeGrantId: input.retakeGrantId ?? null,
      })
      .returning();
    await tx.insert(attemptProgress).values({ attemptId: attempt.id, state: {} });
    return attempt;
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('attempt_exists', 'You already have an attempt for this simulation.');
    throw err;
  }
}
