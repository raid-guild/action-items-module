import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getSession, portalModulesUrl } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  return Response.json({
    authenticated: Boolean(session.userId),
    user: session.userId ? {
      id: session.userId,
      portalUserId: session.portalUserId,
      name: session.name,
      handle: session.handle,
      avatarUrl: session.avatarUrl
    } : null,
    portalUrl: portalModulesUrl(),
    localLoginEnabled: localLoginEnabled()
  });
}

export async function POST(request: Request) {
  if (!localLoginEnabled()) return Response.json({ error: { code: "NOT_FOUND", message: "Not found." } }, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  const password = body !== null
    && typeof body === "object"
    && "password" in body
    && typeof body.password === "string"
    ? body.password
    : "";
  const expected = process.env.LOCAL_ADMIN_PASSWORD!;
  if (!safeEqual(password, expected)) {
    return Response.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid local admin password." } }, { status: 401 });
  }

  const portalUserId = process.env.LOCAL_ADMIN_PORTAL_USER_ID?.trim()
    || process.env.ACTION_ITEMS_AGENT_PORTAL_USER_ID?.trim();
  if (!portalUserId) {
    return Response.json({ error: { code: "LOCAL_ADMIN_USER_REQUIRED", message: "LOCAL_ADMIN_PORTAL_USER_ID is not configured." } }, { status: 503 });
  }
  const [user] = await getDb().select().from(users)
    .where(eq(users.portalUserId, portalUserId)).limit(1);
  if (!user || !user.isActive) {
    return Response.json({ error: { code: "LOCAL_ADMIN_USER_NOT_FOUND", message: "The configured local admin user does not exist or is inactive." } }, { status: 503 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.portalUserId = user.portalUserId;
  session.portalProfileId = user.portalProfileId;
  session.name = user.name;
  session.handle = user.handle;
  session.avatarUrl = user.avatarUrl;
  session.roles = user.roles;
  delete session.prismSessionId;
  await session.save();
  return Response.json({ authenticated: true });
}

export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return new Response(null, { status: 204 });
}

function localLoginEnabled() {
  return process.env.NODE_ENV === "development" && Boolean(process.env.LOCAL_ADMIN_PASSWORD?.trim());
}

function safeEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}
