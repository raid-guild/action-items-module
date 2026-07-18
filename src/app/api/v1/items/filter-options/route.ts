import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { listActionItemFilterOptions } from "@/lib/action-items/service";

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  try {
    await requireActor(request);
    return jsonWithRequestId(await listActionItemFilterOptions(), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
