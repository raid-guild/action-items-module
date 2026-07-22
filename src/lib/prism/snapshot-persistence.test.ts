// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPersistedSnapshot,
  persistSnapshot,
  readPersistedSnapshot,
  snapshotStorageKey,
} from "@/lib/prism/snapshot-persistence";

describe("snapshot browser persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("retains a queued job for a project", () => {
    persistSnapshot("project-1", { status: "queued", jobId: "opaque-job", startedAt: "2026-07-22T18:00:00Z" });
    expect(readPersistedSnapshot("project-1")).toEqual({
      status: "queued",
      jobId: "opaque-job",
      startedAt: "2026-07-22T18:00:00Z",
    });
    expect(readPersistedSnapshot("project-2")).toBeNull();
  });

  it("retains and clears a completed proposal", () => {
    const result = { proposal: null, parseError: "Unavailable", rawResponse: "{}" };
    persistSnapshot("project-1", { status: "completed", result, completedAt: "2026-07-22T18:01:00Z" });
    expect(readPersistedSnapshot("project-1")).toMatchObject({ status: "completed", result });
    clearPersistedSnapshot("project-1");
    expect(window.localStorage.getItem(snapshotStorageKey("project-1"))).toBeNull();
  });

  it("ignores malformed stored data", () => {
    window.localStorage.setItem(snapshotStorageKey("project-1"), "not-json");
    expect(readPersistedSnapshot("project-1")).toBeNull();
  });
});
