import { ApiError } from "@/lib/api/errors";

type PrismResponse = { requestId?: unknown; error?: unknown };
type PrismSessionResponse = PrismResponse & { sessionId?: unknown };
type PrismMessageResponse = PrismResponse & { message?: { content?: unknown } };

export async function createPrismSession(externalUserId: string) {
  const response = await prismFetch("/sessions", externalUserId, {
    method: "POST",
    body: JSON.stringify({ metadata: { externalUserId, source: "external-chatbot" } })
  });
  const payload = await safeJson<PrismSessionResponse>(response);
  if (!response.ok || typeof payload.sessionId !== "string") {
    throw upstreamError(response, payload, "Prism session creation failed.", "create");
  }
  return payload.sessionId;
}

export async function sendPrismMessage(sessionId: string, externalUserId: string, message: string, options: { timeoutMs?: number } = {}) {
  const response = await prismFetch(`/sessions/${encodeURIComponent(sessionId)}/messages`, externalUserId, {
    method: "POST",
    body: JSON.stringify({ message, metadata: { externalUserId } })
  }, options.timeoutMs);
  const payload = await safeJson<PrismMessageResponse>(response);
  if (!response.ok || typeof payload.message?.content !== "string") {
    throw upstreamError(response, payload, "Prism could not answer right now.", "message");
  }
  return payload.message.content;
}

async function prismFetch(path: string, externalUserId: string, init: RequestInit, timeoutMs = 45_000) {
  const baseUrl = (process.env.PRISM_BASE_URL?.trim() || "https://prism.raidguild.org").replace(/\/$/, "");
  const interfaceKey = process.env.PRISM_EXTERNAL_INTERFACE_KEY?.trim() || "action-items";
  const credential = process.env.PRISM_EXTERNAL_INTERFACE_CREDENTIAL?.trim();
  if (!credential) throw new ApiError(503, "PRISM_NOT_CONFIGURED", "Prism guidance is not configured.");
  try {
    return await fetch(`${baseUrl}/interactions/${encodeURIComponent(interfaceKey)}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        authorization: `Bearer ${credential}`,
        "content-type": "application/json",
        "x-prism-external-subject": externalUserId,
        ...init.headers
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ApiError(504, "PRISM_TIMEOUT", `Prism did not respond within ${Math.round(timeoutMs / 1_000)} seconds.`);
    }
    throw error;
  }
}

async function safeJson<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({} as T));
}

function upstreamError(response: Response, payload: PrismResponse, fallback: string, operation: "create" | "message") {
  const upstreamCode = typeof payload.error === "string" ? payload.error : undefined;
  const prismRequestId = typeof payload.requestId === "string" ? payload.requestId : undefined;
  const details = { upstreamStatus: response.status, upstreamCode, prismRequestId };

  if (operation === "message" && response.status === 404 && upstreamCode === "EXTERNAL_INTERACTION_SESSION_NOT_FOUND") {
    return new ApiError(404, "PRISM_SESSION_NOT_FOUND", "The Prism conversation expired.", details);
  }
  if (response.status === 404 && upstreamCode === "EXTERNAL_INTERFACE_NOT_FOUND") {
    return new ApiError(502, "PRISM_INTERFACE_NOT_FOUND", "The configured Prism external interface was not found.", details);
  }
  if (response.status === 409 && upstreamCode === "EXTERNAL_INTERFACE_DISABLED") {
    return new ApiError(503, "PRISM_INTERFACE_DISABLED", "The Prism external interface is disabled.", details);
  }
  if (response.status === 401 && upstreamCode === "EXTERNAL_INTERFACE_UNAUTHORIZED") {
    return new ApiError(502, "PRISM_INTERFACE_UNAUTHORIZED", "Prism rejected the external interface credential.", details);
  }
  if (response.status === 429) {
    return new ApiError(429, "PRISM_RATE_LIMITED", "Prism is busy. Please try again shortly.", {
      ...details,
      retryAfter: response.headers.get("retry-after")
    });
  }
  return new ApiError(502, "PRISM_UPSTREAM_ERROR", fallback, details);
}
