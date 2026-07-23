import { z } from "zod";

export const itemStatuses = ["open", "active", "completed", "cancelled"] as const;
export const itemStatusSchema = z.enum(itemStatuses);
export type ItemStatus = z.infer<typeof itemStatusSchema>;

export const projectStatuses = ["open", "closed"] as const;
export const projectStatusSchema = z.enum(projectStatuses);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

const optionalPositiveInteger = z.number().int().positive().nullable().optional();

export const createItemSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(100_000).optional().default(""),
  budget: z.string().max(10_000).optional().default(""),
  status: itemStatusSchema.optional().default("open"),
  projectId: z.string().uuid().nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  priority: optionalPositiveInteger,
  effort: optionalPositiveInteger
}).strict();

export const updateItemSchema = z.object({
  version: z.number().int().positive(),
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(100_000).optional(),
  budget: z.string().max(10_000).optional(),
  status: itemStatusSchema.optional(),
  projectId: z.string().uuid().nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  priority: optionalPositiveInteger,
  effort: optionalPositiveInteger
}).strict().refine((value) => Object.keys(value).some((key) => key !== "version"), {
  message: "At least one mutable field is required."
});

export const listItemsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.string().optional(),
  assigneeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  projectIds: z.string().max(4_000).optional(),
  projectAssignment: z.literal("unassigned").optional(),
  assignedTo: z.enum(["me", "unassigned"]).optional(),
  priority: z.coerce.number().int().positive().optional(),
  priorities: z.string().max(1_000).optional(),
  priorityMin: z.coerce.number().int().positive().optional(),
  priorityMax: z.coerce.number().int().positive().optional(),
  effortMin: z.coerce.number().int().positive().optional(),
  effortMax: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().max(1000).optional()
});

export const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(100_000).optional().default(""),
  intent: z.string().max(100_000).optional().default(""),
  portalLinkUrl: z.string().trim().url().max(2_048).nullable().optional(),
  status: projectStatusSchema.optional().default("open")
}).strict();

export const updateProjectSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(100_000).optional(),
  intent: z.string().max(100_000).optional(),
  portalLinkUrl: z.string().trim().url().max(2_048).nullable().optional(),
  status: projectStatusSchema.optional()
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one mutable field is required."
});

export const listProjectsQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(100)
});

const plausibleMetrics = [
  "visitors", "visits", "pageviews", "views_per_visit", "bounce_rate", "visit_duration",
  "events", "scroll_depth", "conversion_rate", "group_conversion_rate", "time_on_page"
] as const;

export const plausibleMeasurementConfigSchema = z.object({
  provider: z.literal("plausible"),
  siteIds: z.array(z.string().trim().min(1).max(253)).min(1).max(25)
    .refine((values) => new Set(values).size === values.length, "Site IDs must be unique."),
  metric: z.enum(plausibleMetrics),
  aggregation: z.enum(["sum", "average", "minimum", "maximum"]),
  dateRange: z.discriminatedUnion("type", [
    z.object({ type: z.literal("rolling"), days: z.number().int().min(1).max(365) }).strict(),
    z.object({ type: z.literal("fixed"), start: z.string().date(), end: z.string().date() }).strict()
  ]),
  campaignFilter: z.object({
    property: z.enum(["visit:utm_campaign", "visit:utm_source", "visit:utm_medium", "visit:utm_content", "visit:utm_term", "visit:source"]),
    value: z.string().trim().min(1).max(200)
  }).strict().nullable(),
  sharedGoalName: z.string().trim().min(1).max(200).nullable(),
  siteGoalOverrides: z.array(z.object({
    siteId: z.string().trim().min(1).max(253),
    goalName: z.string().trim().min(1).max(200)
  }).strict()).max(25),
  requireCompleteCoverage: z.boolean()
}).strict().superRefine((config, context) => {
  if (config.dateRange.type === "fixed" && config.dateRange.start > config.dateRange.end) {
    context.addIssue({ code: "custom", message: "Start date must not be after end date.", path: ["dateRange", "end"] });
  }
  const siteIds = new Set(config.siteIds);
  const overrideIds = config.siteGoalOverrides.map((override) => override.siteId);
  if (new Set(overrideIds).size !== overrideIds.length) context.addIssue({ code: "custom", message: "Each site can have only one goal override.", path: ["siteGoalOverrides"] });
  overrideIds.forEach((siteId, index) => {
    if (!siteIds.has(siteId)) context.addIssue({ code: "custom", message: "Goal overrides must reference a configured site.", path: ["siteGoalOverrides", index, "siteId"] });
  });
});

export const kpiMeasurementConfigSchema = plausibleMeasurementConfigSchema.nullable();

export const createProjectKpiSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).optional().default(""),
  unit: z.string().trim().min(1).max(40).optional().default("number"),
  source: z.string().trim().min(1).max(80).optional().default("manual"),
  sourceUrl: z.string().trim().url().max(2_048).nullable().optional(),
  measurementConfig: kpiMeasurementConfigSchema.optional().default(null),
  baselineValue: z.number().finite(),
  targetValue: z.number().finite(),
  weight: z.number().int().min(1).max(10).optional().default(1)
}).strict().refine((value) => value.targetValue !== value.baselineValue, {
  message: "Target must be different from baseline.", path: ["targetValue"]
});

export const updateProjectKpiSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(10_000).optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  source: z.string().trim().min(1).max(80).optional(),
  sourceUrl: z.string().trim().url().max(2_048).nullable().optional(),
  measurementConfig: kpiMeasurementConfigSchema.optional(),
  baselineValue: z.number().finite().optional(),
  targetValue: z.number().finite().optional(),
  weight: z.number().int().min(1).max(10).optional()
}).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one mutable field is required." });

export const createProjectKpiSnapshotSchema = z.object({
  value: z.number().finite(),
  note: z.string().max(2_000).optional().default(""),
  capturedAt: z.string().datetime().optional()
}).strict();

export const createItemNoteSchema = z.object({
  text: z.string().trim().min(1).max(100_000)
}).strict();

export const listItemNotesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().max(1000).optional()
});

export const listHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().max(1000).optional(),
  eventType: z.enum(["created", "field_changed"]).optional(),
  fieldName: z.string().max(50).optional()
});

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  active: z.enum(["true", "false"]).optional().default("true"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().max(1000).optional()
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateProjectKpiInput = z.infer<typeof createProjectKpiSchema>;
export type CreateProjectKpiSnapshotInput = z.infer<typeof createProjectKpiSnapshotSchema>;
export type UpdateProjectKpiInput = z.infer<typeof updateProjectKpiSchema>;
export type PlausibleMeasurementConfig = z.infer<typeof plausibleMeasurementConfigSchema>;
