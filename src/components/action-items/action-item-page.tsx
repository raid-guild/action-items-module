"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Check,
  Clipboard,
  FolderCog,
  ListFilter,
  Loader2,
  MessageSquareText,
  Save,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PriorityBadge } from "@/components/action-items/priority-badge";
import { StatusBadge } from "@/components/action-items/status-badge";
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

type SessionResponse = {
  authenticated: boolean;
  portalUrl: string;
};
type ItemDetail = {
  item: ActionItem;
  notes: NotesPage;
  history: HistoryPage;
};
type NotesPage = {
  notes: ActionItemNote[];
  page: { hasMore: boolean; nextCursor: string | null };
};
type HistoryPage = {
  events: ActionItemEvent[];
  page: { hasMore: boolean; nextCursor: string | null };
};
type MutationResult = {
  item: ActionItem;
  events: ActionItemEvent[];
  requestId: string;
};
type UserPage = {
  users: UserSummary[];
  page: { hasMore: boolean; nextCursor: string | null };
};
type ProjectList = { projects: ProjectSummary[] };
type InfinitePages<T> = { pages: T[]; pageParams: unknown[] };

export function ActionItemPage({ itemId }: { itemId: string | null }) {
  const isCreate = itemId === null;
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<SessionResponse>("/api/session"),
    retry: false,
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserPage>("/api/v1/users?limit=100"),
    enabled: session.data?.authenticated === true,
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch<ProjectList>("/api/v1/projects?limit=100"),
    enabled: session.data?.authenticated === true,
  });
  const detail = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => apiFetch<ItemDetail>(`/api/v1/items/${itemId}`),
    enabled: session.data?.authenticated === true && !isCreate,
  });

  if (session.isLoading || (!isCreate && detail.isLoading)) {
    return <PageLoading />;
  }

  if (!session.data?.authenticated) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ListFilter />
          </div>
          <h1 className="font-heading text-xl font-semibold">Action Items</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Launch this module from RaidGuild Portal to view this action item.
          </p>
          <Button
            className="mt-6"
            onClick={() => {
              window.location.href = session.data?.portalUrl || "/";
            }}
          >
            Return to Portal
          </Button>
        </div>
      </main>
    );
  }

  if (!isCreate && detail.error) {
    return <PageError error={detail.error} />;
  }

  return (
    <ActionItemWorkspace
      key={itemId ?? "new"}
      itemId={itemId}
      initialDetail={detail.data ?? null}
      users={users.data?.users ?? []}
      projects={projects.data?.projects ?? []}
    />
  );
}

function ActionItemWorkspace({
  itemId,
  initialDetail,
  users,
  projects,
}: {
  itemId: string | null;
  initialDetail: ItemDetail | null;
  users: UserSummary[];
  projects: ProjectSummary[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isCreate = itemId === null;
  const item = initialDetail?.item ?? null;
  const [form, setForm] = useState(() => initialForm(item));
  const [formError, setFormError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setForm(initialForm(item));
  }, [item]);

  const notes = useInfiniteQuery({
    queryKey: ["item-notes", itemId],
    queryFn: ({ pageParam }) =>
      apiFetch<NotesPage>(
        `/api/v1/items/${itemId}/notes?limit=50${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    initialPageParam: "",
    getNextPageParam: (page) => page.page.nextCursor ?? undefined,
    initialData: initialDetail
      ? { pages: [initialDetail.notes], pageParams: [""] }
      : undefined,
    enabled: Boolean(itemId),
  });
  const history = useInfiniteQuery({
    queryKey: ["item-history", itemId],
    queryFn: ({ pageParam }) =>
      apiFetch<HistoryPage>(
        `/api/v1/items/${itemId}/history?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    initialPageParam: "",
    getNextPageParam: (page) => page.page.nextCursor ?? undefined,
    initialData: initialDetail
      ? { pages: [initialDetail.history], pageParams: [""] }
      : undefined,
    enabled: Boolean(itemId),
  });

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
      if (!body.title) {
        throw new ClientApiError(
          422,
          "VALIDATION_ERROR",
          "Give the action item a title before saving.",
        );
      }
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
    onSuccess: (result) => {
      const nextDetail: ItemDetail = {
        item: result.item,
        notes: initialDetail?.notes ?? emptyNotesPage(),
        history: initialDetail?.history ?? {
          events: result.events,
          page: { hasMore: false, nextCursor: null },
        },
      };
      queryClient.setQueryData(["item", result.item.id], nextDetail);
      if (item && result.events.length) {
        queryClient.setQueryData<InfinitePages<HistoryPage>>(
          ["item-history", item.id],
          (previous) =>
            previous
              ? {
                  ...previous,
                  pages: [
                    {
                      ...previous.pages[0],
                      events: [
                        ...result.events,
                        ...(previous.pages[0]?.events ?? []),
                      ],
                    },
                    ...previous.pages.slice(1),
                  ],
                }
              : previous,
        );
      }
      void queryClient.invalidateQueries({ queryKey: ["items"] });
      void queryClient.invalidateQueries({
        queryKey: ["item-filter-options"],
      });
      setFormError(null);
      toast.success(item ? "Changes saved" : "Action item created");
      if (isCreate) router.replace(`/items/${result.item.id}`);
    },
    onError: (error) => {
      const message =
        error instanceof ClientApiError && error.code === "VERSION_CONFLICT"
          ? "Someone changed this item while you were editing. Your draft is still here; reload the page to review their changes before saving again."
          : error instanceof Error
            ? error.message
            : "Could not save the action item.";
      setFormError(message);
      if (item && error instanceof ClientApiError && error.code === "VERSION_CONFLICT") {
        void queryClient.invalidateQueries({
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
      queryClient.setQueryData<InfinitePages<NotesPage>>(
        ["item-notes", itemId],
        (previous) => {
          const current = previous ?? {
            pages: [emptyNotesPage()],
            pageParams: [""],
          };
          return {
            ...current,
            pages: [
              {
                ...current.pages[0],
                notes: [note, ...(current.pages[0]?.notes ?? [])],
              },
              ...current.pages.slice(1),
            ],
          };
        },
      );
      setNoteText("");
      toast.success("Note added");
    },
  });

  const itemNotes = useMemo(
    () => notes.data?.pages.flatMap((page) => page.notes) ?? [],
    [notes.data],
  );
  const historyEvents = useMemo(
    () => history.data?.pages.flatMap((page) => page.events) ?? [],
    [history.data],
  );
  const historyGroups = useMemo(
    () => groupEvents(historyEvents),
    [historyEvents],
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <main className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[90rem] items-center gap-3 px-4 py-3 md:px-8">
          <Link
            href="/"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to action items"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <nav
            aria-label="Breadcrumb"
            className="min-w-0 flex-1 text-xs text-muted-foreground"
          >
            <Link href="/" className="transition-colors hover:text-foreground">
              Action Items
            </Link>
            <span aria-hidden="true" className="mx-2 text-border">
              /
            </span>
            <span className="text-foreground">
              {isCreate ? "New item" : "Item details"}
            </span>
          </nav>
          {item && (
            <div className="hidden items-center gap-2 sm:flex">
              {item.priority !== null && (
                <PriorityBadge priority={item.priority} />
              )}
              <StatusBadge status={item.status} />
            </div>
          )}
          {item && (
            <Button type="button" variant="outline" size="sm" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
            </Button>
          )}
          <Button type="submit" form="action-item-form" size="sm" disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {isCreate ? "Create item" : "Save changes"}
            </span>
          </Button>
        </div>
      </header>

      <form
        id="action-item-form"
        className="mx-auto max-w-[90rem] px-4 py-8 md:px-8 md:py-12"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="mb-8 max-w-4xl">
          <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-primary">
            {isCreate ? "Create action item" : `Action item · v${item?.version ?? "—"}`}
          </p>
          <label htmlFor="item-title" className="sr-only">
            Title
          </label>
          <Input
            id="item-title"
            value={form.title}
            maxLength={300}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            className="h-auto border-0 bg-transparent px-0 py-1 font-heading text-2xl font-semibold leading-tight shadow-none placeholder:text-muted-foreground/45 focus:ring-0 md:text-4xl"
            placeholder="What needs to get done?"
            autoFocus={isCreate}
          />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {isCreate
              ? "Capture the outcome, choose an owner, and add enough context for someone to pick it up."
              : "Keep the brief current so this page remains the source of truth."}
          </p>
        </div>

        {formError && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            {formError}
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
          <div className="space-y-6">
            <SectionCard
              eyebrow="Brief"
              title="Scope and context"
              description="Describe the outcome, useful links, constraints, and acceptance criteria."
            >
              <Field label="Description" htmlFor="item-description">
                <Textarea
                  id="item-description"
                  value={form.description}
                  maxLength={100_000}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  className="min-h-64 resize-y bg-background/60 leading-7"
                  placeholder="Add the context someone needs to complete this item…"
                />
              </Field>
            </SectionCard>

            {!isCreate && (
              <SectionCard
                eyebrow="Conversation"
                title="Notes"
                description="Decisions, updates, handoffs, and anything that should stay with the work."
                icon={<MessageSquareText className="h-5 w-5" />}
                meta={`${itemNotes.length} loaded`}
              >
                <div className="rounded-lg border bg-background/55 p-4">
                  <Textarea
                    value={noteText}
                    maxLength={100_000}
                    onChange={(event) => setNoteText(event.target.value)}
                    className="min-h-28 resize-y border-0 bg-transparent p-0 leading-6 focus:ring-0"
                    placeholder="Add an update or leave context for the next person…"
                    aria-label="Note text"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
                    <p className="text-xs text-muted-foreground">Notes are visible to everyone with access.</p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (noteText.trim()) addNote.mutate();
                      }}
                      disabled={!noteText.trim() || addNote.isPending}
                    >
                      {addNote.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Add note
                    </Button>
                  </div>
                  {addNote.error && (
                    <p className="mt-3 text-xs text-destructive">{addNote.error.message}</p>
                  )}
                </div>

                {itemNotes.length ? (
                  <ol className="mt-6 divide-y divide-border">
                    {itemNotes.map((note) => (
                      <li key={note.id} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                        <Avatar className="mt-0.5 h-9 w-9">
                          <AvatarImage src={note.user.avatarUrl ?? undefined} alt="" />
                          <AvatarFallback>
                            <UserRound className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <p className="text-sm font-medium">{userLabel(note.user)}</p>
                            <time className="text-[0.65rem] text-muted-foreground" dateTime={note.createdAt}>
                              {formatDate(note.createdAt)}
                            </time>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90">
                            {note.text}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState text="No notes yet. Add the first update above." />
                )}
                {notes.hasNextPage && (
                  <Button
                    className="mt-6 w-full"
                    type="button"
                    variant="outline"
                    onClick={() => notes.fetchNextPage()}
                    disabled={notes.isFetchingNextPage}
                  >
                    {notes.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
                    Load older notes
                  </Button>
                )}
              </SectionCard>
            )}
          </div>

          <aside className="space-y-6">
            <SectionCard
              eyebrow="Properties"
              title="Ownership and planning"
              description="The fields used to sort, assign, and plan this work."
            >
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <Field label="Status" htmlFor="item-status">
                  <select
                    id="item-status"
                    className={selectClass}
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as ActionItem["status"] })
                    }
                  >
                    <option value="open">Open</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>
                <Field label="Assignee" htmlFor="item-assignee">
                  <select
                    id="item-assignee"
                    className={selectClass}
                    value={form.assignedUserId}
                    onChange={(event) =>
                      setForm({ ...form, assignedUserId: event.target.value })
                    }
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{userLabel(user)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Project" htmlFor="item-project">
                  <select
                    id="item-project"
                    className={selectClass}
                    value={form.projectId}
                    onChange={(event) => setForm({ ...form, projectId: event.target.value })}
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}{project.status === "closed" ? " (closed)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="-mt-2 flex justify-end sm:col-span-2 lg:col-span-1">
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                  >
                    <FolderCog className="h-3.5 w-3.5" />
                    Manage projects
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:col-span-2 lg:col-span-1">
                  <Field label="Priority" htmlFor="item-priority" hint="P1 is highest">
                    <Input
                      id="item-priority"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="—"
                      value={form.priority}
                      onChange={(event) => setForm({ ...form, priority: event.target.value })}
                    />
                  </Field>
                  <Field label="Effort" htmlFor="item-effort" hint="Positive integer">
                    <Input
                      id="item-effort"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="—"
                      value={form.effort}
                      onChange={(event) => setForm({ ...form, effort: event.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Budget" htmlFor="item-budget" hint="Amount or budget context">
                  <Textarea
                    id="item-budget"
                    value={form.budget}
                    maxLength={10_000}
                    onChange={(event) => setForm({ ...form, budget: event.target.value })}
                    className="min-h-24 resize-y"
                    placeholder="e.g. 5,000 RAID"
                  />
                </Field>
              </div>

              {item && (
                <dl className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 text-xs">
                  <Timestamp label="Created" value={item.createdAt} />
                  <Timestamp label="Last updated" value={item.updatedAt} />
                </dl>
              )}
            </SectionCard>

            {!isCreate && (
              <SectionCard
                eyebrow="Audit trail"
                title="History"
                description="A chronological log of changes to this item."
                icon={<Activity className="h-5 w-5" />}
              >
                {historyGroups.length ? (
                  <ol>
                    {historyGroups.map((group, index) => (
                      <li key={group.requestId} className="relative flex gap-4 pb-7 last:pb-0">
                        {index < historyGroups.length - 1 && (
                          <span className="absolute bottom-0 left-[0.3rem] top-3 w-px bg-border" />
                        )}
                        <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-primary bg-background" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                            <p className="text-xs font-medium">{group.actorLabel}</p>
                            <time className="text-[0.6rem] text-muted-foreground" dateTime={group.createdAt}>
                              {formatDate(group.createdAt)}
                            </time>
                          </div>
                          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                            {group.events.map((event) => (
                              <li key={event.id}>{eventText(event)}</li>
                            ))}
                          </ul>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState text="No history found." />
                )}
                {history.hasNextPage && (
                  <Button
                    className="mt-6 w-full"
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => history.fetchNextPage()}
                    disabled={history.isFetchingNextPage}
                  >
                    {history.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
                    Load older history
                  </Button>
                )}
              </SectionCard>
            )}
          </aside>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3 border-t pt-6">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isCreate ? "Cancel" : "Back to list"}
          </Link>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isCreate ? "Create action item" : "Save changes"}
          </Button>
        </div>
      </form>
    </main>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  icon,
  meta,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card/65 shadow-[0_18px_60px_-36px_hsl(var(--primary)/0.35)]">
      <div className="flex gap-4 border-b bg-muted/20 px-5 py-5 md:px-6">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <h2 className="font-heading text-base font-semibold">{title}</h2>
            {meta && <span className="text-[0.6rem] text-muted-foreground">{meta}</span>}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-xs font-medium">{label}</label>
        {hint && <span className="text-[0.6rem] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Timestamp({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-wider text-muted-foreground">
        <CalendarDays className="h-3 w-3" />
        {label}
      </dt>
      <dd className="mt-1.5 text-[0.65rem] leading-5 text-foreground/80">{formatDate(value)}</dd>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-md border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function PageLoading() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </main>
  );
}

function PageError({ error }: { error: Error }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md rounded-lg border bg-card p-8 text-center">
        <h1 className="font-heading text-xl font-semibold">Action item unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{error.message}</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to action items
        </Link>
      </div>
    </main>
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
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ClientApiError(
      422,
      "VALIDATION_ERROR",
      "Priority and effort must be positive integers.",
    );
  }
  return parsed;
}

function emptyNotesPage(): NotesPage {
  return { notes: [], page: { hasMore: false, nextCursor: null } };
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
    else {
      groups.set(event.requestId, {
        requestId: event.requestId,
        actorLabel: event.actor.label,
        createdAt: event.createdAt,
        events: [event],
      });
    }
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
    if (typeof record.handle === "string" && record.handle) return `@${record.handle}`;
    if (typeof record.name === "string" && record.name) return record.name;
    if (typeof record.title === "string" && record.title) return record.title;
    return "item details";
  }
  const valueText = String(value);
  return valueText.length > 80 ? `${valueText.slice(0, 77)}…` : valueText;
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
