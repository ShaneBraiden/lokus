import { eq } from 'drizzle-orm';
import type { AppDeps } from '../context';
import { candidateProfiles, users } from '../db/schema';
import { hashPassword } from '../lib/crypto';
import { normaliseEmail } from '../lib/http';
import type { UserRow } from './sessions';

/**
 * Testing phase (DIRECT_ACCOUNTS): returns the account for this email, creating it with the shared default password
 * and a confirmed email when there is none. Nothing is emailed.
 */
export async function findOrCreateAccount(
  deps: Pick<AppDeps, 'db' | 'clock' | 'config'>,
  u: { email: string; name: string; kind: 'candidate' | 'employer' | 'staff'; platformRole?: 'admin' | 'assessor' },
): Promise<UserRow> {
  const email = normaliseEmail(u.email);
  const [found] = await deps.db.select().from(users).where(eq(users.email, email));
  if (found) return found;
  const [user] = await deps.db
    .insert(users)
    .values({
      email,
      name: u.name.trim() || email.split('@')[0],
      kind: u.kind,
      platformRole: u.platformRole ?? null,
      passwordHash: await hashPassword(deps.config.defaultAccountPassword),
      emailVerifiedAt: deps.clock.now(),
    })
    .returning();
  if (u.kind === 'candidate') await deps.db.insert(candidateProfiles).values({ userId: user.id });
  return user;
}

/** Added to responses that create accounts, so the person creating them can pass the password on. */
export function directPassword(deps: Pick<AppDeps, 'config'>): { default_password?: string } {
  return deps.config.directAccounts ? { default_password: deps.config.defaultAccountPassword } : {};
}
