import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { readJson } from "@/lib/api/body";
import { updateItemSchema } from "@/lib/action-items/schemas";
import { getActionItem, listActionItemHistory, updateActionItem } from "@/lib/action-items/service";

type Context = { params: Promise<{ itemId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const requestId = randomUUID();
  try {
    await requireActor(request);
    const { itemId } = await params;
    const [item, history] = await Promise.all([
      getActionItem(itemId),
      listActionItemHistory(itemId, { limit: 20 })
    ]);
    return jsonWithRequestId({ item, history }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const requestId = randomUUID();
  try {
    const actor = await requireActor(request, { mutation: true });
    const { itemId } = await params;
    const input = updateItemSchema.parse(await readJson(request));
    return jsonWithRequestId(await updateActionItem(itemId, input, actor), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
