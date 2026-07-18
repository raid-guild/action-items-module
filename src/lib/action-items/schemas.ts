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
  portalLinkUrl: z.string().trim().url().max(2_048).nullable().optional(),
  status: projectStatusSchema.optional().default("open")
}).strict();

export const updateProjectSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(100_000).optional(),
  portalLinkUrl: z.string().trim().url().max(2_048).nullable().optional(),
  status: projectStatusSchema.optional()
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one mutable field is required."
});

export const listProjectsQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(100)
});

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
