import type { PrismSnapshotResponse } from "@/lib/prism/snapshot-poll";

export type PersistedSnapshotJob =
  | { status: "queued"; jobId: string; startedAt: string }
  | { status: "completed"; result: PrismSnapshotResponse; completedAt: string };

export function snapshotStorageKey(projectId: string) {
  return `action-items:project-snapshot:${projectId}`;
}

export function readPersistedSnapshot(projectId: string): PersistedSnapshotJob | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(snapshotStorageKey(projectId)) ?? "null");
    if (!value || typeof value !== "object" || !("status" in value)) return null;
    if (value.status === "queued" && "jobId" in value && typeof value.jobId === "string") {
      return {
        status: "queued",
        jobId: value.jobId,
        startedAt: "startedAt" in value && typeof value.startedAt === "string" ? value.startedAt : new Date().toISOString(),
      };
    }
    if (value.status === "completed" && "result" in value && value.result && typeof value.result === "object") {
      return {
        status: "completed",
        result: value.result as PrismSnapshotResponse,
        completedAt: "completedAt" in value && typeof value.completedAt === "string" ? value.completedAt : new Date().toISOString(),
      };
    }
  } catch {
    // Ignore stale or malformed browser state.
  }
  return null;
}

export function persistSnapshot(projectId: string, value: PersistedSnapshotJob) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(snapshotStorageKey(projectId), JSON.stringify(value));
  } catch {
    // Persistence is a convenience; restricted storage must not break snapshots.
  }
}

export function clearPersistedSnapshot(projectId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(snapshotStorageKey(projectId));
  } catch {
    // Ignore restricted storage and continue clearing in-memory state.
  }
}
