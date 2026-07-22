import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { readJson } from "@/lib/api/body";
import { createProjectKpiSnapshotSchema } from "@/lib/action-items/schemas";
import { createProjectKpiSnapshot } from "@/lib/action-items/service";

type Context = { params: Promise<{ projectId: string; kpiId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const requestId = randomUUID();
  try {
    await requireActor(request, { mutation: true });
    const { projectId, kpiId } = await params;
    const input = createProjectKpiSnapshotSchema.parse(await readJson(request));
    return jsonWithRequestId(await createProjectKpiSnapshot(projectId, kpiId, input), requestId, { status: 201 });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
