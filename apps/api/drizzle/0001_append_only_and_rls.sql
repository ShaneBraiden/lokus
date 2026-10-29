-- Evidence integrity (spec "Events must be append-only"): evidence tables reject UPDATE, DELETE and TRUNCATE.
CREATE OR REPLACE FUNCTION lokus_forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END
$$;
--> statement-breakpoint
CREATE TRIGGER attempt_events_append_only BEFORE UPDATE OR DELETE ON attempt_events FOR EACH ROW EXECUTE FUNCTION lokus_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER attempt_events_no_truncate BEFORE TRUNCATE ON attempt_events FOR EACH STATEMENT EXECUTE FUNCTION lokus_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER reviewer_ratings_append_only BEFORE UPDATE OR DELETE ON reviewer_ratings FOR EACH ROW EXECUTE FUNCTION lokus_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER reviewer_ratings_no_truncate BEFORE TRUNCATE ON reviewer_ratings FOR EACH STATEMENT EXECUTE FUNCTION lokus_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER gr_dispositions_append_only BEFORE UPDATE OR DELETE ON gr_dispositions FOR EACH ROW EXECUTE FUNCTION lokus_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER gr_dispositions_no_truncate BEFORE TRUNCATE ON gr_dispositions FOR EACH STATEMENT EXECUTE FUNCTION lokus_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER consent_events_append_only BEFORE UPDATE OR DELETE ON consent_events FOR EACH ROW EXECUTE FUNCTION lokus_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER consent_events_no_truncate BEFORE TRUNCATE ON consent_events FOR EACH STATEMENT EXECUTE FUNCTION lokus_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER assessment_results_append_only BEFORE UPDATE OR DELETE ON assessment_results FOR EACH ROW EXECUTE FUNCTION lokus_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER assessment_results_no_truncate BEFORE TRUNCATE ON assessment_results FOR EACH STATEMENT EXECUTE FUNCTION lokus_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION lokus_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION lokus_forbid_mutation();
--> statement-breakpoint

-- A published scoring package (and its answer key) is immutable; only its status may move on (e.g. to retired).
CREATE OR REPLACE FUNCTION lokus_published_package_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'scoring package % is published and cannot be deleted', OLD.id USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' AND (
    NEW.rubric IS DISTINCT FROM OLD.rubric OR NEW.parameters IS DISTINCT FROM OLD.parameters OR
    NEW.phrase_lists IS DISTINCT FROM OLD.phrase_lists OR NEW.identifiers IS DISTINCT FROM OLD.identifiers OR
    NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.engine_version IS DISTINCT FROM OLD.engine_version
  ) THEN
    RAISE EXCEPTION 'scoring package % is published and immutable', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER scoring_packages_published_guard BEFORE UPDATE OR DELETE ON scoring_packages FOR EACH ROW EXECUTE FUNCTION lokus_published_package_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lokus_answer_key_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  pkg_status text;
BEGIN
  SELECT status INTO pkg_status FROM scoring_packages WHERE id = OLD.scoring_package_id;
  IF pkg_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'answer key for published package % is immutable', OLD.scoring_package_id USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER answer_keys_published_guard BEFORE UPDATE OR DELETE ON confidential.answer_keys FOR EACH ROW EXECUTE FUNCTION lokus_answer_key_guard();
--> statement-breakpoint

-- Row-level security on every table, with no policies. The application connects as the table owner (RLS does not
-- apply to owners), while Supabase's anon/authenticated roles behind the auto-generated Data API see no rows.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE org_invitations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE simulation_versions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE scoring_packages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE confidential.answer_keys ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE regression_runs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE retake_grants ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE attempt_progress ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE attempt_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE share_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE result_shares ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE review_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE reviewer_ratings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE gr_dispositions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;
