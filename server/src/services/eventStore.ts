import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { canonicalJson, sha256Hex, type EngineEvent, type EventDraft } from '#engine';
import type { Db, Tx } from '../db/client';
import { attemptEvents, attempts } from '../db/schema';
import type { Clock } from '../lib/clock';
import { conflict, notFound } from '../lib/errors';

export type AttemptRow = typeof attempts.$inferSelect;
export type StoredEvent = typeof attemptEvents.$inferSelect;

export const GENESIS_HASH = '0'.repeat(64);

function chainHash(prev: string, e: { attemptId: string; seq: number; eventId: string; taskId: string; eventType: string; objectId: string | null; metadata: unknown; source: string; serverTs: Date }) {
  return sha256Hex(
    prev +
      canonicalJson({
        attempt_id: e.attemptId,
        seq: e.seq,
        event_id: e.eventId,
        task_id: e.taskId,
        event_type: e.eventType,
        object_id: e.objectId,
        metadata: e.metadata,
        source: e.source,
        server_ts: e.serverTs.toISOString(),
      }),
  );
}

/**
 * Runs `fn` in a transaction holding a row lock on the attempt, so appends are serialised per attempt and every
 * event gets the next gapless sequence number.
 */
export async function withAttemptLock<T>(db: Db, attemptId: string, fn: (tx: Tx, attempt: AttemptRow) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const [attempt] = await tx.select().from(attempts).where(eq(attempts.id, attemptId)).for('update');
    if (!attempt) throw notFound('Attempt not found.');
    return fn(tx, attempt);
  });
}

export interface AppendOptions {
  actorUserId?: string | null;
  clientTs?: Date | null;
}

/**
 * The only write path into attempt_events. Rejects events for a submitted task or a closed attempt (409), stamps
 * the authoritative server time, and extends the per-attempt hash chain. Must run inside withAttemptLock.
 */
export async function appendEvents(tx: Tx, clock: Clock, attempt: AttemptRow, drafts: readonly EventDraft[], opts: AppendOptions = {}): Promise<StoredEvent[]> {
  if (attempt.status === 'void' || attempt.closedAt) throw conflict('attempt_closed', 'This assessment is closed.');
  for (const d of drafts) {
    if (d.task_id === 'T1' && attempt.t1SubmittedAt) throw conflict('task_locked', 'Workday 1 has already been submitted.');
    if (d.task_id === 'T2' && attempt.t2SubmittedAt) throw conflict('task_locked', 'Workday 2 has already been submitted.');
  }
  if (drafts.length === 0) return [];
  const serverTs = clock.now();
  let seq = attempt.lastSeq;
  let prev = attempt.lastHash ?? GENESIS_HASH;
  const rows: StoredEvent[] = drafts.map((d) => {
    seq += 1;
    const row = {
      attemptId: attempt.id,
      seq,
      eventId: randomUUID(),
      taskId: d.task_id,
      eventType: d.event_type,
      objectId: d.object_id ?? null,
      metadata: d.metadata ?? {},
      source: d.source,
      schemaV: 1,
      serverTs,
      clientTs: opts.clientTs ?? null,
      actorUserId: opts.actorUserId ?? null,
      prevHash: prev,
      hash: '',
    };
    row.hash = chainHash(prev, row);
    prev = row.hash;
    return row;
  });
  await tx.insert(attemptEvents).values(rows);
  await tx.update(attempts).set({ lastSeq: seq, lastHash: prev, updatedAt: serverTs }).where(eq(attempts.id, attempt.id));
  attempt.lastSeq = seq;
  attempt.lastHash = prev;
  return rows;
}

export async function listEvents(db: Db | Tx, attemptId: string): Promise<StoredEvent[]> {
  return db.select().from(attemptEvents).where(eq(attemptEvents.attemptId, attemptId)).orderBy(asc(attemptEvents.seq));
}

/** Converts stored rows to the engine's event shape. */
export function toEngineEvents(rows: readonly StoredEvent[]): EngineEvent[] {
  return rows.map((r) => ({
    event_id: r.eventId,
    seq: r.seq,
    task_id: r.taskId as EngineEvent['task_id'],
    event_type: r.eventType,
    object_id: r.objectId,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    server_ts: r.serverTs.getTime(),
    source: r.source as EngineEvent['source'],
  }));
}

/** Recomputes the hash chain; any edit to a stored event (or a gap in the sequence) breaks it. */
export async function verifyChain(db: Db | Tx, attemptId: string): Promise<{ ok: true; length: number } | { ok: false; brokenAtSeq: number }> {
  const rows = await listEvents(db, attemptId);
  let prev = GENESIS_HASH;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.seq !== i + 1 || r.prevHash !== prev || chainHash(prev, r) !== r.hash) return { ok: false, brokenAtSeq: r.seq };
    prev = r.hash;
  }
  return { ok: true, length: rows.length };
}
