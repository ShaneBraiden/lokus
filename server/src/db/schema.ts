/**
 * Lokus database schema (PostgreSQL via Drizzle). Evidence tables are append-only: a trigger installed by the
 * custom migration rejects UPDATE, DELETE and TRUNCATE on attempt_events, reviewer_ratings, gr_dispositions,
 * consent_events, assessment_results and audit_log. The answer key lives in a separate "confidential" schema.
 */
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();

// ---------------------------------------------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stored lower-cased; unique. */
    email: text('email').notNull(),
    name: text('name').notNull(),
    /** candidate | employer | staff */
    kind: text('kind').notNull(),
    /** Staff only: admin | assessor */
    platformRole: text('platform_role'),
    passwordHash: text('password_hash'),
    emailVerifiedAt: ts('email_verified_at'),
    totpSecret: text('totp_secret'),
    totpEnabledAt: ts('totp_enabled_at'),
    totpLastStep: integer('totp_last_step'),
    disabledAt: ts('disabled_at'),
    lastLoginAt: ts('last_login_at'),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_uq').on(t.email),
    check('users_kind_ck', sql`${t.kind} in ('candidate', 'employer', 'staff')`),
    check('users_platform_role_ck', sql`${t.platformRole} is null or ${t.platformRole} in ('admin', 'assessor')`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    /** sha256 of the session token; the token itself only lives in the cookie. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    expiresAt: ts('expires_at').notNull(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    mfaVerifiedAt: ts('mfa_verified_at'),
    revokedAt: ts('revoked_at'),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const authTokens = pgTable(
  'auth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** verify_email | reset_password */
    purpose: text('purpose').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('auth_tokens_hash_uq').on(t.tokenHash)],
);

export const candidateProfiles = pgTable('candidate_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  headline: text('headline').notNull().default(''),
  location: text('location').notNull().default(''),
  talentPoolListed: boolean('talent_pool_listed').notNull().default(false),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    /** active | suspended */
    status: text('status').notNull().default('active'),
    inviteDeadlineDays: integer('invite_deadline_days').notNull().default(14),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('organizations_slug_uq').on(t.slug)],
);

export const memberships = pgTable(
  'memberships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** owner | recruiter */
    role: text('role').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId] }), index('memberships_org_idx').on(t.orgId), check('memberships_role_ck', sql`${t.role} in ('owner', 'recruiter')`)],
);

/** Invitations for employer team members (owner/recruiter). */
export const orgInvitations = pgTable(
  'org_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
    tokenHash: text('token_hash').notNull(),
    /** pending | accepted | revoked */
    status: text('status').notNull().default('pending'),
    expiresAt: ts('expires_at').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id),
    acceptedBy: uuid('accepted_by').references(() => users.id),
    createdAt: createdAt(),
    acceptedAt: ts('accepted_at'),
  },
  (t) => [uniqueIndex('org_invitations_token_uq').on(t.tokenHash), index('org_invitations_org_idx').on(t.orgId)],
);

/** Append-only consent history (terms, privacy, talent pool listing, result sharing). */
export const consentEvents = pgTable(
  'consent_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** terms | privacy | talent_pool | result_share */
    kind: text('kind').notNull(),
    /** grant | withdraw */
    action: text('action').notNull(),
    textVersion: text('text_version').notNull(),
    orgId: uuid('org_id').references(() => organizations.id),
    attemptId: uuid('attempt_id'),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('consent_events_user_idx').on(t.userId)],
);

// ---------------------------------------------------------------------------------------------------------------
// Simulation versions and scoring packages
// ---------------------------------------------------------------------------------------------------------------

export const simulationVersions = pgTable('simulation_versions', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  version: text('version').notNull(),
  title: text('title').notNull(),
  contentVersion: text('content_version').notNull(),
  /** active | retired */
  status: text('status').notNull().default('active'),
  createdAt: createdAt(),
});

export const scoringPackages = pgTable(
  'scoring_packages',
  {
    id: text('id').primaryKey(),
    simulationVersionId: text('simulation_version_id')
      .notNull()
      .references(() => simulationVersions.id),
    label: text('label').notNull(),
    /** draft | published | retired */
    status: text('status').notNull().default('draft'),
    engineVersion: text('engine_version').notNull(),
    rubric: jsonb('rubric').notNull(),
    parameters: jsonb('parameters').notNull(),
    phraseLists: jsonb('phrase_lists').notNull(),
    identifiers: jsonb('identifiers').notNull(),
    sha256: text('sha256').notNull(),
    smeStatus: text('sme_status').notNull().default('Draft; SME confirm'),
    notes: text('notes').notNull().default(''),
    regressionRunId: uuid('regression_run_id'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: createdAt(),
    publishedAt: ts('published_at'),
  },
  (t) => [index('scoring_packages_sim_idx').on(t.simulationVersionId)],
);

export const confidential = pgSchema('confidential');

/** CONFIDENTIAL: answer key per scoring package. Only the scoring service and the audited admin view read it. */
export const answerKeys = confidential.table('answer_keys', {
  scoringPackageId: text('scoring_package_id')
    .primaryKey()
    .references(() => scoringPackages.id),
  key: jsonb('key').notNull(),
  sha256: text('sha256').notNull(),
  createdAt: createdAt(),
});

export const regressionRuns = pgTable('regression_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  scoringPackageId: text('scoring_package_id')
    .notNull()
    .references(() => scoringPackages.id),
  passed: boolean('passed').notNull(),
  summary: jsonb('summary').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------------------------------------------
// Invitations, attempts and evidence
// ---------------------------------------------------------------------------------------------------------------

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    email: text('email').notNull(),
    name: text('name').notNull().default(''),
    simulationVersionId: text('simulation_version_id')
      .notNull()
      .references(() => simulationVersions.id),
    tokenHash: text('token_hash').notNull(),
    /** pending | accepted | revoked | expired */
    status: text('status').notNull().default('pending'),
    expiresAt: ts('expires_at').notNull(),
    deadlineAt: ts('deadline_at'),
    invitedBy: uuid('invited_by').references(() => users.id),
    acceptedBy: uuid('accepted_by').references(() => users.id),
    attemptId: uuid('attempt_id'),
    shareRequestId: uuid('share_request_id'),
    createdAt: createdAt(),
    acceptedAt: ts('accepted_at'),
    revokedAt: ts('revoked_at'),
    lastSentAt: ts('last_sent_at'),
  },
  (t) => [uniqueIndex('invitations_token_uq').on(t.tokenHash), index('invitations_org_idx').on(t.orgId), index('invitations_email_idx').on(t.email)],
);

export const retakeGrants = pgTable('retake_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  candidateId: uuid('candidate_id')
    .notNull()
    .references(() => users.id),
  simulationVersionId: text('simulation_version_id')
    .notNull()
    .references(() => simulationVersions.id),
  grantedBy: uuid('granted_by').references(() => users.id),
  reason: text('reason').notNull(),
  consumedAttemptId: uuid('consumed_attempt_id'),
  createdAt: createdAt(),
});

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => users.id),
    simulationVersionId: text('simulation_version_id')
      .notNull()
      .references(() => simulationVersions.id),
    scoringPackageId: text('scoring_package_id')
      .notNull()
      .references(() => scoringPackages.id),
    /** invite | self */
    origin: text('origin').notNull(),
    invitationId: uuid('invitation_id'),
    /** not_started | w1_in_progress | w1_submitted | w2_in_progress | submitted | closed | void */
    status: text('status').notNull().default('not_started'),
    lastSeq: integer('last_seq').notNull().default(0),
    lastHash: text('last_hash'),
    startedAt: ts('started_at'),
    t1SubmittedAt: ts('t1_submitted_at'),
    w2ClockStartedAt: ts('w2_clock_started_at'),
    t2SubmittedAt: ts('t2_submitted_at'),
    deadlineAt: ts('deadline_at'),
    closedAt: ts('closed_at'),
    closeReason: text('close_reason'),
    isRetake: boolean('is_retake').notNull().default(false),
    retakeGrantId: uuid('retake_grant_id'),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('attempts_candidate_idx').on(t.candidateId),
    uniqueIndex('attempts_one_per_version_uq').on(t.candidateId, t.simulationVersionId).where(sql`${t.isRetake} = false and ${t.status} <> 'void'`),
    check('attempts_origin_ck', sql`${t.origin} in ('invite', 'self')`),
  ],
);

/** Mutable resume state (current screen, unsent drafts). Never used for scoring. */
export const attemptProgress = pgTable('attempt_progress', {
  attemptId: uuid('attempt_id')
    .primaryKey()
    .references(() => attempts.id),
  state: jsonb('state').notNull().default({}),
  version: integer('version').notNull().default(0),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

/** APPEND-ONLY evidence log (spec "Immutable event model"). Written only through the event store service. */
export const attemptEvents = pgTable(
  'attempt_events',
  {
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    seq: integer('seq').notNull(),
    eventId: uuid('event_id').notNull(),
    taskId: text('task_id').notNull(),
    eventType: text('event_type').notNull(),
    objectId: text('object_id'),
    metadata: jsonb('metadata').notNull().default({}),
    /** O = server-observed, C = command, S = system, T = telemetry */
    source: text('source').notNull(),
    schemaV: smallint('schema_v').notNull().default(1),
    serverTs: ts('server_ts').notNull(),
    clientTs: ts('client_ts'),
    actorUserId: uuid('actor_user_id'),
    prevHash: text('prev_hash').notNull(),
    hash: text('hash').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.attemptId, t.seq] }),
    uniqueIndex('attempt_events_event_id_uq').on(t.eventId),
    check('attempt_events_source_ck', sql`${t.source} in ('O', 'C', 'S', 'T')`),
  ],
);

export const shareRequests = pgTable(
  'share_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => users.id),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    invitationId: uuid('invitation_id'),
    /** pending | approved | declined | cancelled */
    status: text('status').notNull().default('pending'),
    createdAt: createdAt(),
    decidedAt: ts('decided_at'),
  },
  (t) => [index('share_requests_candidate_idx').on(t.candidateId)],
);

export const resultShares = pgTable(
  'result_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    /** invite | reuse_consent */
    basis: text('basis').notNull(),
    consentEventId: uuid('consent_event_id'),
    grantedAt: ts('granted_at').notNull().defaultNow(),
    revokedAt: ts('revoked_at'),
  },
  (t) => [index('result_shares_org_idx').on(t.orgId), uniqueIndex('result_shares_active_uq').on(t.attemptId, t.orgId).where(sql`${t.revokedAt} is null`)],
);

// ---------------------------------------------------------------------------------------------------------------
// Review and results
// ---------------------------------------------------------------------------------------------------------------

export const reviewItems = pgTable(
  'review_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    /** open | in_progress | done */
    status: text('status').notNull().default('open'),
    assignedTo: uuid('assigned_to').references(() => users.id),
    priority: integer('priority').notNull().default(0),
    /** Pseudonym shown to assessors instead of the candidate's identity. */
    pseudonym: text('pseudonym').notNull(),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    completedAt: ts('completed_at'),
  },
  (t) => [uniqueIndex('review_items_attempt_uq').on(t.attemptId)],
);

export const reviewerRatings = pgTable(
  'reviewer_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Insertion order; "latest rating wins" is decided by this, never by timestamps. */
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    criterionId: text('criterion_id').notNull(),
    rawRating: smallint('raw_rating').notNull(),
    rationale: text('rationale').notNull(),
    assessorId: uuid('assessor_id')
      .notNull()
      .references(() => users.id),
    supersedesId: uuid('supersedes_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('reviewer_ratings_attempt_idx').on(t.attemptId),
    check('reviewer_ratings_rating_ck', sql`${t.rawRating} between 0 and 4`),
    check('reviewer_ratings_criterion_ck', sql`${t.criterionId} in ('T1_SEC4', 'T1_QUERY', 'T2_REFUSE', 'T2_WAIV', 'T2_REC', 'T2_TONE')`),
  ],
);

export const grDispositions = pgTable(
  'gr_dispositions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    clause: text('clause').notNull(),
    disposition: text('disposition').notNull(),
    note: text('note').notNull(),
    assessorId: uuid('assessor_id')
      .notNull()
      .references(() => users.id),
    supersedesId: uuid('supersedes_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('gr_dispositions_attempt_idx').on(t.attemptId),
    check('gr_dispositions_clause_ck', sql`${t.clause} in ('delay', 'waiver')`),
    check('gr_dispositions_value_ck', sql`${t.disposition} in ('cleared', 'confirmed')`),
  ],
);

export const assessmentResults = pgTable(
  'assessment_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id),
    resultVersion: integer('result_version').notNull(),
    scoringPackageId: text('scoring_package_id')
      .notNull()
      .references(() => scoringPackages.id),
    engineVersion: text('engine_version').notNull(),
    inputDigest: text('input_digest').notNull(),
    /** provisional | final */
    status: text('status').notNull(),
    outcome: text('outcome'),
    outcomeLocked: boolean('outcome_locked').notNull(),
    t1Q: integer('t1_q').notNull(),
    t2Q: integer('t2_q').notNull(),
    result: jsonb('result').notNull(),
    /** What caused this computation: t1_submit | t2_submit | rating | disposition | rescore | close */
    trigger: text('trigger').notNull(),
    computedAt: ts('computed_at').notNull(),
  },
  (t) => [uniqueIndex('assessment_results_version_uq').on(t.attemptId, t.resultVersion)],
);

// ---------------------------------------------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------------------------------------------

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorId: uuid('actor_id'),
    actorRole: text('actor_role').notNull(),
    orgId: uuid('org_id'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    ip: text('ip'),
    details: jsonb('details').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('audit_log_target_idx').on(t.targetType, t.targetId), index('audit_log_actor_idx').on(t.actorId)],
);

export const emailOutbox = pgTable('email_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  to: text('to').notNull(),
  template: text('template').notNull(),
  subject: text('subject').notNull(),
  /** logged | sent | failed */
  status: text('status').notNull(),
  providerId: text('provider_id'),
  error: text('error'),
  createdAt: createdAt(),
});
