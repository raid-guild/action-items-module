import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issueSnapshotJob, verifySnapshotJob } from "@/lib/prism/snapshot-job";

beforeEach(() => { process.env.SESSION_SECRET = "local-test-session-secret-at-least-32-characters"; });
afterEach(() => { delete process.env.SESSION_SECRET; });

describe("snapshot job IDs", () => {
  it("round-trips a signed project and user-bound job", async () => {
    const input = {
      projectId: "00000000-0000-4000-8000-000000000001",
      portalUserId: "portal-user-1",
      kpiIds: ["00000000-0000-4000-8000-000000000002"],
      requestNumber: 123,
      resultUrl: "/agent/hooks/project-kpi-snapshot/requests/123/result"
    };
    const token = await issueSnapshotJob(input);
    await expect(verifySnapshotJob(token)).resolves.toMatchObject(input);
  });

  it("rejects a modified job ID", async () => {
    const token = await issueSnapshotJob({
      projectId: "00000000-0000-4000-8000-000000000001", portalUserId: "portal-user-1",
      kpiIds: ["00000000-0000-4000-8000-000000000002"],
      requestNumber: 123, resultUrl: "/agent/hooks/project-kpi-snapshot/requests/123/result"
    });
    await expect(verifySnapshotJob(`${token.slice(0, -1)}x`)).rejects.toMatchObject({ code: "INVALID_SNAPSHOT_JOB" });
  });

  it("preserves a missing signing-key configuration error", async () => {
    delete process.env.SESSION_SECRET;
    await expect(verifySnapshotJob("not-a-token")).rejects.toMatchObject({
      status: 503,
      code: "SNAPSHOT_JOB_NOT_CONFIGURED",
    });
  });
});
