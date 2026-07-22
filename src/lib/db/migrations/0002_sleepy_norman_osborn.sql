CREATE TABLE "action_items"."project_kpi_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kpi_id" uuid NOT NULL,
	"value" double precision NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_items"."project_kpis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT 'number' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_url" text,
	"baseline_value" double precision NOT NULL,
	"target_value" double precision NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_kpis_name_length_check" CHECK (char_length(btrim("action_items"."project_kpis"."name")) between 1 and 200),
	CONSTRAINT "project_kpis_weight_check" CHECK ("action_items"."project_kpis"."weight" between 1 and 10),
	CONSTRAINT "project_kpis_target_check" CHECK ("action_items"."project_kpis"."target_value" <> "action_items"."project_kpis"."baseline_value")
);
--> statement-breakpoint
ALTER TABLE "action_items"."projects" ADD COLUMN "intent" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "action_items"."project_kpi_snapshots" ADD CONSTRAINT "project_kpi_snapshots_kpi_id_project_kpis_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "action_items"."project_kpis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items"."project_kpis" ADD CONSTRAINT "project_kpis_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "action_items"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_kpi_snapshots_kpi_captured_idx" ON "action_items"."project_kpi_snapshots" USING btree ("kpi_id","captured_at","id");--> statement-breakpoint
CREATE INDEX "project_kpis_project_idx" ON "action_items"."project_kpis" USING btree ("project_id","created_at");