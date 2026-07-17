import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { searchParamsObject } from "@/lib/api/query";
import { listHistoryQuerySchema } from "@/lib/action-items/schemas";
import { listActionItemHistory } from "@/lib/action-items/service";

type Context = { params: Promise<{ itemId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const requestId = randomUUID();
  try {
    await requireActor(request);
    const { itemId } = await params;
    const input = listHistoryQuerySchema.parse(searchParamsObject(request.nextUrl));
    return jsonWithRequestId(await listActionItemHistory(itemId, input), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
