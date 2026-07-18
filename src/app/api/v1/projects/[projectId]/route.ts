import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { readJson } from "@/lib/api/body";
import { updateProjectSchema } from "@/lib/action-items/schemas";
import { getProject, updateProject } from "@/lib/action-items/service";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const requestId = randomUUID();
  try {
    await requireActor(request);
    const { projectId } = await params;
    return jsonWithRequestId({ project: await getProject(projectId) }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const requestId = randomUUID();
  try {
    await requireActor(request, { mutation: true });
    const { projectId } = await params;
    const input = updateProjectSchema.parse(await readJson(request));
    return jsonWithRequestId(await updateProject(projectId, input), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
