import { z } from "zod";
import { ApiError } from "@/lib/api/errors";

const triggerSchema = z.object({
  ok: z.literal(true),
  status: z.literal("queued"),
  changeRequest: z.object({ requestNumber: z.number().int().positive() }).passthrough(),
  resultUrl: z.string()
}).passthrough();

const completedSchema = z.object({
  ok: z.literal(true),
  status: z.literal("completed"),
  requestNumber: z.number().int().positive(),
  artifact: z.object({ name: z.string() }).passthrough(),
  result: z.unknown()
}).passthrough();

export type SnapshotHookJob = { requestNumber: number; resultUrl: string };
export type SnapshotHookStatus = { status: "queued" } | { status: "completed"; result: unknown };

export async function triggerSnapshotHook(input: unknown): Promise<SnapshotHookJob> {
  const response = await hookFetch("/agent/hooks/project-kpi-snapshot/trigger", {
    method: "POST",
    body: JSON.stringify(input)
  });
  const payload = await safeJson(response);
  if (response.status !== 202) throw hookError(response, payload, "Prism rejected the KPI snapshot trigger.");
  const parsed = triggerSchema.safeParse(payload);
  if (!parsed.success) throw new ApiError(502, "PRISM_HOOK_INVALID_TRIGGER", "Prism returned an invalid KPI snapshot trigger response.");
  const expectedUrl = resultPath(parsed.data.changeRequest.requestNumber);
  if (parsed.data.resultUrl !== expectedUrl) {
    throw new ApiError(502, "PRISM_HOOK_INVALID_RESULT_URL", "Prism returned an invalid KPI snapshot result URL.");
  }
  return { requestNumber: parsed.data.changeRequest.requestNumber, resultUrl: expectedUrl };
}

export async function getSnapshotHookStatus(job: SnapshotHookJob): Promise<SnapshotHookStatus> {
  const expectedUrl = resultPath(job.requestNumber);
  if (job.resultUrl !== expectedUrl) throw new ApiError(400, "INVALID_SNAPSHOT_JOB", "The snapshot job is invalid.");
  const response = await hookFetch(expectedUrl, { method: "GET" });
  const payload = await safeJson(response);
  if (response.status === 202) return { status: "queued" };
  if (response.status !== 200) throw hookError(response, payload, "Prism could not complete the KPI snapshot workflow.");
  if (isFailure(payload)) throw hookError(response, payload, "Prism could not complete the KPI snapshot workflow.");
  const parsed = completedSchema.safeParse(payload);
  if (!parsed.success || parsed.data.requestNumber !== job.requestNumber) {
    throw new ApiError(502, "PRISM_HOOK_INVALID_RESULT", "Prism returned an invalid KPI snapshot result.");
  }
  if (parsed.data.artifact.name !== "kpi-snapshot-proposal.json") {
    throw new ApiError(502, "PRISM_HOOK_MISSING_ARTIFACT", "Prism completed without the expected KPI snapshot artifact.");
  }
  return { status: "completed", result: parsed.data.result };
}

function hookFetch(path: string, init: RequestInit) {
  const baseUrl = requiredUrl();
  const interfaceId = requiredEnv("PRISM_EXTERNAL_INTERFACE_KEY");
  const credential = requiredEnv("PRISM_EXTERNAL_INTERFACE_CREDENTIAL");
  return fetch(new URL(path, `${baseUrl}/`), {
    ...init,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: {
      "content-type": "application/json",
      "x-prism-interface-id": interfaceId,
      "x-prism-interface-key": credential,
      ...init.headers
    }
  }).catch((error) => {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ApiError(504, "PRISM_HOOK_TIMEOUT", "Prism did not respond to the snapshot status request.");
    }
    throw error;
  });
}

function requiredUrl() {
  const value = requiredEnv("PRISM_SITE_BASE_URL").replace(/\/$/, "");
  let url: URL;
  try { url = new URL(value); }
  catch { throw new ApiError(503, "PRISM_HOOK_NOT_CONFIGURED", "The Prism Site URL is invalid."); }
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new ApiError(503, "PRISM_HOOK_NOT_CONFIGURED", "The Prism Site URL must use HTTPS.");
  }
  return url.origin;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new ApiError(503, "PRISM_HOOK_NOT_CONFIGURED", `${name} is not configured.`);
  return value;
}

function resultPath(requestNumber: number) {
  return `/agent/hooks/project-kpi-snapshot/requests/${requestNumber}/result`;
}

async function safeJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

function isFailure(payload: unknown) {
  return typeof payload === "object" && payload !== null && (("ok" in payload && payload.ok === false) || ("status" in payload && payload.status === "failed"));
}

function hookError(response: Response, payload: unknown, fallback: string) {
  const error = typeof payload === "object" && payload !== null && "error" in payload ? payload.error : null;
  const upstreamCode = typeof error === "string" ? error : typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;
  return new ApiError(response.status >= 500 ? 502 : response.status, upstreamCode || "PRISM_HOOK_FAILED", fallback, {
    upstreamStatus: response.status,
    ...(upstreamCode ? { upstreamCode } : {})
  });
}
