CREATE TABLE "hiring_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"decided_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hiring_decisions_decision_ck" CHECK ("hiring_decisions"."decision" in ('advance', 'hold', 'decline'))
);
--> statement-breakpoint
ALTER TABLE "hiring_decisions" ADD CONSTRAINT "hiring_decisions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_decisions" ADD CONSTRAINT "hiring_decisions_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hiring_decisions" ADD CONSTRAINT "hiring_decisions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hiring_decisions_org_attempt_idx" ON "hiring_decisions" USING btree ("org_id","attempt_id","created_at");--> statement-breakpoint
CREATE TRIGGER hiring_decisions_append_only BEFORE UPDATE OR DELETE ON hiring_decisions FOR EACH ROW EXECUTE FUNCTION lokus_forbid_mutation();--> statement-breakpoint
CREATE TRIGGER hiring_decisions_no_truncate BEFORE TRUNCATE ON hiring_decisions FOR EACH STATEMENT EXECUTE FUNCTION lokus_forbid_mutation();--> statement-breakpoint
ALTER TABLE "hiring_decisions" ENABLE ROW LEVEL SECURITY;