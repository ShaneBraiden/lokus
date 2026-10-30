import { and, desc, eq } from 'drizzle-orm';
import type { AnswerKeyRow, Parameters, PhraseLists, RubricConfig, ScoringPackage } from '#engine';
import type { DbOrTx } from '../db/client';
import { answerKeys, scoringPackages } from '../db/schema';
import { conflict, notFound } from '../lib/errors';

const publishedCache = new Map<string, ScoringPackage>();

/** Loads a scoring package with its confidential answer key. Published packages are immutable and cached. */
export async function loadScoringPackage(db: DbOrTx, packageId: string): Promise<ScoringPackage> {
  const cached = publishedCache.get(packageId);
  if (cached) return cached;
  const [row] = await db
    .select({ pkg: scoringPackages, key: answerKeys.key })
    .from(scoringPackages)
    .innerJoin(answerKeys, eq(answerKeys.scoringPackageId, scoringPackages.id))
    .where(eq(scoringPackages.id, packageId));
  if (!row) throw notFound(`Scoring package ${packageId} not found.`);
  const pkg: ScoringPackage = {
    id: row.pkg.id,
    label: row.pkg.label,
    engine_version: row.pkg.engineVersion,
    rubric: row.pkg.rubric as RubricConfig,
    parameters: row.pkg.parameters as Parameters,
    phrase_lists: row.pkg.phraseLists as PhraseLists,
    identifiers: row.pkg.identifiers as ScoringPackage['identifiers'],
    answer_key: row.key as AnswerKeyRow[],
  };
  if (row.pkg.status !== 'draft') publishedCache.set(packageId, pkg);
  return pkg;
}

/** The newest published package for a simulation version; new attempts pin it. */
export async function activePackageId(db: DbOrTx, simulationVersionId: string): Promise<string> {
  const [row] = await db
    .select({ id: scoringPackages.id })
    .from(scoringPackages)
    .where(and(eq(scoringPackages.simulationVersionId, simulationVersionId), eq(scoringPackages.status, 'published')))
    .orderBy(desc(scoringPackages.publishedAt))
    .limit(1);
  if (!row) throw conflict('no_published_package', 'No published scoring package exists for this simulation.');
  return row.id;
}

export function clearPackageCache(): void {
  publishedCache.clear();
}
