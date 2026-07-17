import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";

export type Actor = {
  type: "portal_user" | "agent" | "system";
  id: string;
  label: string;
  localUserId?: string;
  portalUserId?: string;
};

export class AuthError extends Error {
  constructor(readonly status: 401 | 403, message: string) {
    super(message);
  }
}

export async function requireActor(request: NextRequest, options: { portalOnly?: boolean; mutation?: boolean } = {}): Promise<Actor> {
  const token = bearerToken(request);
  if (token && !options.portalOnly) {
    const expected = process.env.ACTION_ITEMS_AGENT_API_TOKEN;
    if (!expected || !safeEqual(token, expected)) throw new AuthError(401, "Invalid bearer credential.");
    return { type: "agent", id: "agent:prism-action-items", label: "Prism Action Items Agent" };
  }

  const session = await getSession();
  if (!session.userId || !session.portalUserId) throw new AuthError(401, "Portal launch session required.");
  if (options.mutation) assertSameOrigin(request);
  return {
    type: "portal_user",
    id: session.portalUserId,
    label: session.name || session.handle || `Portal user ${session.portalUserId}`,
    localUserId: session.userId,
    portalUserId: session.portalUserId
  };
}

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

function safeEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  if (origin !== request.nextUrl.origin) throw new AuthError(403, "Cross-origin mutation rejected.");
}
