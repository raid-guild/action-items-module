"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  apiFetch,
  ClientApiError,
  type ActionItem,
  type ActionItemEvent,
  type ActionItemNote,
  type ProjectSummary,
  type UserSummary,
  userLabel,
} from "@/lib/client-api";

type ItemDetail = {
  item: ActionItem;
  notes: {
    notes: ActionItemNote[];
    page: { hasMore: boolean; nextCursor: string | null };
  };
  history: {
    events: ActionItemEvent[];
    page: { hasMore: boolean; nextCursor: string | null };
  };
};
type MutationResult = {
  item: ActionItem;
  events: ActionItemEvent[];
  requestId: string;
};

export function ActionItemDialog({
  open,
  onOpenChange,
  itemId,
  users,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  users: UserSummary[];
  projects: ProjectSummary[];
}) {
  const queryClient = useQueryClient();
  const isCreate = !itemId;
  const detail = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => apiFetch<ItemDetail>(`/api/v1/items/${itemId}`),
    enabled: open && Boolean(itemId),
  });
  const item = detail.data?.item ?? null;
  const history = useInfiniteQuery({
    queryKey: ["item-history", itemId],
    queryFn: ({ pageParam }) =>
      apiFetch<{
        events: ActionItemEvent[];
        page: { hasMore: boolean; nextCursor: string | null };
      }>(
        `/api/v1/items/${itemId}/history?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    initialPageParam: "",
    getNextPageParam: (page) => page.page.nextCursor ?? undefined,
    enabled: open && Boolean(itemId),
  });
  const [form, setForm] = useState(() => initialForm(null));
  const [formError, setFormError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    if (open) {
      setForm(initialForm(item));
      setFormError(null);
      setNoteText("");
    }
  }, [open, item]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        ...(item ? { version: item.version } : {}),
        title: form.title.trim(),
        description: form.description,
        budget: form.budget,
        status: form.status,
        projectId: form.projectId || null,
        assignedUserId: form.assignedUserId || null,
        priority: nullableInteger(form.priority),
        effort: nullableInteger(form.effort),
      };
      if (!body.title)
        throw new ClientApiError(422, "VALIDATION_ERROR", "Title is required.");
      return item
        ? apiFetch<MutationResult>(`/api/v1/items/${item.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : apiFetch<MutationResult>("/api/v1/items", {
            method: "POST",
            headers: { "idempotency-key": crypto.randomUUID() },
            body: JSON.stringify(body),
          });
    },
    onSuccess: async (result) => {
      toast.success(item ? "Action item updated" : "Action item created");
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({
        queryKey: ["item-history", result.item.id],
      });
      queryClient.setQueryData(
        ["item", result.item.id],
        (previous: ItemDetail | undefined) =>
          previous
            ? {
                item: result.item,
                history: {
                  ...previous.history,
                  events: [...result.events, ...previous.history.events],
                },
              }
            : previous,
      );
      onOpenChange(false);
    },
    onError: (error) => {
      const message =
        error instanceof ClientApiError && error.code === "VERSION_CONFLICT"
          ? "Someone changed this item while you were editing. Your draft is preserved; close and reopen to review the latest version."
          : error instanceof Error
            ? error.message
            : "Could not save the item.";
      setFormError(message);
      if (
        item &&
        error instanceof ClientApiError &&
        error.code === "VERSION_CONFLICT"
      ) {
        queryClient.invalidateQueries({
          queryKey: ["item", item.id],
          refetchType: "none",
        });
      }
    },
  });

  const addNote = useMutation({
    mutationFn: () =>
      apiFetch<{ note: ActionItemNote }>(`/api/v1/items/${itemId}/notes`, {
        method: "POST",
        body: JSON.stringify({ text: noteText }),
      }),
    onSuccess: ({ note }) => {
      queryClient.setQueryData(
        ["item", itemId],
        (previous: ItemDetail | undefined) =>
          previous
            ? {
                ...previous,
                notes: {
                  ...previous.notes,
                  notes: [note, ...previous.notes.notes],
                },
              }
            : previous,
      );
      setNoteText("");
      toast.success("Note added");
    },
  });

  const historyEvents = useMemo(
    () => history.data?.pages.flatMap((page) => page.events) ?? [],
    [history.data],
  );
  const historyGroups = useMemo(
    () => groupEvents(historyEvents),
    [historyEvents],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] flex-col">
        <DialogHeader className="border-b px-6 py-5 pr-14">
          <DialogTitle>
            {isCreate ? "New action item" : "Action item"}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Will anyone pick it up?"
              : `Version ${item?.version ?? "…"}`}
          </DialogDescription>
        </DialogHeader>

        {!isCreate && detail.isLoading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !isCreate && detail.error ? (
          <div className="p-6 text-sm text-destructive">
            {detail.error.message}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[1.25fr_.75fr]">
            <form
              className="space-y-5 border-b p-6 md:border-b-0 md:border-r"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <Field label="Title">
                <Input
                  value={form.title}
                  maxLength={300}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  autoFocus
                />
              </Field>
              <Field label="Description">
                <Textarea
                  value={form.description}
                  maxLength={100_000}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </Field>
              <Field label="Budget" hint="Free-form amount or budget context.">
                <Input
                  value={form.budget}
                  maxLength={10_000}
                  onChange={(event) =>
                    setForm({ ...form, budget: event.target.value })
                  }
                  placeholder="e.g. 5,000 USDC"
                />
              </Field>
              <Field label="Project">
                <select
                  className={selectClass}
                  value={form.projectId}
                  onChange={(event) =>
                    setForm({ ...form, projectId: event.target.value })
                  }
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}{project.status === "closed" ? " (closed)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Status">
                  <select
                    className={selectClass}
                    value={form.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status: event.target.value as ActionItem["status"],
                      })
                    }
                  >
                    <option value="open">Open</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>
                <Field label="Assignee">
                  <select
                    className={selectClass}
                    value={form.assignedUserId}
                    onChange={(event) =>
                      setForm({ ...form, assignedUserId: event.target.value })
                    }
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {userLabel(user)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Priority" hint="P1 is highest; no maximum.">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="—"
                    value={form.priority}
                    onChange={(event) =>
                      setForm({ ...form, priority: event.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Effort"
                  hint="Integer; the team defines the unit."
                >
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="—"
                    value={form.effort}
                    onChange={(event) =>
                      setForm({ ...form, effort: event.target.value })
                    }
                  />
                </Field>
              </div>
              {item && (
                <p className="text-xs text-muted-foreground">
                  Created {formatDate(item.createdAt)} · Updated{" "}
                  {formatDate(item.updatedAt)}
                </p>
              )}
              {formError && (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {formError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {isCreate ? "Create item" : "Save changes"}
                </Button>
              </div>
            </form>

            <aside className="min-h-64 bg-background/40 p-6">
              <h3 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Notes
              </h3>
              {isCreate ? (
                <p className="mb-8 text-sm text-muted-foreground">
                  Notes can be added after the item is created.
                </p>
              ) : (
                <div className="mb-8 space-y-4">
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (noteText.trim()) addNote.mutate();
                    }}
                  >
                    <Textarea
                      value={noteText}
                      maxLength={100_000}
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder="Add a note…"
                      aria-label="Note text"
                    />
                    <div className="flex justify-end">
                      <Button type="submit" size="sm" disabled={!noteText.trim() || addNote.isPending}>
                        {addNote.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Add note
                      </Button>
                    </div>
                    {addNote.error && (
                      <p className="text-xs text-destructive">{addNote.error.message}</p>
                    )}
                  </form>
                  {detail.data?.notes.notes.length ? (
                    <ol className="space-y-4">
                      {detail.data.notes.notes.map((note) => (
                        <li key={note.id} className="rounded-md border bg-card/60 p-3">
                          <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{userLabel(note.user)}</span>
                            <time dateTime={note.createdAt}>{formatDate(note.createdAt)}</time>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm">{note.text}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">No notes yet.</p>
                  )}
                </div>
              )}
              <h3 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                History
              </h3>
              {isCreate ? (
                <p className="text-sm text-muted-foreground">
                  History begins when the item is created.
                </p>
              ) : historyGroups.length ? (
                <ol className="space-y-5">
                  {historyGroups.map((group) => (
                    <li
                      key={group.requestId}
                      className="relative border-l border-border pl-4"
                    >
                      <span className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-primary" />
                      <p className="text-xs text-muted-foreground">
                        {formatDate(group.createdAt)}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {group.actorLabel}
                      </p>
                      <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                        {group.events.map((event) => (
                          <li key={event.id}>{eventText(event)}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                  {history.hasNextPage && (
                    <li>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => history.fetchNextPage()}
                        disabled={history.isFetchingNextPage}
                      >
                        {history.isFetchingNextPage && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Load older history
                      </Button>
                    </li>
                  )}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No history found.
                </p>
              )}
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

function initialForm(item: ActionItem | null) {
  return {
    title: item?.title ?? "",
    description: item?.description ?? "",
    budget: item?.budget ?? "",
    status: item?.status ?? ("open" as ActionItem["status"]),
    projectId: item?.project?.id ?? "",
    assignedUserId: item?.assignee?.id ?? "",
    priority: item?.priority?.toString() ?? "",
    effort: item?.effort?.toString() ?? "",
  };
}

function nullableInteger(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new ClientApiError(
      422,
      "VALIDATION_ERROR",
      "Priority and effort must be positive integers.",
    );
  return parsed;
}

function groupEvents(events: ActionItemEvent[]) {
  const groups = new Map<
    string,
    {
      requestId: string;
      actorLabel: string;
      createdAt: string;
      events: ActionItemEvent[];
    }
  >();
  for (const event of events) {
    const current = groups.get(event.requestId);
    if (current) current.events.push(event);
    else
      groups.set(event.requestId, {
        requestId: event.requestId,
        actorLabel: event.actor.label,
        createdAt: event.createdAt,
        events: [event],
      });
  }
  return [...groups.values()];
}

function eventText(event: ActionItemEvent) {
  if (event.eventType === "created") return "Created the item";
  const oldValue = displayValue(event.oldValue);
  const newValue = displayValue(event.newValue);
  return `${capitalize(event.fieldName || "field")}: ${oldValue} → ${newValue}`;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "None";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.handle === "string" && record.handle)
      return `@${record.handle}`;
    if (typeof record.name === "string" && record.name) return record.name;
    return "item details";
  }
  const text = String(value);
  return text.length > 50 ? `${text.slice(0, 47)}…` : text;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
