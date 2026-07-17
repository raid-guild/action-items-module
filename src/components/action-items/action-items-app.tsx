"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Bot,
  ChevronRight,
  ListFilter,
  Loader2,
  LogOut,
  Plus,
  ScrollText,
  Search,
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
import { Badge } from "@/components/ui/badge";
import { ActionItemDialog } from "@/components/action-items/action-item-dialog";
import { StatusBadge } from "@/components/action-items/status-badge";
import {
  apiFetch,
  type ActionItem,
  type UserSummary,
  userLabel,
} from "@/lib/client-api";

type SessionResponse = {
  authenticated: boolean;
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
type UserPage = {
  users: UserSummary[];
  page: { hasMore: boolean; nextCursor: string | null };
};

export function ActionItemsApp() {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<SessionResponse>("/api/session"),
    retry: false,
  });
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [assignedTo, setAssignedTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserPage>("/api/v1/users?limit=100"),
    enabled: session.data?.authenticated === true,
  });

  const itemsQuery = useInfiniteQuery({
    queryKey: ["items", deferredSearch, assignedTo],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: "50",
        status: "open,active",
      });
      if (deferredSearch) params.set("q", deferredSearch);
      if (assignedTo) params.set("assignedTo", assignedTo);
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
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ListFilter />
          </div>
          <h1 className="font-heading text-2xl font-semibold">Action Items</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Launch this module from RaidGuild Portal to establish your member
            session.
          </p>
          <Button
            className="mt-6"
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
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur md:px-6">
        <div className="mr-auto flex min-w-48 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ListFilter className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-semibold leading-tight">
              Action Items
            </h1>
            <p className="text-xs text-muted-foreground">
              P1 first · shared work queue
            </p>
          </div>
        </div>

        <div className="relative order-last w-full md:order-none md:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Search items…"
            aria-label="Search action items"
          />
        </div>
        <Button
          variant={assignedTo === "me" ? "default" : "outline"}
          onClick={() => setAssignedTo(assignedTo === "me" ? "" : "me")}
        >
          My items
        </Button>
        <Button
          onClick={() => {
            setSelectedItemId(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          New item
        </Button>
        <div className="ml-1 flex items-center gap-2 border-l pl-3">
          <Avatar>
            <AvatarImage src={member.avatarUrl ?? undefined} alt="" />
            <AvatarFallback>
              {initials(member.name || member.handle || "RG")}
            </AvatarFallback>
          </Avatar>
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
              Welcome back, {member.name || member.handle || "guild member"}.
            </p>
          </div>
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

      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(120px,240px)_100px_110px] border-b bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:px-6">
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
                <button
                  key={item.id}
                  className="absolute left-0 grid w-full grid-cols-[minmax(0,1fr)_minmax(120px,240px)_100px_110px] items-center border-b px-4 text-left text-sm transition-colors hover:bg-muted/60 focus:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring md:px-6"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => {
                    setSelectedItemId(item.id);
                    setDialogOpen(true);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2 pr-3">
                    <span className="truncate font-medium">{item.title}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </span>
                  <span className="truncate pr-3 text-muted-foreground">
                    {userLabel(item.assignee)}
                  </span>
                  <span>
                    {item.priority === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge className="border-primary/30 bg-primary/10 text-primary">
                        P{item.priority}
                      </Badge>
                    )}
                  </span>
                  <span>
                    <StatusBadge status={item.status} />
                  </span>
                </button>
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

      <ActionItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        itemId={selectedItemId}
        users={users.data?.users ?? []}
      />

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
function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
