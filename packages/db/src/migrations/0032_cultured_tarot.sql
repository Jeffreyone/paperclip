CREATE TABLE "plugin_config_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"config_json" jsonb NOT NULL,
	"change_summary" text,
	"changed_by_user_id" text,
	"changed_by_agent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"version" text NOT NULL,
	"package_path" text NOT NULL,
	"manifest_json" jsonb NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uninstalled_at" timestamp with time zone,
	"uninstall_reason" text,
	"is_active" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plugins" ADD COLUMN "crash_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plugins" ADD COLUMN "last_crash_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plugin_config_revisions" ADD CONSTRAINT "plugin_config_revisions_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_versions" ADD CONSTRAINT "plugin_versions_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_config_revisions_plugin_id_revision_idx" ON "plugin_config_revisions" USING btree ("plugin_id","revision_number");--> statement-breakpoint
CREATE INDEX "plugin_config_revisions_plugin_created_idx" ON "plugin_config_revisions" USING btree ("plugin_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_versions_plugin_id_version_idx" ON "plugin_versions" USING btree ("plugin_id","version");--> statement-breakpoint
CREATE INDEX "plugin_versions_active_idx" ON "plugin_versions" USING btree ("plugin_id","is_active");