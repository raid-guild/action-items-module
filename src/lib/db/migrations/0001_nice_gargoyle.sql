CREATE TABLE "action_items"."projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"portal_link_url" text,
	"status" text DEFAULT 'open' NOT NULL,
	CONSTRAINT "projects_title_length_check" CHECK (char_length(btrim("title")) between 1 and 300),
	CONSTRAINT "projects_status_check" CHECK ("status" in ('open', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "action_items"."items" ADD COLUMN "budget" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "action_items"."items" ADD COLUMN "project_id" uuid;
--> statement-breakpoint
CREATE TABLE "action_items"."item_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_notes_text_length_check" CHECK (char_length(btrim("text")) between 1 and 100000)
);
--> statement-breakpoint
ALTER TABLE "action_items"."items" ADD CONSTRAINT "items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "action_items"."projects"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "action_items"."item_notes" ADD CONSTRAINT "item_notes_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "action_items"."items"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "action_items"."item_notes" ADD CONSTRAINT "item_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "action_items"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "projects_status_title_idx" ON "action_items"."projects" USING btree ("status", "title");
--> statement-breakpoint
CREATE INDEX "items_project_status_idx" ON "action_items"."items" USING btree ("project_id", "status", "updated_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "item_notes_item_created_idx" ON "action_items"."item_notes" USING btree ("item_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "item_notes_user_idx" ON "action_items"."item_notes" USING btree ("user_id");
