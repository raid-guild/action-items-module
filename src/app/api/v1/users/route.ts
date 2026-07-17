import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { searchParamsObject } from "@/lib/api/query";
import { listUsersQuerySchema } from "@/lib/action-items/schemas";
import { listAssignableUsers } from "@/lib/action-items/service";

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  try {
    await requireActor(request);
    const input = listUsersQuerySchema.parse(searchParamsObject(request.nextUrl));
    return jsonWithRequestId(await listAssignableUsers(input), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
