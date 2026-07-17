import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  portalUserId?: string;
  portalProfileId?: string | null;
  name?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
  roles?: string[];
  prismSessionId?: string;
}

function options(): SessionOptions {
  const password = process.env.SESSION_SECRET ?? "development-only-secret-32-characters";
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required in production.");
  }
  return {
    cookieName: "raidguild-action-items",
    password,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/"
    }
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), options());
}

export function portalModulesUrl() {
  return process.env.PORTAL_MODULES_URL?.trim() || "https://portal.raidguild.org/modules";
}
