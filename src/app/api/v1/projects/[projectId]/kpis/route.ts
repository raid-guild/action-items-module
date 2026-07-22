import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { readJson } from "@/lib/api/body";
import { createProjectKpiSchema } from "@/lib/action-items/schemas";
import { createProjectKpi } from "@/lib/action-items/service";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const requestId = randomUUID();
  try {
    await requireActor(request, { mutation: true });
    const { projectId } = await params;
    const input = createProjectKpiSchema.parse(await readJson(request));
    return jsonWithRequestId(await createProjectKpi(projectId, input), requestId, { status: 201 });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
