import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSnapshotHookStatus, triggerSnapshotHook } from "@/lib/prism/snapshot-hook";

beforeEach(() => {
  process.env.PRISM_SITE_BASE_URL = "https://prism.example";
  process.env.PRISM_EXTERNAL_INTERFACE_KEY = "action-items";
  process.env.PRISM_EXTERNAL_INTERFACE_CREDENTIAL = "interface-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PRISM_SITE_BASE_URL;
  delete process.env.PRISM_EXTERNAL_INTERFACE_KEY;
  delete process.env.PRISM_EXTERNAL_INTERFACE_CREDENTIAL;
});

describe("Prism snapshot hook", () => {
  it("triggers with interface authentication and accepts a completed result", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: "queued", changeRequest: { requestNumber: 123 }, resultUrl: resultPath(123) }, 202))
      .mockResolvedValueOnce(jsonResponse({ ok: true, status: "completed", requestNumber: 123, artifact: { name: "kpi-snapshot-proposal.json" }, result: { capturedAt: "2026-07-22T17:00:00Z", metrics: [], unavailable: [] } }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const job = await triggerSnapshotHook({ projectTitle: "Summer Brigade" });
    await expect(getSnapshotHookStatus(job)).resolves.toMatchObject({ status: "completed", result: { metrics: [] } });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://prism.example/agent/hooks/project-kpi-snapshot/trigger");
    expect(init).toMatchObject({ method: "POST", redirect: "error" });
    expect(init.headers).toMatchObject({ "x-prism-interface-id": "action-items", "x-prism-interface-key": "interface-secret" });
  });

  it("returns queued while the workflow is running", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ok: true, status: "queued" }, 202)));
    await expect(getSnapshotHookStatus({ requestNumber: 4, resultUrl: resultPath(4) })).resolves.toEqual({ status: "queued" });
  });

  it("rejects a trigger failure without exposing its body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { code: "HOOK_DISABLED", message: "internal detail" } }, 409)));
    await expect(triggerSnapshotHook({})).rejects.toMatchObject({ status: 409, code: "HOOK_DISABLED", message: "Prism rejected the KPI snapshot trigger." });
  });

  it("reports a completed workflow failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ok: false, status: "failed", error: { code: "WORKFLOW_FAILED" } }, 200)));
    await expect(getSnapshotHookStatus({ requestNumber: 5, resultUrl: resultPath(5) })).rejects.toMatchObject({ code: "WORKFLOW_FAILED" });
  });

  it("rejects a missing or unexpected result artifact", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ok: true, status: "completed", requestNumber: 6, artifact: { name: "other.json" }, result: {} }, 200)));
    await expect(getSnapshotHookStatus({ requestNumber: 6, resultUrl: resultPath(6) })).rejects.toMatchObject({ code: "PRISM_HOOK_MISSING_ARTIFACT" });
  });

  it("rejects an untrusted result URL before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getSnapshotHookStatus({ requestNumber: 7, resultUrl: "https://attacker.example/result" })).rejects.toMatchObject({ code: "INVALID_SNAPSHOT_JOB" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function resultPath(requestNumber: number) {
  return `/agent/hooks/project-kpi-snapshot/requests/${requestNumber}/result`;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
