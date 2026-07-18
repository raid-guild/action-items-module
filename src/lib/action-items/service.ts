import { createHash, randomUUID } from "node:crypto";
import {
  and, asc, desc, eq, gt, gte, ilike, inArray, isNull, lt, lte, or, sql, type SQL
} from "drizzle-orm";
import { z } from "zod";
import type { Actor } from "@/lib/auth/actor";
import { ApiError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import {
  idempotencyKeys, itemEvents, itemNotes, items, projects, users,
  type ItemEventRow, type ItemNoteRow, type ItemRow, type ProjectRow, type UserRow
} from "@/lib/db/schema";
import {
  itemStatusSchema, projectStatusSchema,
  type CreateItemInput, type CreateProjectInput, type UpdateItemInput
} from "@/lib/action-items/schemas";

export type UserSummary = {
  id: string;
  portalProfileId: string | null;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  isActive: boolean;
};

export type ProjectSummary = {
  id: string;
  title: string;
  description: string;
  portalLinkUrl: string | null;
  status: "open" | "closed";
};

export type ActionItemNote = {
  id: string;
  text: string;
  user: UserSummary;
  createdAt: string;
};

export type ActionItem = {
  id: string;
  title: string;
  description: string;
  budget: string;
  status: "open" | "active" | "completed" | "cancelled";
  project: ProjectSummary | null;
  assignee: UserSummary | null;
  priority: number | null;
  effort: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ActionItemEvent = {
  id: string;
  requestId: string;
  eventType: "created" | "field_changed";
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  actor: { type: string; id: string; label: string };
  createdAt: string;
};

export async function listActionItems(input: {
  q?: string;
  status?: string;
  assigneeId?: string;
  projectId?: string;
  assignedTo?: "me" | "unassigned";
  priority?: number;
  priorityMin?: number;
  priorityMax?: number;
  effortMin?: number;
  effortMax?: number;
  limit: number;
  cursor?: string;
}, actor: Actor) {
  const db = getDb();
  const conditions: SQL[] = [];

  if (input.q) {
    const query = `%${escapeLike(input.q)}%`;
    conditions.push(or(ilike(items.title, query), ilike(items.description, query))!);
  }
  if (input.status) {
    const statuses = input.status.split(",").map((value) => value.trim()).filter(Boolean);
    const parsed = z.array(itemStatusSchema).min(1).safeParse(statuses);
    if (!parsed.success) throw new ApiError(422, "INVALID_STATUS_FILTER", "One or more status filters are invalid.");
    conditions.push(inArray(items.status, parsed.data));
  }
  if (input.assigneeId) conditions.push(eq(items.assignedUserId, input.assigneeId));
  if (input.projectId) conditions.push(eq(items.projectId, input.projectId));
  if (input.assignedTo === "unassigned") conditions.push(isNull(items.assignedUserId));
  if (input.assignedTo === "me") {
    if (!actor.localUserId) throw new ApiError(422, "ME_FILTER_UNAVAILABLE", "assignedTo=me requires a Portal user session.");
    conditions.push(eq(items.assignedUserId, actor.localUserId));
  }
  if (input.priority !== undefined) conditions.push(eq(items.priority, input.priority));
  if (input.priorityMin !== undefined) conditions.push(gte(items.priority, input.priorityMin));
  if (input.priorityMax !== undefined) conditions.push(lte(items.priority, input.priorityMax));
  if (input.effortMin !== undefined) conditions.push(gte(items.effort, input.effortMin));
  if (input.effortMax !== undefined) conditions.push(lte(items.effort, input.effortMax));

  if (input.cursor) {
    const cursor = decodeCursor(input.cursor, itemCursorSchema);
    const cursorTime = new Date(cursor.updatedAt);
    const withinSamePriority = and(
      cursor.priority === null ? isNull(items.priority) : eq(items.priority, cursor.priority),
      or(lt(items.updatedAt, cursorTime), and(eq(items.updatedAt, cursorTime), lt(items.id, cursor.id)))
    );
    conditions.push(cursor.priority === null
      ? withinSamePriority!
      : or(gt(items.priority, cursor.priority), isNull(items.priority), withinSamePriority)!);
  }

  const rows = await db.select({ item: items, assignee: users, project: projects })
    .from(items)
    .leftJoin(users, eq(items.assignedUserId, users.id))
    .leftJoin(projects, eq(items.projectId, projects.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${items.priority} asc nulls last`, desc(items.updatedAt), desc(items.id))
    .limit(input.limit + 1);

  const hasMore = rows.length > input.limit;
  const pageRows = rows.slice(0, input.limit);
  const last = pageRows.at(-1)?.item;
  return {
    items: pageRows.map((row) => itemDto(row.item, row.assignee, row.project)),
    page: {
      hasMore,
      nextCursor: hasMore && last ? encodeCursor({ priority: last.priority, updatedAt: last.updatedAt.toISOString(), id: last.id }) : null
    }
  };
}

export async function getActionItem(itemId: string) {
  const db = getDb();
  const [row] = await db.select({ item: items, assignee: users, project: projects })
    .from(items)
    .leftJoin(users, eq(items.assignedUserId, users.id))
    .leftJoin(projects, eq(items.projectId, projects.id))
    .where(eq(items.id, itemId))
    .limit(1);
  if (!row) throw new ApiError(404, "ITEM_NOT_FOUND", "Action item not found.");
  return itemDto(row.item, row.assignee, row.project);
}

export async function createActionItem(input: CreateItemInput, actor: Actor, idempotencyKey?: string | null) {
  const db = getDb();
  const requestId = randomUUID();
  const normalizedKey = idempotencyKey?.trim() || null;
  if (normalizedKey && normalizedKey.length > 200) throw new ApiError(422, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be 200 characters or fewer.");
  const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");

  const result = await db.transaction(async (tx) => {
    if (normalizedKey) {
      const [existing] = await tx.select().from(idempotencyKeys).where(and(
        eq(idempotencyKeys.principalId, actor.id),
        eq(idempotencyKeys.key, normalizedKey)
      )).limit(1);
      if (existing) {
        if (existing.expiresAt > new Date()) {
          if (existing.requestHash !== requestHash) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "This idempotency key was used with a different request.");
          return { itemId: existing.itemId, requestId, replayed: true, events: [] as ItemEventRow[] };
        }
        await tx.delete(idempotencyKeys).where(and(
          eq(idempotencyKeys.principalId, actor.id),
          eq(idempotencyKeys.key, normalizedKey)
        ));
      }
    }

    const assignee = input.assignedUserId ? await requireUser(tx, input.assignedUserId) : null;
    const project = input.projectId ? await requireProject(tx, input.projectId) : null;
    const [item] = await tx.insert(items).values({
      title: input.title,
      description: input.description,
      budget: input.budget,
      status: input.status,
      projectId: input.projectId ?? null,
      assignedUserId: input.assignedUserId ?? null,
      priority: input.priority ?? null,
      effort: input.effort ?? null
    }).returning();
    if (!item) throw new ApiError(500, "CREATE_FAILED", "Action item creation returned no row.");

    const [event] = await tx.insert(itemEvents).values(eventValues({
      itemId: item.id,
      requestId,
      eventType: "created",
      fieldName: null,
      oldValue: null,
      newValue: itemSnapshot(item, assignee, project),
      actor
    })).returning();

    if (normalizedKey) {
      await tx.insert(idempotencyKeys).values({
        principalId: actor.id,
        key: normalizedKey,
        requestHash,
        itemId: item.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    }
    return { itemId: item.id, requestId, replayed: false, events: event ? [event] : [] };
  });

  return { item: await getActionItem(result.itemId), events: result.events.map(eventDto), requestId: result.requestId, replayed: result.replayed };
}

export async function updateActionItem(itemId: string, input: UpdateItemInput, actor: Actor) {
  const db = getDb();
  const requestId = randomUUID();
  const result = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(items).where(eq(items.id, itemId)).for("update").limit(1);
    if (!current) throw new ApiError(404, "ITEM_NOT_FOUND", "Action item not found.");
    if (current.version !== input.version) {
      throw new ApiError(409, "VERSION_CONFLICT", "The item changed after it was loaded.", { currentItem: await itemDtoInTx(tx, current) });
    }

    const currentAssignee = current.assignedUserId ? await requireUser(tx, current.assignedUserId) : null;
    const nextAssignee = input.assignedUserId !== undefined
      ? input.assignedUserId ? await requireUser(tx, input.assignedUserId) : null
      : currentAssignee;
    const currentProject = current.projectId ? await requireProject(tx, current.projectId) : null;
    const nextProject = input.projectId !== undefined
      ? input.projectId ? await requireProject(tx, input.projectId) : null
      : currentProject;
    const changes = changedFields(current, input, currentAssignee, nextAssignee, currentProject, nextProject);
    if (!changes.length) return { events: [] as ItemEventRow[] };

    const set: Partial<typeof items.$inferInsert> = { updatedAt: new Date(), version: current.version + 1 };
    if (input.title !== undefined) set.title = input.title;
    if (input.description !== undefined) set.description = input.description;
    if (input.budget !== undefined) set.budget = input.budget;
    if (input.status !== undefined) set.status = input.status;
    if (input.projectId !== undefined) set.projectId = input.projectId;
    if (input.assignedUserId !== undefined) set.assignedUserId = input.assignedUserId;
    if (input.priority !== undefined) set.priority = input.priority;
    if (input.effort !== undefined) set.effort = input.effort;
    await tx.update(items).set(set).where(eq(items.id, itemId));

    const events = await tx.insert(itemEvents).values(changes.map((change) => eventValues({
      itemId,
      requestId,
      eventType: "field_changed",
      fieldName: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      actor
    }))).returning();
    return { events };
  });

  return { item: await getActionItem(itemId), events: result.events.map(eventDto), requestId };
}

export async function listActionItemHistory(itemId: string, input: { limit: number; cursor?: string; eventType?: string; fieldName?: string }) {
  await getActionItem(itemId);
  const db = getDb();
  const conditions: SQL[] = [eq(itemEvents.itemId, itemId)];
  if (input.eventType) conditions.push(eq(itemEvents.eventType, input.eventType));
  if (input.fieldName) conditions.push(eq(itemEvents.fieldName, input.fieldName));
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor, historyCursorSchema);
    const time = new Date(cursor.createdAt);
    conditions.push(or(lt(itemEvents.createdAt, time), and(eq(itemEvents.createdAt, time), lt(itemEvents.id, cursor.id)))!);
  }
  const rows = await db.select().from(itemEvents).where(and(...conditions))
    .orderBy(desc(itemEvents.createdAt), desc(itemEvents.id)).limit(input.limit + 1);
  const hasMore = rows.length > input.limit;
  const pageRows = rows.slice(0, input.limit);
  const last = pageRows.at(-1);
  return {
    events: pageRows.map(eventDto),
    page: { hasMore, nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null }
  };
}

export async function listAssignableUsers(input: { q?: string; active: string; limit: number; cursor?: string }) {
  const db = getDb();
  const label = sql<string>`lower(coalesce(${users.handle}, ${users.name}, ''))`;
  const conditions: SQL[] = [];
  conditions.push(eq(users.isActive, input.active !== "false"));
  if (input.q) {
    const query = `%${escapeLike(input.q)}%`;
    conditions.push(or(ilike(users.handle, query), ilike(users.name, query))!);
  }
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor, userCursorSchema);
    conditions.push(or(gt(label, cursor.label), and(eq(label, cursor.label), gt(users.id, cursor.id)))!);
  }
  const rows = await db.select().from(users).where(and(...conditions)).orderBy(asc(label), asc(users.id)).limit(input.limit + 1);
  const hasMore = rows.length > input.limit;
  const pageRows = rows.slice(0, input.limit);
  const last = pageRows.at(-1);
  return {
    users: pageRows.map(userSummary),
    page: {
      hasMore,
      nextCursor: hasMore && last ? encodeCursor({ label: (last.handle ?? last.name ?? "").toLowerCase(), id: last.id }) : null
    }
  };
}

export async function listProjects(input: { status?: "open" | "closed"; limit: number }) {
  const db = getDb();
  const rows = await db.select().from(projects)
    .where(input.status ? eq(projects.status, input.status) : undefined)
    .orderBy(asc(projects.title), asc(projects.id))
    .limit(input.limit);
  return { projects: rows.map(projectSummary) };
}

export async function createProject(input: CreateProjectInput) {
  const db = getDb();
  const [project] = await db.insert(projects).values({
    title: input.title,
    description: input.description,
    portalLinkUrl: input.portalLinkUrl ?? null,
    status: input.status
  }).returning();
  if (!project) throw new ApiError(500, "CREATE_FAILED", "Project creation returned no row.");
  return { project: projectSummary(project) };
}

export async function listActionItemNotes(itemId: string, input: { limit: number; cursor?: string }) {
  await getActionItem(itemId);
  const db = getDb();
  const conditions: SQL[] = [eq(itemNotes.itemId, itemId)];
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor, noteCursorSchema);
    const time = new Date(cursor.createdAt);
    conditions.push(or(lt(itemNotes.createdAt, time), and(eq(itemNotes.createdAt, time), lt(itemNotes.id, cursor.id)))!);
  }
  const rows = await db.select({ note: itemNotes, user: users }).from(itemNotes)
    .innerJoin(users, eq(itemNotes.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(itemNotes.createdAt), desc(itemNotes.id))
    .limit(input.limit + 1);
  const hasMore = rows.length > input.limit;
  const pageRows = rows.slice(0, input.limit);
  const last = pageRows.at(-1)?.note;
  return {
    notes: pageRows.map((row) => noteDto(row.note, row.user)),
    page: { hasMore, nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null }
  };
}

export async function createActionItemNote(itemId: string, text: string, actor: Actor) {
  if (!actor.localUserId) throw new ApiError(422, "NOTE_USER_REQUIRED", "Notes require a Portal user session.");
  const db = getDb();
  await getActionItem(itemId);
  const user = await requireUser(db, actor.localUserId);
  const [note] = await db.insert(itemNotes).values({ itemId, userId: user.id, text }).returning();
  if (!note) throw new ApiError(500, "CREATE_FAILED", "Note creation returned no row.");
  return { note: noteDto(note, user) };
}

function itemDto(item: ItemRow, assignee: UserRow | null, project: ProjectRow | null): ActionItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    budget: item.budget,
    status: itemStatusSchema.parse(item.status),
    project: project ? projectSummary(project) : null,
    assignee: assignee ? userSummary(assignee) : null,
    priority: item.priority,
    effort: item.effort,
    version: item.version,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function eventDto(event: ItemEventRow): ActionItemEvent {
  return {
    id: event.id,
    requestId: event.requestId,
    eventType: event.eventType as "created" | "field_changed",
    fieldName: event.fieldName,
    oldValue: event.oldValue,
    newValue: event.newValue,
    actor: { type: event.actorType, id: event.actorId, label: event.actorLabel },
    createdAt: event.createdAt.toISOString()
  };
}

function userSummary(user: UserRow): UserSummary {
  return { id: user.id, portalProfileId: user.portalProfileId, name: user.name, handle: user.handle, avatarUrl: user.avatarUrl, isActive: user.isActive };
}

function projectSummary(project: ProjectRow): ProjectSummary {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    portalLinkUrl: project.portalLinkUrl,
    status: projectStatusSchema.parse(project.status)
  };
}

function noteDto(note: ItemNoteRow, user: UserRow): ActionItemNote {
  return { id: note.id, text: note.text, user: userSummary(user), createdAt: note.createdAt.toISOString() };
}

function itemSnapshot(item: ItemRow, assignee: UserRow | null, project: ProjectRow | null) {
  return {
    title: item.title,
    description: item.description,
    budget: item.budget,
    status: item.status,
    project: project ? projectSummary(project) : null,
    assignee: assignee ? userSummary(assignee) : null,
    priority: item.priority,
    effort: item.effort,
    version: item.version
  };
}

function eventValues(input: {
  itemId: string;
  requestId: string;
  eventType: "created" | "field_changed";
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  actor: Actor;
}) {
  return {
    itemId: input.itemId,
    requestId: input.requestId,
    eventType: input.eventType,
    fieldName: input.fieldName,
    oldValue: input.oldValue,
    newValue: input.newValue,
    actorType: input.actor.type,
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    metadataJson: {}
  };
}

function changedFields(
  current: ItemRow,
  input: UpdateItemInput,
  oldAssignee: UserRow | null,
  newAssignee: UserRow | null,
  oldProject: ProjectRow | null,
  newProject: ProjectRow | null
) {
  const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
  if (input.title !== undefined && input.title !== current.title) changes.push({ field: "title", oldValue: current.title, newValue: input.title });
  if (input.description !== undefined && input.description !== current.description) changes.push({ field: "description", oldValue: current.description, newValue: input.description });
  if (input.budget !== undefined && input.budget !== current.budget) changes.push({ field: "budget", oldValue: current.budget, newValue: input.budget });
  if (input.status !== undefined && input.status !== current.status) changes.push({ field: "status", oldValue: current.status, newValue: input.status });
  if (input.projectId !== undefined && input.projectId !== current.projectId) {
    changes.push({ field: "project", oldValue: oldProject ? projectSummary(oldProject) : null, newValue: newProject ? projectSummary(newProject) : null });
  }
  if (input.assignedUserId !== undefined && input.assignedUserId !== current.assignedUserId) {
    changes.push({ field: "assignee", oldValue: oldAssignee ? userSummary(oldAssignee) : null, newValue: newAssignee ? userSummary(newAssignee) : null });
  }
  if (input.priority !== undefined && input.priority !== current.priority) changes.push({ field: "priority", oldValue: current.priority, newValue: input.priority });
  if (input.effort !== undefined && input.effort !== current.effort) changes.push({ field: "effort", oldValue: current.effort, newValue: input.effort });
  return changes;
}

async function requireUser(tx: any, userId: string): Promise<UserRow> {
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.isActive) throw new ApiError(422, "INVALID_ASSIGNEE", "The selected assignee does not exist or is inactive.");
  return user;
}

async function requireProject(tx: any, projectId: string): Promise<ProjectRow> {
  const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) throw new ApiError(422, "INVALID_PROJECT", "The selected project does not exist.");
  return project;
}

async function itemDtoInTx(tx: any, item: ItemRow) {
  const assignee = item.assignedUserId ? await requireUser(tx, item.assignedUserId) : null;
  const project = item.projectId ? await requireProject(tx, item.projectId) : null;
  return itemDto(item, assignee, project);
}

function encodeCursor(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor<T>(value: string, schema: z.ZodType<T>): T {
  try {
    return schema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    throw new ApiError(422, "INVALID_CURSOR", "The pagination cursor is invalid.");
  }
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

const itemCursorSchema = z.object({ priority: z.number().int().positive().nullable(), updatedAt: z.string().datetime(), id: z.string().uuid() });
const historyCursorSchema = z.object({ createdAt: z.string().datetime(), id: z.string().uuid() });
const noteCursorSchema = z.object({ createdAt: z.string().datetime(), id: z.string().uuid() });
const userCursorSchema = z.object({ label: z.string(), id: z.string().uuid() });
