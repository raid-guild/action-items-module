CREATE SCHEMA IF NOT EXISTS "action_items";
--> statement-breakpoint
CREATE TABLE "action_items"."users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "portal_user_id" text NOT NULL,
  "portal_profile_id" text,
  "name" text,
  "handle" text,
  "avatar_url" text,
  "roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_items"."items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "assigned_user_id" uuid,
  "priority" integer,
  "effort" integer,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "items_title_length_check" CHECK (char_length(btrim("title")) between 1 and 300),
  CONSTRAINT "items_status_check" CHECK ("status" in ('open', 'active', 'completed', 'cancelled')),
  CONSTRAINT "items_priority_check" CHECK ("priority" is null or "priority" > 0),
  CONSTRAINT "items_effort_check" CHECK ("effort" is null or "effort" > 0)
);
--> statement-breakpoint
CREATE TABLE "action_items"."item_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "field_name" text,
  "old_value" jsonb,
  "new_value" jsonb,
  "actor_type" text NOT NULL,
  "actor_id" text NOT NULL,
  "actor_label" text NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "item_events_type_check" CHECK ("event_type" in ('created', 'field_changed')),
  CONSTRAINT "item_events_actor_type_check" CHECK ("actor_type" in ('portal_user', 'agent', 'system'))
);
--> statement-breakpoint
CREATE TABLE "action_items"."idempotency_keys" (
  "principal_id" text NOT NULL,
  "key" text NOT NULL,
  "request_hash" text NOT NULL,
  "item_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "idempotency_keys_pk" PRIMARY KEY("principal_id", "key")
);
--> statement-breakpoint
ALTER TABLE "action_items"."items" ADD CONSTRAINT "items_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "action_items"."users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "action_items"."item_events" ADD CONSTRAINT "item_events_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "action_items"."items"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "action_items"."idempotency_keys" ADD CONSTRAINT "idempotency_keys_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "action_items"."items"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE UNIQUE INDEX "users_portal_user_id_uidx" ON "action_items"."users" ("portal_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "users_portal_profile_id_uidx" ON "action_items"."users" ("portal_profile_id");
--> statement-breakpoint
CREATE INDEX "users_handle_idx" ON "action_items"."users" ("handle");
--> statement-breakpoint
CREATE INDEX "items_default_order_idx" ON "action_items"."items" ("priority" ASC NULLS LAST, "updated_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "items_status_updated_idx" ON "action_items"."items" ("status", "updated_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "items_assignee_status_priority_idx" ON "action_items"."items" ("assigned_user_id", "status", "priority", "id");
--> statement-breakpoint
CREATE INDEX "item_events_item_created_idx" ON "action_items"."item_events" ("item_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "item_events_request_idx" ON "action_items"."item_events" ("request_id");
--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_idx" ON "action_items"."idempotency_keys" ("expires_at");
