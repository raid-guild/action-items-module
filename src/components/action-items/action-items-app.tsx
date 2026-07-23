"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Bot,
  ChevronRight,
  CirclePlus,
  Loader2,
  LogOut,
  FolderKanban,
  ScrollText,
  Search,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ActionItemsFilterBar,
  defaultActionItemFilters,
} from "@/components/action-items/action-items-filter-bar";
import { StatusBadge } from "@/components/action-items/status-badge";
import { PriorityBadge } from "@/components/action-items/priority-badge";
import {
  apiFetch,
  type ActionItem,
  type ProjectSummary,
  userLabel,
} from "@/lib/client-api";

type SessionResponse = {
  authenticated: boolean;
  localLoginEnabled: boolean;
  user: {
    id: string;
    portalUserId: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
  } | null;
  portalUrl: string;
};
type ItemPage = {
  items: ActionItem[];
  page: { hasMore: boolean; nextCursor: string | null };
};
type ProjectList = { projects: ProjectSummary[] };
type FilterOptions = { priorities: number[] };

export function ActionItemsApp() {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<SessionResponse>("/api/session"),
    retry: false,
  });
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [filters, setFilters] = useState(defaultActionItemFilters);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [localPassword, setLocalPassword] = useState("");

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch<ProjectList>("/api/v1/projects?limit=100"),
    enabled: session.data?.authenticated === true,
  });

  const filterOptions = useQuery({
    queryKey: ["item-filter-options"],
    queryFn: () => apiFetch<FilterOptions>("/api/v1/items/filter-options"),
    enabled: session.data?.authenticated === true,
  });

  const itemsQuery = useInfiniteQuery({
    queryKey: ["items", deferredSearch, filters],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "50" });
      if (deferredSearch) params.set("q", deferredSearch);
      if (filters.myItems) params.set("assignedTo", "me");
      if (filters.statuses.length)
        params.set("status", filters.statuses.join(","));
      if (filters.priorities.length)
        params.set("priorities", filters.priorities.join(","));
      if (filters.projectIds.length)
        params.set("projectIds", filters.projectIds.join(","));
      if (filters.unassignedProject)
        params.set("projectAssignment", "unassigned");
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch<ItemPage>(`/api/v1/items?${params}`);
    },
    initialPageParam: "",
    getNextPageParam: (page) => page.page.nextCursor ?? undefined,
    enabled: session.data?.authenticated === true,
  });

  const items = useMemo(
    () => itemsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [itemsQuery.data],
  );
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 76,
    overscan: 12,
  });

  const assistant = useMutation({
    mutationFn: () =>
      apiFetch<{ guidance: string; selection: string }>(
        "/api/assistant/what-do-i-do",
        { method: "POST" },
      ),
    onSuccess: () => setAssistantOpen(true),
  });
  const localLogin = useMutation({
    mutationFn: () =>
      apiFetch<{ authenticated: boolean }>("/api/session", {
        method: "POST",
        body: JSON.stringify({ password: localPassword }),
      }),
    onSuccess: () => window.location.reload(),
  });

  if (session.isLoading)
    return (
      <Centered>
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </Centered>
    );
  if (!session.data?.authenticated) {
    return (
      <Centered>
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
            <Image
              src="/monk.png"
              alt="Action Items monk mascot"
              width={54}
              height={68}
              className="h-12 w-auto"
            />
          </div>
          <h1 className="font-heading text-2xl font-semibold">Action Items</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Launch this module from RaidGuild Portal to establish your member
            session.
          </p>
          {session.data?.localLoginEnabled && (
            <form
              className="mt-6 space-y-3 border-t pt-6 text-left"
              onSubmit={(event) => {
                event.preventDefault();
                localLogin.mutate();
              }}
            >
              <label
                className="block text-xs font-medium"
                htmlFor="local-admin-password"
              >
                Local admin password
              </label>
              <Input
                id="local-admin-password"
                type="password"
                autoComplete="current-password"
                value={localPassword}
                onChange={(event) => setLocalPassword(event.target.value)}
              />
              {localLogin.error && (
                <p className="text-xs text-destructive">
                  {localLogin.error.message}
                </p>
              )}
              <Button
                className="w-full"
                type="submit"
                disabled={!localPassword || localLogin.isPending}
              >
                {localLogin.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Sign in locally
              </Button>
            </form>
          )}
          <Button
            className={session.data?.localLoginEnabled ? "mt-3 w-full" : "mt-6"}
            variant={session.data?.localLoginEnabled ? "ghost" : "default"}
            onClick={() => {
              window.location.href =
                session.data?.portalUrl ||
                "https://portal.raidguild.org/modules";
            }}
          >
            Return to Portal
          </Button>
        </div>
      </Centered>
    );
  }

  const member = session.data.user!;
  return (
    <main className="flex h-dvh min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur md:gap-3 md:px-6">
        <div className="mr-auto flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center">
            <Image
              src="/monk.png"
              alt="Action Items monk mascot"
              width={54}
              height={68}
              className="h-9 w-auto"
            />
          </div>
          <div>
            <h1 className="font-heading text-lg font-semibold leading-tight">
              Action Items
            </h1>
          </div>
        </div>

        <div className="relative order-last mt-1 w-full lg:order-none lg:mt-0 lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Search items…"
            aria-label="Search action items"
          />
        </div>
        <Link
          href="/items/new"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Create a new item"
          title="Create a new item"
        >
          <CirclePlus className="h-5 w-5" />
        </Link>
        <div className="ml-1 flex items-center gap-1 border-l pl-2 md:gap-2 md:pl-3">
          <button
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={
              filters.myItems ? "Show all assignments" : "Show only my items"
            }
            aria-pressed={filters.myItems}
            title={
              filters.myItems ? "Remove My items filter" : "Show only my items"
            }
            onClick={() =>
              setFilters({ ...filters, myItems: !filters.myItems })
            }
          >
            <Avatar
              className={
                filters.myItems
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "transition-opacity hover:opacity-80"
              }
            >
              <AvatarImage src={member.avatarUrl ?? undefined} alt="" />
              <AvatarFallback>
                <UserRound className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </button>
          <button
            className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Log out"
            onClick={async () => {
              await apiFetch("/api/session", { method: "DELETE" });
              window.location.reload();
            }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <section className="shrink-0 border-b bg-card/45 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary sm:flex">
            <ScrollText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              You can just do things,{" "}
              {member.name || member.handle || "guild member"}.
            </p>
          </div>
          <Link
            href="/projects"
            className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border bg-transparent px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FolderKanban className="h-4 w-4" />
            Projects
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => assistant.mutate()}
            disabled={assistant.isPending}
          >
            {assistant.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
            What do I do?
          </Button>
        </div>
        {assistant.error && (
          <p className="mt-2 text-right text-xs text-destructive">
            {assistant.error.message}
          </p>
        )}
      </section>

      <ActionItemsFilterBar
        filters={filters}
        onChange={setFilters}
        priorities={filterOptions.data?.priorities ?? []}
        projects={projects.data?.projects ?? []}
      />

      <div className="hidden shrink-0 grid-cols-[minmax(0,1fr)_minmax(120px,240px)_100px_110px] border-b bg-muted/30 px-6 py-2 text-[.5rem] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
        <span>Item</span>
        <span>Assignee</span>
        <span>Priority</span>
        <span>Status</span>
      </div>

      <div
        ref={parentRef}
        className="min-h-0 flex-1 overflow-auto"
        onScroll={(event) => {
          const node = event.currentTarget;
          if (
            node.scrollHeight - node.scrollTop - node.clientHeight < 500 &&
            itemsQuery.hasNextPage &&
            !itemsQuery.isFetchingNextPage
          )
            itemsQuery.fetchNextPage();
        }}
      >
        {itemsQuery.isLoading ? (
          <Centered>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </Centered>
        ) : itemsQuery.error ? (
          <Centered>
            <p className="text-sm text-destructive">
              {itemsQuery.error.message}
            </p>
          </Centered>
        ) : !items.length ? (
          <Centered>
            <div className="text-center">
              <p className="font-medium">No action items found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another filter or create the first one.
              </p>
            </div>
          </Centered>
        ) : (
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index];
              return (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className="absolute left-0 grid w-full grid-cols-1 items-center border-b px-4 text-left text-sm transition-colors hover:bg-muted/60 focus:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring md:grid-cols-[minmax(0,1fr)_minmax(120px,240px)_100px_110px] md:px-6"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2 pr-3">
                    <span className="truncate font-medium">{item.title}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </span>
                  <span className="hidden truncate pr-3 text-muted-foreground md:block">
                    {userLabel(item.assignee)}
                  </span>
                  <span className="hidden md:block">
                    {item.priority === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <PriorityBadge priority={item.priority} />
                    )}
                  </span>
                  <span className="hidden md:block">
                    <StatusBadge status={item.status} />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
        {itemsQuery.isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>

      <Dialog open={assistantOpen} onOpenChange={setAssistantOpen}>
        <DialogContent className="max-w-xl p-0">
          <DialogHeader className="border-b px-6 py-5 pr-14">
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" />
              Prism suggests
            </DialogTitle>
            <DialogDescription>
              Contextual guidance based on a small selection of actionable
              items.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto whitespace-pre-wrap px-6 py-5 text-sm leading-7">
            {assistant.data?.guidance}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-56 flex-1 items-center justify-center p-8">
      {children}
    </div>
  );
}
