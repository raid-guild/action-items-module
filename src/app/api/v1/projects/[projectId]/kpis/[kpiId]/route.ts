import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { readJson } from "@/lib/api/body";
import { updateProjectKpiSchema } from "@/lib/action-items/schemas";
import { updateProjectKpi } from "@/lib/action-items/service";

type Context = { params: Promise<{ projectId: string; kpiId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const requestId = randomUUID();
  try {
    await requireActor(request, { mutation: true });
    const { projectId, kpiId } = await params;
    const input = updateProjectKpiSchema.parse(await readJson(request));
    return jsonWithRequestId(await updateProjectKpi(projectId, kpiId, input), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
