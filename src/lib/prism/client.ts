import { ApiError } from "@/lib/api/errors";

type PrismSessionResponse = { sessionId?: unknown; error?: unknown };
type PrismMessageResponse = { message?: { content?: unknown }; error?: unknown };

export async function createPrismSession(externalUserId: string) {
  const response = await prismFetch("/sessions", externalUserId, {
    method: "POST",
    body: JSON.stringify({ metadata: { externalUserId, source: "external-chatbot" } })
  });
  const payload = await safeJson<PrismSessionResponse>(response);
  if (!response.ok || typeof payload.sessionId !== "string") throw upstreamError(response, payload.error, "Prism session creation failed.");
  return payload.sessionId;
}

export async function sendPrismMessage(sessionId: string, externalUserId: string, message: string) {
  const response = await prismFetch(`/sessions/${encodeURIComponent(sessionId)}/messages`, externalUserId, {
    method: "POST",
    body: JSON.stringify({ message, metadata: { externalUserId } })
  });
  const payload = await safeJson<PrismMessageResponse>(response);
  if (!response.ok || typeof payload.message?.content !== "string") throw upstreamError(response, payload.error, "Prism could not answer right now.");
  return payload.message.content;
}

function prismFetch(path: string, externalUserId: string, init: RequestInit) {
  const baseUrl = (process.env.PRISM_BASE_URL?.trim() || "https://prism.raidguild.org").replace(/\/$/, "");
  const interfaceKey = process.env.PRISM_EXTERNAL_INTERFACE_KEY?.trim() || "external-chatbot";
  const credential = process.env.PRISM_EXTERNAL_INTERFACE_CREDENTIAL?.trim();
  if (!credential) throw new ApiError(503, "PRISM_NOT_CONFIGURED", "Prism guidance is not configured.");
  return fetch(`${baseUrl}/interactions/${encodeURIComponent(interfaceKey)}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
    headers: {
      authorization: `Bearer ${credential}`,
      "content-type": "application/json",
      "x-prism-external-subject": externalUserId,
      ...init.headers
    }
  });
}

async function safeJson<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({} as T));
}

function upstreamError(response: Response, upstreamCode: unknown, fallback: string) {
  if (response.status === 404) return new ApiError(404, "PRISM_SESSION_NOT_FOUND", "The Prism conversation expired.");
  if (response.status === 429) {
    return new ApiError(429, "PRISM_RATE_LIMITED", "Prism is busy. Please try again shortly.", {
      retryAfter: response.headers.get("retry-after")
    });
  }
  return new ApiError(502, "PRISM_UPSTREAM_ERROR", fallback, {
    upstreamStatus: response.status,
    upstreamCode: typeof upstreamCode === "string" ? upstreamCode : undefined
  });
}
