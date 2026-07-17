import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { readJson } from "@/lib/api/body";
import { searchParamsObject } from "@/lib/api/query";
import { createItemSchema, listItemsQuerySchema } from "@/lib/action-items/schemas";
import { createActionItem, listActionItems } from "@/lib/action-items/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const actor = await requireActor(request);
    const input = listItemsQuerySchema.parse(searchParamsObject(request.nextUrl));
    return jsonWithRequestId(await listActionItems(input, actor), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const actor = await requireActor(request, { mutation: true });
    const input = createItemSchema.parse(await readJson(request));
    const result = await createActionItem(input, actor, request.headers.get("idempotency-key"));
    return jsonWithRequestId(result, requestId, {
      status: result.replayed ? 200 : 201,
      headers: { location: `/api/v1/items/${result.item.id}` }
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
