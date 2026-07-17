import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true, service: "action-items", database: "connected" });
  } catch (error) {
    return Response.json({
      ok: false,
      service: "action-items",
      database: "unavailable",
      ...(process.env.NODE_ENV === "production" ? {} : { error: error instanceof Error ? error.message : "Unknown database error" })
    }, { status: 503 });
  }
}
