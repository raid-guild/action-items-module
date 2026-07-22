import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPrismSession, sendPrismMessage } from "@/lib/prism/client";

beforeEach(() => {
  process.env.PRISM_BASE_URL = "https://prism.example";
  process.env.PRISM_EXTERNAL_INTERFACE_CREDENTIAL = "test-credential";
  delete process.env.PRISM_EXTERNAL_INTERFACE_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PRISM_BASE_URL;
  delete process.env.PRISM_EXTERNAL_INTERFACE_CREDENTIAL;
  delete process.env.PRISM_EXTERNAL_INTERFACE_KEY;
});

describe("Prism external interaction client", () => {
  it("creates sessions against the action-items interface without browser headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      ok: true,
      requestId: "prism-request-1",
      sessionId: "prism-session-1"
    }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPrismSession("portal-user:123")).resolves.toBe("prism-session-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://prism.example/interactions/action-items/sessions");
    expect(init.headers).toMatchObject({
      authorization: "Bearer test-credential",
      "content-type": "application/json",
      "x-prism-external-subject": "portal-user:123"
    });
    expect(new Headers(init.headers).has("origin")).toBe(false);
  });

  it("does not mislabel an unknown interface as an expired session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      ok: false,
      requestId: "prism-request-2",
      error: "EXTERNAL_INTERFACE_NOT_FOUND"
    }, 404)));

    await expect(createPrismSession("portal-user:123")).rejects.toMatchObject({
      code: "PRISM_INTERFACE_NOT_FOUND",
      details: { prismRequestId: "prism-request-2" }
    });
  });

  it("reports a missing message session as recoverable expiration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      ok: false,
      requestId: "prism-request-3",
      error: "EXTERNAL_INTERACTION_SESSION_NOT_FOUND"
    }, 404)));

    await expect(sendPrismMessage("old-session", "portal-user:123", "Help me choose work")).rejects.toMatchObject({
      code: "PRISM_SESSION_NOT_FOUND",
      details: { prismRequestId: "prism-request-3" }
    });
  });

  it("maps an upstream timeout to a safe gateway timeout", async () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));

    await expect(createPrismSession("portal-user:123")).rejects.toMatchObject({
      status: 504,
      code: "PRISM_TIMEOUT",
      message: "Prism did not respond within 45 seconds."
    });
  });

  it("honors a custom message timeout", async () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));

    await expect(sendPrismMessage("session", "portal-user:123", "Help", { timeoutMs: 5_000 }))
      .rejects.toMatchObject({
        status: 504,
        code: "PRISM_TIMEOUT",
        message: "Prism did not respond within 5 seconds.",
      });
  });
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
