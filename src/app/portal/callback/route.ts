import { NextRequest, NextResponse } from "next/server";
import { verifyPortalLaunchToken, LaunchTokenError } from "@/lib/auth/launch-token";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return launchError("missing_token", request);

  try {
    const claims = await verifyPortalLaunchToken(token);
    const db = getDb();
    const [user] = await db.insert(users).values({
      portalUserId: claims.portalUserId,
      portalProfileId: claims.portalProfileId,
      name: claims.name,
      handle: claims.handle,
      avatarUrl: claims.avatarUrl,
      roles: claims.roles,
      lastSeenAt: new Date()
    }).onConflictDoUpdate({
      target: users.portalUserId,
      set: {
        portalProfileId: claims.portalProfileId,
        name: claims.name,
        handle: claims.handle,
        avatarUrl: claims.avatarUrl,
        roles: claims.roles,
        isActive: true,
        lastSeenAt: new Date()
      }
    }).returning();

    if (!user) throw new Error("Portal user upsert returned no row.");
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
    return new NextResponse(null, { status: 303, headers: { location: "/" } });
  } catch (error) {
    const reason = error instanceof LaunchTokenError ? error.code : "callback_failed";
    console.error("Portal launch rejected", error instanceof LaunchTokenError
      ? { code: error.code, message: error.message, details: error.details }
      : { code: reason, message: error instanceof Error ? error.message : "Unknown error" });
    return launchError(reason, request);
  }
}

function launchError(reason: string, request: NextRequest) {
  const url = new URL("/launch-error", request.url);
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url, 303);
}
