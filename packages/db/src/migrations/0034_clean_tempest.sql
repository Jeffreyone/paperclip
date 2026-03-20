CREATE TABLE "issue_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"from_issue_id" uuid NOT NULL,
	"to_issue_id" uuid NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_relations" ADD CONSTRAINT "issue_relations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_relations" ADD CONSTRAINT "issue_relations_from_issue_id_issues_id_fk" FOREIGN KEY ("from_issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_relations" ADD CONSTRAINT "issue_relations_to_issue_id_issues_id_fk" FOREIGN KEY ("to_issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_relations_from_issue_idx" ON "issue_relations" USING btree ("from_issue_id");--> statement-breakpoint
CREATE INDEX "issue_relations_to_issue_idx" ON "issue_relations" USING btree ("to_issue_id");--> statement-breakpoint
CREATE INDEX "issue_relations_type_idx" ON "issue_relations" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_relations_from_to-type_uniq" ON "issue_relations" USING btree ("from_issue_id","to_issue_id","type");