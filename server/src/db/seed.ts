import { eq } from 'drizzle-orm';
import { SIMULATION } from '@lokus/content';
import { canonicalJson, defaultScoringPackage, packageDigest, runRegressionSuite, sha256Hex } from '@lokus/engine';
import type { AppDeps } from '../context';
import { hashPassword } from '../lib/crypto';
import { answerKeys, candidateProfiles, consentEvents, memberships, organizations, regressionRuns, scoringPackages, simulationVersions, users } from './schema';

export const SIMULATION_VERSION_ID = `${SIMULATION.code}@${SIMULATION.version}`;
export const TERMS_VERSION = '2026-10';
export const PRIVACY_VERSION = '2026-10';

/** Idempotent platform bootstrap: simulation version, the v1.1 scoring package (published after its regression run). */
export async function seedPlatform(deps: Pick<AppDeps, 'db' | 'clock' | 'log'>): Promise<void> {
  const { db, clock } = deps;
  await db
    .insert(simulationVersions)
    .values({ id: SIMULATION_VERSION_ID, code: SIMULATION.code, version: SIMULATION.version, title: SIMULATION.title, contentVersion: SIMULATION.contentVersion })
    .onConflictDoNothing();

  const pkg = defaultScoringPackage();
  const [existing] = await db.select({ id: scoringPackages.id }).from(scoringPackages).where(eq(scoringPackages.id, pkg.id));
  if (existing) return;

  const report = runRegressionSuite(pkg);
  if (!report.passed) throw new Error(`Default scoring package failed ${report.failed} regression persona(s); refusing to publish.`);
  const now = clock.now();
  await db.transaction(async (tx) => {
    await tx.insert(scoringPackages).values({
      id: pkg.id,
      simulationVersionId: SIMULATION_VERSION_ID,
      label: pkg.label,
      status: 'draft',
      engineVersion: pkg.engine_version,
      rubric: pkg.rubric,
      parameters: pkg.parameters,
      phraseLists: pkg.phrase_lists,
      identifiers: pkg.identifiers,
      sha256: packageDigest(pkg),
      notes: 'Workbook v1.1 parameters with SME-draft phrase lists and rule interpretations.',
    });
    await tx.insert(answerKeys).values({ scoringPackageId: pkg.id, key: pkg.answer_key, sha256: sha256Hex(canonicalJson(pkg.answer_key)) });
    const [run] = await tx.insert(regressionRuns).values({ scoringPackageId: pkg.id, passed: true, summary: report }).returning({ id: regressionRuns.id });
    await tx.update(scoringPackages).set({ status: 'published', publishedAt: now, regressionRunId: run.id }).where(eq(scoringPackages.id, pkg.id));
  });
  deps.log.info({ packageId: pkg.id }, 'published default scoring package after a passing regression run');
}

async function ensureUser(
  deps: Pick<AppDeps, 'db' | 'clock'>,
  u: { email: string; name: string; kind: 'candidate' | 'employer' | 'staff'; platformRole?: 'admin' | 'assessor'; password: string },
): Promise<string> {
  const email = u.email.toLowerCase();
  const [found] = await deps.db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (found) return found.id;
  const now = deps.clock.now();
  const [created] = await deps.db
    .insert(users)
    .values({ email, name: u.name, kind: u.kind, platformRole: u.platformRole ?? null, passwordHash: await hashPassword(u.password), emailVerifiedAt: now })
    .returning({ id: users.id });
  if (u.kind === 'candidate') {
    await deps.db.insert(candidateProfiles).values({ userId: created.id });
    await deps.db.insert(consentEvents).values([
      { userId: created.id, kind: 'terms', action: 'grant', textVersion: TERMS_VERSION },
      { userId: created.id, kind: 'privacy', action: 'grant', textVersion: PRIVACY_VERSION },
    ]);
  }
  return created.id;
}

/** Creates the first Lokus admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD when no such account exists. */
export async function seedAdmin(deps: Pick<AppDeps, 'db' | 'clock' | 'log'>, email: string, password: string): Promise<void> {
  await ensureUser(deps, { email, name: 'Lokus Administrator', kind: 'staff', platformRole: 'admin', password });
  deps.log.info({ email }, 'ensured seed admin account');
}

/**
 * Local demo accounts (development only, SEED_DEMO): one staff admin and assessor, one employer organisation with
 * an owner, and one candidate. Credentials come from DEV_* variables documented in .env.example.
 */
export async function seedDemo(deps: Pick<AppDeps, 'db' | 'clock' | 'log'>, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const password = env.DEV_DEMO_PASSWORD ?? 'LokusDemo-2026!';
  await ensureUser(deps, { email: env.DEV_ADMIN_EMAIL ?? 'admin@lokus.local', name: 'Asha Admin', kind: 'staff', platformRole: 'admin', password });
  await ensureUser(deps, { email: env.DEV_ASSESSOR_EMAIL ?? 'assessor@lokus.local', name: 'Arun Assessor', kind: 'staff', platformRole: 'assessor', password });
  const ownerId = await ensureUser(deps, { email: env.DEV_EMPLOYER_EMAIL ?? 'employer@lokus.local', name: 'Elena Employer', kind: 'employer', password });
  await ensureUser(deps, { email: env.DEV_CANDIDATE_EMAIL ?? 'candidate@lokus.local', name: 'Priya Candidate', kind: 'candidate', password });
  const [org] = await deps.db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, 'northwind-clinical'));
  const orgId =
    org?.id ??
    (await deps.db.insert(organizations).values({ name: 'Northwind Clinical Research', slug: 'northwind-clinical', createdBy: ownerId }).returning({ id: organizations.id }))[0].id;
  await deps.db.insert(memberships).values({ userId: ownerId, orgId, role: 'owner' }).onConflictDoNothing();
  deps.log.info('ensured local demo accounts (see DEV_* in .env.example)');
}
