CREATE TABLE "employer_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"job_title" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"team_size" text DEFAULT '' NOT NULL,
	"hiring_needs" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decision_note" text DEFAULT '' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"org_id" uuid,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employer_access_requests_status_ck" CHECK ("employer_access_requests"."status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "employer_access_requests" ADD CONSTRAINT "employer_access_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_access_requests" ADD CONSTRAINT "employer_access_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employer_access_requests_status_idx" ON "employer_access_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "employer_access_requests_email_idx" ON "employer_access_requests" USING btree ("email");--> statement-breakpoint
ALTER TABLE "employer_access_requests" ENABLE ROW LEVEL SECURITY;