import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { getProjectDashboard } from "@/lib/action-items/service";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const requestId = randomUUID();
  try {
    await requireActor(request);
    const { projectId } = await params;
    return jsonWithRequestId({ dashboard: await getProjectDashboard(projectId) }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
