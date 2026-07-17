import { getSession, portalModulesUrl } from "@/lib/auth/session";

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
    portalUrl: portalModulesUrl()
  });
}

export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return new Response(null, { status: 204 });
}
