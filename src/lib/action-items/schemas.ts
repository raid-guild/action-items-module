import { z } from "zod";

export const itemStatuses = ["open", "active", "completed", "cancelled"] as const;
export const itemStatusSchema = z.enum(itemStatuses);
export type ItemStatus = z.infer<typeof itemStatusSchema>;

const optionalPositiveInteger = z.number().int().positive().nullable().optional();

export const createItemSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(100_000).optional().default(""),
  status: itemStatusSchema.optional().default("open"),
  assignedUserId: z.string().uuid().nullable().optional(),
  priority: optionalPositiveInteger,
  effort: optionalPositiveInteger
}).strict();

export const updateItemSchema = z.object({
  version: z.number().int().positive(),
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(100_000).optional(),
  status: itemStatusSchema.optional(),
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
  assignedTo: z.enum(["me", "unassigned"]).optional(),
  priority: z.coerce.number().int().positive().optional(),
  priorityMin: z.coerce.number().int().positive().optional(),
  priorityMax: z.coerce.number().int().positive().optional(),
  effortMin: z.coerce.number().int().positive().optional(),
  effortMax: z.coerce.number().int().positive().optional(),
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
