import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { readJson } from "@/lib/api/body";
import { searchParamsObject } from "@/lib/api/query";
import { createProjectSchema, listProjectsQuerySchema } from "@/lib/action-items/schemas";
import { createProject, listProjects } from "@/lib/action-items/service";

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  try {
    await requireActor(request);
    const input = listProjectsQuerySchema.parse(searchParamsObject(request.nextUrl));
    return jsonWithRequestId(await listProjects(input), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  try {
    await requireActor(request, { mutation: true });
    const input = createProjectSchema.parse(await readJson(request));
    return jsonWithRequestId(await createProject(input), requestId, { status: 201 });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
