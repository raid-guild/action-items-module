import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/actor";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details: Record<string, unknown> = {}) {
    super(message);
  }
}

export function errorResponse(error: unknown, requestId: string) {
  if (error instanceof ApiError) return jsonError(error.status, error.code, error.message, requestId, error.details);
  if (error instanceof AuthError) return jsonError(error.status, "UNAUTHORIZED", error.message, requestId);
  if (error instanceof ZodError) {
    return jsonError(422, "VALIDATION_ERROR", "The request did not pass validation.", requestId, {
      issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
    });
  }
  console.error("Unhandled Action Items API error", { requestId, error: safeError(error) });
  return jsonError(500, "INTERNAL_ERROR", "An unexpected error occurred.", requestId);
}

export function jsonWithRequestId(body: unknown, requestId: string, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-request-id", requestId);
  return Response.json(body, { ...init, headers });
}

function jsonError(status: number, code: string, message: string, requestId: string, details: Record<string, unknown> = {}) {
  return jsonWithRequestId({ error: { code, message, requestId, details } }, requestId, { status });
}

function safeError(error: unknown) {
  return error instanceof Error ? { name: error.name, message: error.message } : { value: String(error) };
}
