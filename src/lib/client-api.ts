import type { ActionItem, ActionItemEvent, UserSummary } from "@/lib/action-items/service";

export type { ActionItem, ActionItemEvent, UserSummary };

export class ClientApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details: Record<string, unknown> = {}) {
    super(message);
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers
    }
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = body?.error ?? {};
    throw new ClientApiError(response.status, error.code ?? "REQUEST_FAILED", error.message ?? "Request failed.", error.details ?? {});
  }
  return body as T;
}

export function userLabel(user: UserSummary | null | undefined) {
  if (!user) return "Unassigned";
  return user.handle ? `@${user.handle}` : user.name || "Portal member";
}
