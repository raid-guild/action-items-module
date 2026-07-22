import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, index, integer, jsonb, pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const actionItemsSchema = pgSchema("action_items");

export const users = actionItemsSchema.table(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portalUserId: text("portal_user_id").notNull(),
    portalProfileId: text("portal_profile_id"),
    name: text("name"),
    handle: text("handle"),
    avatarUrl: text("avatar_url"),
    roles: jsonb("roles").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("users_portal_user_id_uidx").on(table.portalUserId),
    uniqueIndex("users_portal_profile_id_uidx").on(table.portalProfileId),
    index("users_handle_idx").on(table.handle)
  ]
);

export const projects = actionItemsSchema.table(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    intent: text("intent").notNull().default(""),
    portalLinkUrl: text("portal_link_url"),
    status: text("status").notNull().default("open")
  },
  (table) => [
    check("projects_title_length_check", sql`char_length(btrim(${table.title})) between 1 and 300`),
    check("projects_status_check", sql`${table.status} in ('open', 'closed')`),
    index("projects_status_title_idx").on(table.status, table.title)
  ]
);

export const projectKpis = actionItemsSchema.table(
  "project_kpis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    unit: text("unit").notNull().default("number"),
    source: text("source").notNull().default("manual"),
    sourceUrl: text("source_url"),
    measurementConfig: jsonb("measurement_config").$type<Record<string, unknown> | null>(),
    baselineValue: doublePrecision("baseline_value").notNull(),
    targetValue: doublePrecision("target_value").notNull(),
    weight: integer("weight").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("project_kpis_name_length_check", sql`char_length(btrim(${table.name})) between 1 and 200`),
    check("project_kpis_weight_check", sql`${table.weight} between 1 and 10`),
    check("project_kpis_target_check", sql`${table.targetValue} <> ${table.baselineValue}`),
    index("project_kpis_project_idx").on(table.projectId, table.createdAt)
  ]
);

export const projectKpiSnapshots = actionItemsSchema.table(
  "project_kpi_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kpiId: uuid("kpi_id").notNull().references(() => projectKpis.id, { onDelete: "cascade" }),
    value: doublePrecision("value").notNull(),
    note: text("note").notNull().default(""),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("project_kpi_snapshots_kpi_captured_idx").on(table.kpiId, table.capturedAt, table.id)
  ]
);

export const items = actionItemsSchema.table(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    budget: text("budget").notNull().default(""),
    status: text("status").notNull().default("open"),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "restrict" }),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, { onDelete: "restrict" }),
    priority: integer("priority"),
    effort: integer("effort"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("items_title_length_check", sql`char_length(btrim(${table.title})) between 1 and 300`),
    check("items_status_check", sql`${table.status} in ('open', 'active', 'completed', 'cancelled')`),
    check("items_priority_check", sql`${table.priority} is null or ${table.priority} > 0`),
    check("items_effort_check", sql`${table.effort} is null or ${table.effort} > 0`),
    index("items_default_order_idx").on(table.priority.asc().nullsLast(), table.updatedAt.desc(), table.id.desc()),
    index("items_status_updated_idx").on(table.status, table.updatedAt.desc(), table.id.desc()),
    index("items_project_status_idx").on(table.projectId, table.status, table.updatedAt.desc()),
    index("items_assignee_status_priority_idx").on(table.assignedUserId, table.status, table.priority, table.id)
  ]
);

export const itemNotes = actionItemsSchema.table(
  "item_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "restrict" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("item_notes_text_length_check", sql`char_length(btrim(${table.text})) between 1 and 100000`),
    index("item_notes_item_created_idx").on(table.itemId, table.createdAt.desc(), table.id.desc()),
    index("item_notes_user_idx").on(table.userId)
  ]
);

export const itemEvents = actionItemsSchema.table(
  "item_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").notNull(),
    eventType: text("event_type").notNull(),
    fieldName: text("field_name"),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    actorLabel: text("actor_label").notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("item_events_type_check", sql`${table.eventType} in ('created', 'field_changed')`),
    check("item_events_actor_type_check", sql`${table.actorType} in ('portal_user', 'agent', 'system')`),
    index("item_events_item_created_idx").on(table.itemId, table.createdAt.desc(), table.id.desc()),
    index("item_events_request_idx").on(table.requestId)
  ]
);

export const idempotencyKeys = actionItemsSchema.table(
  "idempotency_keys",
  {
    principalId: text("principal_id").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
  },
  (table) => [
    primaryKey({ columns: [table.principalId, table.key], name: "idempotency_keys_pk" }),
    index("idempotency_keys_expires_idx").on(table.expiresAt)
  ]
);

export type UserRow = typeof users.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type ProjectKpiRow = typeof projectKpis.$inferSelect;
export type ProjectKpiSnapshotRow = typeof projectKpiSnapshots.$inferSelect;
export type ItemRow = typeof items.$inferSelect;
export type ItemNoteRow = typeof itemNotes.$inferSelect;
export type ItemEventRow = typeof itemEvents.$inferSelect;
