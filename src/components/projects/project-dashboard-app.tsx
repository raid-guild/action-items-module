"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bot, Check, ChevronRight, CirclePlus,
  ExternalLink, FolderKanban, Gauge, ListTodo, Loader2, Pencil, Plus, Target
} from "lucide-react";
import { toast } from "sonner";
import { PriorityBadge } from "@/components/action-items/priority-badge";
import { StatusBadge } from "@/components/action-items/status-badge";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, type ActionItem, type ProjectDashboard, type ProjectKpi, userLabel } from "@/lib/client-api";
import type { PrismSnapshotProposal } from "@/lib/prism/snapshot";
import { pollSnapshotJob, type PrismSnapshotResponse, type SnapshotPollResponse } from "@/lib/prism/snapshot-poll";
import { clearPersistedSnapshot, persistSnapshot, readPersistedSnapshot } from "@/lib/prism/snapshot-persistence";
import type { PlausibleMeasurementConfig } from "@/lib/action-items/schemas";

type SnapshotStartResponse = { status: "queued"; jobId: string };
type ItemPage = {
  items: ActionItem[];
  page: { hasMore: boolean; nextCursor: string | null };
};

export function ProjectDashboardApp({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [loggingKpi, setLoggingKpi] = useState<ProjectKpi | null>(null);
  const [configuringKpi, setConfiguringKpi] = useState<ProjectKpi | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<PrismSnapshotResponse | null>(null);
  const dashboard = useQuery({
    queryKey: ["project-dashboard", projectId],
    queryFn: () => apiFetch<{ dashboard: ProjectDashboard }>(`/api/v1/projects/${projectId}/dashboard`),
  });
  const projectItems = useInfiniteQuery({
    queryKey: ["items", "project", projectId],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        projectId,
        status: "open,active,completed",
        limit: "50",
      });
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch<ItemPage>(`/api/v1/items?${params}`);
    },
    initialPageParam: "",
    getNextPageParam: (page) => page.page.nextCursor ?? undefined,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project-dashboard", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]);
  };
  const prismSnapshot = useMutation({
    mutationFn: async (resumeJobId?: string) => {
      let jobId = resumeJobId;
      if (!jobId) {
        const started = await apiFetch<SnapshotStartResponse>(`/api/assistant/projects/${projectId}/snapshot`, { method: "POST" });
        jobId = started.jobId;
        persistSnapshot(projectId, { status: "queued", jobId, startedAt: new Date().toISOString() });
      }
      return pollSnapshotJob(
        () => apiFetch<SnapshotPollResponse>(
          `/api/assistant/projects/${projectId}/snapshot/${encodeURIComponent(jobId)}`,
        )
      );
    },
    onMutate: (resumeJobId) => {
      if (!resumeJobId) {
        clearPersistedSnapshot(projectId);
        setSnapshotResult(null);
      }
    },
    onSuccess: (result) => {
      persistSnapshot(projectId, { status: "completed", result, completedAt: new Date().toISOString() });
      setSnapshotResult(result);
      setSnapshotOpen(true);
    },
  });
  const resumeSnapshot = prismSnapshot.mutate;
  useEffect(() => {
    const persisted = readPersistedSnapshot(projectId);
    if (!persisted) return;
    if (persisted.status === "completed") {
      setSnapshotResult(persisted.result);
      return;
    }
    resumeSnapshot(persisted.jobId);
  }, [projectId, resumeSnapshot]);

  if (dashboard.isLoading) return <Centered><Loader2 className="h-7 w-7 animate-spin text-primary" /></Centered>;
  if (dashboard.error || !dashboard.data) return <Centered><p className="text-sm text-destructive">{dashboard.error?.message ?? "Project not found."}</p></Centered>;

  const data = dashboard.data.dashboard;
  const associatedItems = projectItems.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <main className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <Link className="hover:text-foreground" href="/">Action Items</Link>
            <ChevronRight className="h-3 w-3" />
            <Link className="hover:text-foreground" href="/projects">Projects</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="truncate text-foreground">{data.project.title}</span>
          </nav>
          <Button className="ml-auto" size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit project
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 md:px-6 md:py-10">
        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,38%)] lg:items-end">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground"><FolderKanban className="h-5 w-5" /></div>
              <Badge className="border-primary/30 bg-primary/10 text-primary">{data.project.status}</Badge>
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-4xl">{data.project.title}</h1>
            {data.project.description && <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{data.project.description}</p>}
          </div>
          <div className="border-l-2 border-primary pl-5">
            <p className="mb-2 text-[.55rem] font-semibold uppercase tracking-[.18em] text-primary">Project intent</p>
            <p className="text-sm leading-7 text-foreground">{data.project.intent || "Define the higher-level outcome this project exists to create."}</p>
          </div>
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,.7fr)]">
          <HealthPanel data={data} />
          <DeliveryPanel data={data} />
        </section>

        <ProjectItemsPanel
          items={associatedItems}
          total={data.delivery.total - data.delivery.cancelled}
          isLoading={projectItems.isLoading}
          error={projectItems.error}
          hasMore={projectItems.hasNextPage}
          isLoadingMore={projectItems.isFetchingNextPage}
          onLoadMore={() => projectItems.fetchNextPage()}
        />

        <section className="overflow-hidden rounded-lg border bg-card/40">
          <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4 md:px-6">
            <div>
              <h2 className="font-heading text-base font-semibold">Project KPIs</h2>
              <p className="mt-1 text-xs text-muted-foreground">Weighted signals from Prism, analytics, social, and delivery.</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {snapshotResult && !prismSnapshot.isPending && <Button size="sm" variant="ghost" onClick={() => setSnapshotOpen(true)}><Check className="h-4 w-4" /> Review last proposal</Button>}
              <Button size="sm" variant="outline" disabled={!data.kpis.length || prismSnapshot.isPending} onClick={() => prismSnapshot.mutate(undefined)}>
                {prismSnapshot.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />} Snapshot with Prism
              </Button>
              <Button size="sm" onClick={() => setKpiOpen(true)}><Plus className="h-4 w-4" /> Add KPI</Button>
            </div>
          </div>
          {prismSnapshot.error && <p className="border-b bg-destructive/10 px-6 py-3 text-xs text-destructive">{prismSnapshot.error.message}</p>}
          {data.kpis.length ? (
            <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
              {data.kpis.map((kpi) => <KpiCard key={kpi.id} kpi={kpi} onLog={() => setLoggingKpi(kpi)} onConfigure={() => setConfiguringKpi(kpi)} />)}
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
              <Target className="mb-4 h-8 w-8 text-primary" />
              <p className="font-medium">No signals connected yet</p>
              <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">Start with the campaign KPIs from the planning session: reads, website clicks, newsletter growth, inbound leads, or opportunities.</p>
              <Button className="mt-5" size="sm" onClick={() => setKpiOpen(true)}><CirclePlus className="h-4 w-4" /> Add the first KPI</Button>
            </div>
          )}
        </section>

        {data.project.portalLinkUrl && (
          <a className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary" href={data.project.portalLinkUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> Open this project in RaidGuild Portal
          </a>
        )}
      </div>

      <ProjectDialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) void refresh(); }} project={data.project} />
      <NewKpiDialog projectId={projectId} open={kpiOpen} onOpenChange={setKpiOpen} onSaved={refresh} />
      <LogValueDialog projectId={projectId} kpi={loggingKpi} onOpenChange={(open) => { if (!open) setLoggingKpi(null); }} onSaved={refresh} />
      <PlausibleConfigDialog projectId={projectId} kpi={configuringKpi} onOpenChange={(open) => { if (!open) setConfiguringKpi(null); }} onSaved={refresh} />
      <PrismSnapshotDialog
        projectId={projectId}
        kpis={data.kpis}
        result={snapshotResult}
        open={snapshotOpen}
        onOpenChange={setSnapshotOpen}
        onSaved={async () => { clearPersistedSnapshot(projectId); setSnapshotResult(null); await refresh(); }}
      />
    </main>
  );
}

function HealthPanel({ data }: { data: ProjectDashboard }) {
  const score = data.health.score;
  const change = data.health.change;
  return (
    <div className="relative overflow-hidden rounded-lg border bg-card p-5 md:p-6">
      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
      <div className="relative flex flex-wrap items-start gap-6">
        <div className="min-w-32">
          <div className="flex items-center gap-2 text-[.55rem] font-semibold uppercase tracking-[.18em] text-muted-foreground"><Gauge className="h-4 w-4 text-primary" /> Project health</div>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-5xl font-semibold leading-none text-primary md:text-6xl">{score ?? "—"}</span>
            <span className="mb-1 text-sm text-muted-foreground">/100</span>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs">
            {change === null ? <span className="text-muted-foreground">Waiting for history</span> : change >= 0 ? <><ArrowUpRight className="h-4 w-4 text-primary" /><span className="text-primary">{change > 0 ? "+" : ""}{change} pts</span></> : <><ArrowDownRight className="h-4 w-4 text-secondary" /><span className="text-secondary">{change} pts</span></>}
          </div>
        </div>
        <div className="min-w-0 flex-1"><ScoreChart history={data.health.history} /></div>
      </div>
      <p className="relative mt-4 border-t pt-4 text-[.6rem] leading-5 text-muted-foreground">One weighted score across every KPI. Each signal is normalized from its baseline (0) to target (100).</p>
    </div>
  );
}

function ScoreChart({ history }: { history: ProjectDashboard["health"]["history"] }) {
  if (!history.length) return <div className="flex h-40 items-center justify-center rounded border border-dashed text-xs text-muted-foreground"><BarChart3 className="mr-2 h-4 w-4" /> Log KPI values to start the chart</div>;
  const points = history.length === 1 ? [history[0], { ...history[0], capturedAt: new Date().toISOString() }] : history;
  const coords = points.map((point, index) => ({ x: 8 + (index / Math.max(1, points.length - 1)) * 84, y: 92 - Math.max(0, Math.min(100, point.score)) * .8 }));
  const path = coords.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const area = `${path} L ${coords.at(-1)!.x} 96 L ${coords[0].x} 96 Z`;
  return (
    <div>
      <svg viewBox="0 0 100 100" className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label="Project health over time">
        {[20, 40, 60, 80].map((value) => <line key={value} x1="4" x2="96" y1={92 - value * .8} y2={92 - value * .8} stroke="currentColor" className="text-border" strokeWidth=".5" strokeDasharray="2 2" />)}
        <path d={area} fill="hsl(var(--primary))" opacity=".08" />
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {coords.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.5" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="flex justify-between text-[.5rem] uppercase tracking-wider text-muted-foreground"><span>{formatDate(history[0].capturedAt)}</span><span>{formatDate(history.at(-1)!.capturedAt)}</span></div>
    </div>
  );
}

function DeliveryPanel({ data }: { data: ProjectDashboard }) {
  const delivery = data.delivery;
  return (
    <div className="rounded-lg border bg-card p-5 md:p-6">
      <div className="flex items-center gap-2 text-[.55rem] font-semibold uppercase tracking-[.18em] text-muted-foreground"><Activity className="h-4 w-4 text-primary" /> Delivery</div>
      <div className="mt-5 text-4xl font-semibold">{delivery.completionRate ?? "—"}<span className="text-base text-muted-foreground">%</span></div>
      <p className="mt-2 text-xs text-muted-foreground">action items completed</p>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${delivery.completionRate ?? 0}%` }} /></div>
      <dl className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 text-xs">
        <Stat label="Completed" value={delivery.completed} /><Stat label="Active" value={delivery.active} /><Stat label="Open" value={delivery.open} /><Stat label="Total" value={delivery.total} />
      </dl>
    </div>
  );
}

function ProjectItemsPanel({
  items,
  total,
  isLoading,
  error,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  items: ActionItem[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-lg border bg-card/40">
      <div className="flex items-center gap-3 border-b px-5 py-4 md:px-6">
        <ListTodo className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-heading text-base font-semibold">Action items</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {total} {total === 1 ? "item" : "items"} associated with this project
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-36 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : error ? (
        <p className="px-6 py-8 text-center text-sm text-destructive">{error.message}</p>
      ) : !items.length ? (
        <div className="flex min-h-36 flex-col items-center justify-center px-6 text-center">
          <p className="font-medium">No action items yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Associate an action item with this project to see it here.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(120px,240px)_100px_110px] border-b bg-muted/30 px-6 py-2 text-[.5rem] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Item</span>
            <span>Assignee</span>
            <span>Priority</span>
            <span>Status</span>
          </div>
          <div className="divide-y">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/items/${item.id}`}
                className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring md:grid-cols-[minmax(0,1fr)_minmax(120px,240px)_100px_110px] md:px-6"
              >
                <span className="min-w-0 truncate font-medium">{item.title}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground md:hidden" />
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
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center border-t px-5 py-3">
              <Button variant="ghost" size="sm" disabled={isLoadingMore} onClick={onLoadMore}>
                {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold">{value}</dd></div>; }

function KpiCard({ kpi, onLog, onConfigure }: { kpi: ProjectKpi; onLog: () => void; onConfigure: () => void }) {
  const progress = kpi.progress === null ? null : Math.round(kpi.progress * 100);
  return (
    <article className="flex min-h-64 flex-col p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1"><h3 className="font-medium">{kpi.name}</h3><p className="mt-1 text-[.55rem] uppercase tracking-wider text-muted-foreground">{kpi.source} · weight {kpi.weight}{kpi.source === "Plausible" && !kpi.measurementConfig ? " · needs config" : ""}</p></div>
        <span className="text-2xl font-semibold text-primary">{progress === null ? "—" : `${progress}%`}</span>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${progress ?? 0}%` }} /></div>
      <div className="mt-4 flex items-end justify-between gap-4 text-xs"><div><p className="text-muted-foreground">Current</p><p className="mt-1 text-lg font-semibold">{kpi.currentValue === null ? "No data" : formatValue(kpi.currentValue, kpi.unit)}</p></div><div className="text-right"><p className="text-muted-foreground">Target</p><p className="mt-1">{formatValue(kpi.targetValue, kpi.unit)}</p></div></div>
      {kpi.description && <p className="mt-4 line-clamp-2 text-xs leading-5 text-muted-foreground">{kpi.description}</p>}
      {kpi.measurementConfig?.provider === "plausible" && <p className="mt-3 text-[.55rem] leading-5 text-muted-foreground">{kpi.measurementConfig.metric} · {kpi.measurementConfig.siteIds.length} sites · {kpi.measurementConfig.aggregation}</p>}
      <div className="mt-auto flex items-center gap-2 pt-5"><Button size="sm" variant="outline" onClick={onLog}><Plus className="h-3.5 w-3.5" /> Log value</Button><Button size="sm" variant="ghost" onClick={onConfigure}><Pencil className="h-3.5 w-3.5" /> Configure</Button>{kpi.sourceUrl && <a href={kpi.sourceUrl} target="_blank" rel="noreferrer" className="rounded p-2 text-muted-foreground hover:text-primary" aria-label={`Open ${kpi.name} source`}><ExternalLink className="h-4 w-4" /></a>}</div>
    </article>
  );
}

const emptyKpi = { name: "", description: "", unit: "number", source: "manual", sourceUrl: "", baselineValue: "", targetValue: "", weight: "1" };

function NewKpiDialog({ projectId, open, onOpenChange, onSaved }: { projectId: string; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(emptyKpi);
  const save = useMutation({
    mutationFn: () => apiFetch(`/api/v1/projects/${projectId}/kpis`, { method: "POST", body: JSON.stringify({ ...form, sourceUrl: form.sourceUrl || null, baselineValue: Number(form.baselineValue), targetValue: Number(form.targetValue), weight: Number(form.weight) }) }),
    onSuccess: async () => { toast.success("KPI added"); setForm(emptyKpi); await onSaved(); onOpenChange(false); },
  });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl p-0"><DialogHeader className="border-b px-6 py-5 pr-14"><DialogTitle>Add project KPI</DialogTitle><DialogDescription>Define how this signal moves from baseline to target.</DialogDescription></DialogHeader><form className="grid max-h-[72vh] gap-5 overflow-y-auto p-6 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
    <Field label="KPI name" wide><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Website clicks" /></Field>
    <Field label="Source"><select className={selectClass} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}><option>manual</option><option>Prism</option><option>Plausible</option><option>X</option><option>LinkedIn</option><option>YouTube</option><option>Action Items</option></select></Field>
    <Field label="Unit"><select className={selectClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}><option value="number">Number</option><option value="percent">Percent</option><option value="currency">USD</option></select></Field>
    <Field label="Baseline"><Input required type="number" step="any" value={form.baselineValue} onChange={(e) => setForm({ ...form, baselineValue: e.target.value })} /></Field>
    <Field label="Target"><Input required type="number" step="any" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: e.target.value })} /></Field>
    <Field label="Weight" hint="1 = supporting, 10 = critical"><Input required type="number" min="1" max="10" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></Field>
    <Field label="Source URL" wide><Input type="url" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://…" /></Field>
    <Field label="Why it matters" wide><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
    {save.error && <p className="text-sm text-destructive sm:col-span-2">{save.error.message}</p>}
    <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add KPI</Button></div>
  </form></DialogContent></Dialog>;
}

function LogValueDialog({ projectId, kpi, onOpenChange, onSaved }: { projectId: string; kpi: ProjectKpi | null; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => apiFetch(`/api/v1/projects/${projectId}/kpis/${kpi!.id}/snapshots`, { method: "POST", body: JSON.stringify({ value: Number(value), note }) }),
    onSuccess: async () => { toast.success("KPI updated"); setValue(""); setNote(""); await onSaved(); onOpenChange(false); },
  });
  return <Dialog open={!!kpi} onOpenChange={onOpenChange}><DialogContent className="max-w-md p-0"><DialogHeader className="border-b px-6 py-5 pr-14"><DialogTitle>Log {kpi?.name}</DialogTitle><DialogDescription>Add a point-in-time measurement to the project trend.</DialogDescription></DialogHeader><form className="space-y-5 p-6" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}><Field label={`Value (${kpi?.unit ?? "number"})`}><Input autoFocus required type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} /></Field><Field label="Note" hint="Optional context about this change"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>{save.error && <p className="text-sm text-destructive">{save.error.message}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save value</Button></div></form></DialogContent></Dialog>;
}

function PlausibleConfigDialog({ projectId, kpi, onOpenChange, onSaved }: { projectId: string; kpi: ProjectKpi | null; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(() => initialPlausibleForm(null));
  useEffect(() => { if (kpi) setForm(initialPlausibleForm(kpi)); }, [kpi]);
  const siteIds = parseSiteIds(form.siteIds);
  const save = useMutation({
    mutationFn: () => apiFetch(`/api/v1/projects/${projectId}/kpis/${kpi!.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        source: "Plausible",
        measurementConfig: {
          provider: "plausible",
          siteIds,
          metric: form.metric,
          aggregation: form.aggregation,
          dateRange: form.rangeType === "rolling"
            ? { type: "rolling", days: Number(form.rollingDays) }
            : { type: "fixed", start: form.start, end: form.end },
          campaignFilter: form.campaignValue.trim()
            ? { property: form.campaignProperty, value: form.campaignValue.trim() }
            : null,
          sharedGoalName: form.sharedGoalName.trim() || null,
          siteGoalOverrides: siteIds.flatMap((siteId) => form.goalOverrides[siteId]?.trim()
            ? [{ siteId, goalName: form.goalOverrides[siteId].trim() }] : []),
          requireCompleteCoverage: form.requireCompleteCoverage
        }
      })
    }),
    onSuccess: async () => { toast.success("Plausible measurement configured"); await onSaved(); onOpenChange(false); }
  });
  return <Dialog open={!!kpi} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl p-0"><DialogHeader className="border-b px-6 py-5 pr-14"><DialogTitle>Configure {kpi?.name}</DialogTitle><DialogDescription>Define the exact Plausible queries Prism should run across sites.</DialogDescription></DialogHeader><form className="grid max-h-[75vh] gap-5 overflow-y-auto p-6 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
    <Field label="Plausible site IDs" hint="One domain per line" wide><Textarea required value={form.siteIds} onChange={(event) => setForm({ ...form, siteIds: event.target.value })} /></Field>
    <Field label="Metric"><select className={selectClass} value={form.metric} onChange={(event) => setForm({ ...form, metric: event.target.value as PlausibleMeasurementConfig["metric"] })}>{plausibleMetricOptions.map((metric) => <option key={metric} value={metric}>{metric}</option>)}</select></Field>
    <Field label="Aggregate sites with"><select className={selectClass} value={form.aggregation} onChange={(event) => setForm({ ...form, aggregation: event.target.value as PlausibleMeasurementConfig["aggregation"] })}><option value="sum">Sum</option><option value="average">Average</option><option value="minimum">Minimum</option><option value="maximum">Maximum</option></select></Field>
    <Field label="Date range"><select className={selectClass} value={form.rangeType} onChange={(event) => setForm({ ...form, rangeType: event.target.value as "rolling" | "fixed" })}><option value="rolling">Rolling window</option><option value="fixed">Fixed dates</option></select></Field>
    {form.rangeType === "rolling" ? <Field label="Rolling days"><Input required type="number" min="1" max="365" value={form.rollingDays} onChange={(event) => setForm({ ...form, rollingDays: event.target.value })} /></Field> : <><Field label="Start date"><Input required type="date" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></Field><Field label="End date"><Input required type="date" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} /></Field></>}
    <Field label="Campaign property"><select className={selectClass} value={form.campaignProperty} onChange={(event) => setForm({ ...form, campaignProperty: event.target.value as CampaignProperty })}><option value="visit:utm_campaign">utm_campaign</option><option value="visit:utm_source">utm_source</option><option value="visit:utm_medium">utm_medium</option><option value="visit:utm_content">utm_content</option><option value="visit:utm_term">utm_term</option><option value="visit:source">source/referrer</option></select></Field>
    <Field label="Campaign value" hint="Optional; leave blank to measure all traffic"><Input value={form.campaignValue} onChange={(event) => setForm({ ...form, campaignValue: event.target.value })} placeholder="summer-brigade" /></Field>
    <Field label="Shared goal name" hint="Optional; used for every site unless overridden" wide><Input value={form.sharedGoalName} onChange={(event) => setForm({ ...form, sharedGoalName: event.target.value })} placeholder="Signup" /></Field>
    {siteIds.length > 0 && <div className="space-y-3 rounded-md border p-4 sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Per-site goal overrides</p>{siteIds.map((siteId) => <label key={siteId} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><span className="truncate text-xs">{siteId}</span><Input value={form.goalOverrides[siteId] ?? ""} onChange={(event) => setForm({ ...form, goalOverrides: { ...form.goalOverrides, [siteId]: event.target.value } })} placeholder="Use shared goal" /></label>)}</div>}
    <label className="flex items-start gap-3 rounded-md border p-4 sm:col-span-2"><input className="mt-1 accent-[hsl(var(--primary))]" type="checkbox" checked={form.requireCompleteCoverage} onChange={(event) => setForm({ ...form, requireCompleteCoverage: event.target.checked })} /><span><span className="block text-sm font-medium">Require complete site coverage</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Mark this KPI unavailable if any configured site cannot be queried successfully.</span></span></label>
    {save.error && <p className="text-sm text-destructive sm:col-span-2">{save.error.message}</p>}
    <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={save.isPending || !siteIds.length}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save configuration</Button></div>
  </form></DialogContent></Dialog>;
}

function PrismSnapshotDialog({ projectId, kpis, result, open, onOpenChange, onSaved }: {
  projectId: string;
  kpis: ProjectKpi[];
  result: PrismSnapshotResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [rows, setRows] = useState<Array<PrismSnapshotProposal["metrics"][number] & { selected: boolean; editedValue: string }>>([]);
  useEffect(() => {
    setRows(result?.proposal?.metrics.map((metric) => ({ ...metric, selected: true, editedValue: String(metric.value) })) ?? []);
  }, [result]);
  const save = useMutation({
    mutationFn: async () => {
      const validRows = rows.filter((row) => row.selected && validSnapshotValue(row.editedValue));
      await Promise.all(validRows.map((row) => {
        const note = `Prism · ${row.confidence} confidence · ${row.source}: ${row.evidence}`.slice(0, 2_000);
        return apiFetch(`/api/v1/projects/${projectId}/kpis/${row.kpiId}/snapshots`, {
          method: "POST",
          body: JSON.stringify({
            value: Number(row.editedValue),
            capturedAt: result!.proposal!.capturedAt,
            note,
          })
        });
      }));
      return validRows.length;
    },
    onSuccess: async (count) => {
      toast.success(`${count} Prism snapshot${count === 1 ? "" : "s"} saved`);
      await onSaved();
      onOpenChange(false);
    }
  });
  const kpiName = (id: string) => kpis.find((kpi) => kpi.id === id)?.name ?? "Unknown KPI";
  const selectedRows = rows.filter((row) => row.selected);
  const canSave = selectedRows.length > 0 && selectedRows.every((row) => validSnapshotValue(row.editedValue));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl p-0"><DialogHeader className="border-b px-6 py-5 pr-14"><DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> Prism snapshot proposal</DialogTitle><DialogDescription>Review every measurement before it is added to project history.</DialogDescription></DialogHeader><div className="max-h-[72vh] overflow-y-auto p-6">
    {result?.proposal ? <>
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground"><Badge className="border-primary/30 bg-primary/10 text-primary"><Check className="mr-1 h-3 w-3" /> Structured response</Badge><span>Captured {new Date(result.proposal.capturedAt).toLocaleString()}</span></div>
      {rows.length ? <div className="overflow-hidden rounded-md border"><div className="hidden grid-cols-[32px_minmax(150px,1fr)_120px_minmax(160px,1.4fr)] gap-3 border-b bg-muted/30 px-4 py-2 text-[.5rem] uppercase tracking-wider text-muted-foreground sm:grid"><span /><span>KPI</span><span>Value</span><span>Evidence</span></div>{rows.map((row, index) => <label key={row.kpiId} className="grid cursor-pointer grid-cols-[32px_minmax(0,1fr)] gap-3 border-b px-4 py-4 last:border-b-0 sm:grid-cols-[32px_minmax(150px,1fr)_120px_minmax(160px,1.4fr)]"><input type="checkbox" checked={row.selected} onChange={(event) => setRows(rows.map((entry, entryIndex) => entryIndex === index ? { ...entry, selected: event.target.checked } : entry))} className="mt-1 accent-[hsl(var(--primary))]" /><div><p className="text-sm font-medium">{kpiName(row.kpiId)}</p><p className="mt-1 text-[.55rem] text-muted-foreground">{row.source} · {row.confidence}</p></div><Input type="number" step="any" value={row.editedValue} disabled={!row.selected} onChange={(event) => setRows(rows.map((entry, entryIndex) => entryIndex === index ? { ...entry, editedValue: event.target.value } : entry))} /><p className="text-xs leading-5 text-muted-foreground">{row.evidence}</p></label>)}</div> : <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">Prism could not measure any configured KPI.</p>}
      {result.proposal.unavailable.length > 0 && <div className="mt-5"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Needs setup</h3><p className="mt-1 text-xs text-muted-foreground">Prism could not measure these KPIs yet. Nothing failed and no values will be saved for them.</p><ul className="mt-3 space-y-2">{result.proposal.unavailable.map((entry) => <li key={entry.kpiId} className="rounded border px-4 py-3 text-xs"><span className="font-medium text-foreground">{kpiName(entry.kpiId)}</span><span className="text-muted-foreground"> — {entry.reason}</span></li>)}</ul></div>}
    </> : <div><p className="rounded-md border border-secondary/30 bg-secondary/10 p-4 text-sm text-secondary">{result?.parseError ?? "Prism did not return a snapshot."}</p><h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Raw Prism response</h3><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-4 text-xs leading-6 text-muted-foreground">{result?.rawResponse}</pre></div>}
    {save.error && <p className="mt-4 text-sm text-destructive">{save.error.message}</p>}
    <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>{result?.proposal && <Button disabled={!canSave || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirm snapshots</Button>}</div>
  </div></DialogContent></Dialog>;
}

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) { return <label className={`block space-y-2 ${wide ? "sm:col-span-2" : ""}`}><span className="text-sm font-medium">{label}</span>{children}{hint && <span className="block text-[.55rem] text-muted-foreground">{hint}</span>}</label>; }
function formatValue(value: number, unit: string) { if (unit === "percent") return `${value}%`; if (unit === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value)); }
function validSnapshotValue(value: string) { return value.trim() !== "" && Number.isFinite(Number(value)); }
function Centered({ children }: { children: React.ReactNode }) { return <main className="flex min-h-dvh items-center justify-center p-8">{children}</main>; }
const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

const plausibleMetricOptions = ["visitors", "visits", "pageviews", "views_per_visit", "bounce_rate", "visit_duration", "events", "scroll_depth", "conversion_rate", "group_conversion_rate", "time_on_page"];
const defaultPlausibleSites = ["fireside.raidguild.org", "portal.raidguild.org", "raidguild.ai", "raidguild.org"];
function parseSiteIds(value: string) { return [...new Set(value.split(/[\s,]+/).map((entry) => entry.trim()).filter(Boolean))]; }
function initialPlausibleForm(kpi: ProjectKpi | null): PlausibleConfigForm {
  const config = kpi?.measurementConfig?.provider === "plausible" ? kpi.measurementConfig : null;
  return {
    siteIds: (config?.siteIds ?? defaultPlausibleSites).join("\n"),
    metric: config?.metric ?? "visitors",
    aggregation: config?.aggregation ?? "sum",
    rangeType: config?.dateRange.type ?? "rolling",
    rollingDays: config?.dateRange.type === "rolling" ? String(config.dateRange.days) : "14",
    start: config?.dateRange.type === "fixed" ? config.dateRange.start : "",
    end: config?.dateRange.type === "fixed" ? config.dateRange.end : "",
    campaignProperty: config?.campaignFilter?.property ?? "visit:utm_campaign",
    campaignValue: config?.campaignFilter?.value ?? "",
    sharedGoalName: config?.sharedGoalName ?? "",
    goalOverrides: Object.fromEntries(config?.siteGoalOverrides.map((override) => [override.siteId, override.goalName]) ?? []),
    requireCompleteCoverage: config?.requireCompleteCoverage ?? true
  };
}
type PlausibleConfigForm = {
  siteIds: string;
  metric: PlausibleMeasurementConfig["metric"];
  aggregation: PlausibleMeasurementConfig["aggregation"];
  rangeType: "rolling" | "fixed";
  rollingDays: string;
  start: string;
  end: string;
  campaignProperty: CampaignProperty;
  campaignValue: string;
  sharedGoalName: string;
  goalOverrides: Record<string, string>;
  requireCompleteCoverage: boolean;
};
type CampaignProperty = NonNullable<PlausibleMeasurementConfig["campaignFilter"]>["property"];
