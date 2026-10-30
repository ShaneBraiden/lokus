CREATE SCHEMA "confidential";
--> statement-breakpoint
CREATE TABLE "confidential"."answer_keys" (
	"scoring_package_id" text PRIMARY KEY NOT NULL,
	"key" jsonb NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"result_version" integer NOT NULL,
	"scoring_package_id" text NOT NULL,
	"engine_version" text NOT NULL,
	"input_digest" text NOT NULL,
	"status" text NOT NULL,
	"outcome" text,
	"outcome_locked" boolean NOT NULL,
	"t1_q" integer NOT NULL,
	"t2_q" integer NOT NULL,
	"result" jsonb NOT NULL,
	"trigger" text NOT NULL,
	"computed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempt_events" (
	"attempt_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"event_id" uuid NOT NULL,
	"task_id" text NOT NULL,
	"event_type" text NOT NULL,
	"object_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text NOT NULL,
	"schema_v" smallint DEFAULT 1 NOT NULL,
	"server_ts" timestamp with time zone NOT NULL,
	"client_ts" timestamp with time zone,
	"actor_user_id" uuid,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL,
	CONSTRAINT "attempt_events_attempt_id_seq_pk" PRIMARY KEY("attempt_id","seq"),
	CONSTRAINT "attempt_events_source_ck" CHECK ("attempt_events"."source" in ('O', 'C', 'S', 'T'))
);
--> statement-breakpoint
CREATE TABLE "attempt_progress" (
	"attempt_id" uuid PRIMARY KEY NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"simulation_version_id" text NOT NULL,
	"scoring_package_id" text NOT NULL,
	"origin" text NOT NULL,
	"invitation_id" uuid,
	"status" text DEFAULT 'not_started' NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL,
	"last_hash" text,
	"started_at" timestamp with time zone,
	"t1_submitted_at" timestamp with time zone,
	"w2_clock_started_at" timestamp with time zone,
	"t2_submitted_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"close_reason" text,
	"is_retake" boolean DEFAULT false NOT NULL,
	"retake_grant_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempts_origin_ck" CHECK ("attempts"."origin" in ('invite', 'self'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"actor_role" text NOT NULL,
	"org_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"ip" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" text NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"talent_pool_listed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"action" text NOT NULL,
	"text_version" text NOT NULL,
	"org_id" uuid,
	"attempt_id" uuid,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"template" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"provider_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gr_dispositions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"clause" text NOT NULL,
	"disposition" text NOT NULL,
	"note" text NOT NULL,
	"assessor_id" uuid NOT NULL,
	"supersedes_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gr_dispositions_clause_ck" CHECK ("gr_dispositions"."clause" in ('delay', 'waiver')),
	CONSTRAINT "gr_dispositions_value_ck" CHECK ("gr_dispositions"."disposition" in ('cleared', 'confirmed'))
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"simulation_version_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"deadline_at" timestamp with time zone,
	"invited_by" uuid,
	"accepted_by" uuid,
	"attempt_id" uuid,
	"share_request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_user_id_org_id_pk" PRIMARY KEY("user_id","org_id"),
	CONSTRAINT "memberships_role_ck" CHECK ("memberships"."role" in ('owner', 'recruiter'))
);
--> statement-breakpoint
CREATE TABLE "org_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by" uuid,
	"accepted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"invite_deadline_days" integer DEFAULT 14 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regression_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scoring_package_id" text NOT NULL,
	"passed" boolean NOT NULL,
	"summary" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"basis" text NOT NULL,
	"consent_event_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "retake_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"simulation_version_id" text NOT NULL,
	"granted_by" uuid,
	"reason" text NOT NULL,
	"consumed_attempt_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"priority" integer DEFAULT 0 NOT NULL,
	"pseudonym" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reviewer_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"criterion_id" text NOT NULL,
	"raw_rating" smallint NOT NULL,
	"rationale" text NOT NULL,
	"assessor_id" uuid NOT NULL,
	"supersedes_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviewer_ratings_rating_ck" CHECK ("reviewer_ratings"."raw_rating" between 0 and 4),
	CONSTRAINT "reviewer_ratings_criterion_ck" CHECK ("reviewer_ratings"."criterion_id" in ('T1_SEC4', 'T1_QUERY', 'T2_REFUSE', 'T2_WAIV', 'T2_REC', 'T2_TONE'))
);
--> statement-breakpoint
CREATE TABLE "scoring_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"simulation_version_id" text NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"engine_version" text NOT NULL,
	"rubric" jsonb NOT NULL,
	"parameters" jsonb NOT NULL,
	"phrase_lists" jsonb NOT NULL,
	"identifiers" jsonb NOT NULL,
	"sha256" text NOT NULL,
	"sme_status" text DEFAULT 'Draft; SME confirm' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"regression_run_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mfa_verified_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "share_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"invitation_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "simulation_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"content_version" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"platform_role" text,
	"password_hash" text,
	"email_verified_at" timestamp with time zone,
	"totp_secret" text,
	"totp_enabled_at" timestamp with time zone,
	"totp_last_step" integer,
	"disabled_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_kind_ck" CHECK ("users"."kind" in ('candidate', 'employer', 'staff')),
	CONSTRAINT "users_platform_role_ck" CHECK ("users"."platform_role" is null or "users"."platform_role" in ('admin', 'assessor'))
);
--> statement-breakpoint
ALTER TABLE "confidential"."answer_keys" ADD CONSTRAINT "answer_keys_scoring_package_id_scoring_packages_id_fk" FOREIGN KEY ("scoring_package_id") REFERENCES "public"."scoring_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_scoring_package_id_scoring_packages_id_fk" FOREIGN KEY ("scoring_package_id") REFERENCES "public"."scoring_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_events" ADD CONSTRAINT "attempt_events_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_progress" ADD CONSTRAINT "attempt_progress_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_simulation_version_id_simulation_versions_id_fk" FOREIGN KEY ("simulation_version_id") REFERENCES "public"."simulation_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_scoring_package_id_scoring_packages_id_fk" FOREIGN KEY ("scoring_package_id") REFERENCES "public"."scoring_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gr_dispositions" ADD CONSTRAINT "gr_dispositions_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gr_dispositions" ADD CONSTRAINT "gr_dispositions_assessor_id_users_id_fk" FOREIGN KEY ("assessor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_simulation_version_id_simulation_versions_id_fk" FOREIGN KEY ("simulation_version_id") REFERENCES "public"."simulation_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD CONSTRAINT "regression_runs_scoring_package_id_scoring_packages_id_fk" FOREIGN KEY ("scoring_package_id") REFERENCES "public"."scoring_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD CONSTRAINT "regression_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_shares" ADD CONSTRAINT "result_shares_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_shares" ADD CONSTRAINT "result_shares_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retake_grants" ADD CONSTRAINT "retake_grants_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retake_grants" ADD CONSTRAINT "retake_grants_simulation_version_id_simulation_versions_id_fk" FOREIGN KEY ("simulation_version_id") REFERENCES "public"."simulation_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retake_grants" ADD CONSTRAINT "retake_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_ratings" ADD CONSTRAINT "reviewer_ratings_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_ratings" ADD CONSTRAINT "reviewer_ratings_assessor_id_users_id_fk" FOREIGN KEY ("assessor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_packages" ADD CONSTRAINT "scoring_packages_simulation_version_id_simulation_versions_id_fk" FOREIGN KEY ("simulation_version_id") REFERENCES "public"."simulation_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_packages" ADD CONSTRAINT "scoring_packages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_requests" ADD CONSTRAINT "share_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_requests" ADD CONSTRAINT "share_requests_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_requests" ADD CONSTRAINT "share_requests_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_results_version_uq" ON "assessment_results" USING btree ("attempt_id","result_version");--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_events_event_id_uq" ON "attempt_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "attempts_candidate_idx" ON "attempts" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_one_per_version_uq" ON "attempts" USING btree ("candidate_id","simulation_version_id") WHERE "attempts"."is_retake" = false and "attempts"."status" <> 'void';--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_tokens_hash_uq" ON "auth_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "consent_events_user_idx" ON "consent_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gr_dispositions_attempt_idx" ON "gr_dispositions" USING btree ("attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_uq" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitations_org_idx" ON "invitations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "memberships_org_idx" ON "memberships" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_invitations_token_uq" ON "org_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "org_invitations_org_idx" ON "org_invitations" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uq" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "result_shares_org_idx" ON "result_shares" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "result_shares_active_uq" ON "result_shares" USING btree ("attempt_id","org_id") WHERE "result_shares"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "review_items_attempt_uq" ON "review_items" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "reviewer_ratings_attempt_idx" ON "reviewer_ratings" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "scoring_packages_sim_idx" ON "scoring_packages" USING btree ("simulation_version_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "share_requests_candidate_idx" ON "share_requests" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");