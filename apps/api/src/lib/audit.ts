import type { Request } from 'express';
import type { DbOrTx } from '../db/client';
import { auditLog } from '../db/schema';

/** Records who viewed or changed what (admin/assessor/employer access to candidate data, answer-key views, admin actions). */
export async function audit(
  db: DbOrTx,
  req: Request | null,
  entry: { action: string; targetType: string; targetId: string; orgId?: string | null; details?: Record<string, unknown> },
): Promise<void> {
  const user = req?.auth?.user;
  await db.insert(auditLog).values({
    actorId: user?.id ?? null,
    actorRole: user ? (user.kind === 'staff' ? `staff:${user.platformRole}` : user.kind) : 'system',
    orgId: entry.orgId ?? null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    ip: req?.ip ?? null,
    details: entry.details ?? {},
  });
}
