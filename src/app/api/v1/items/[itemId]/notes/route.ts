import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { readJson } from "@/lib/api/body";
import { searchParamsObject } from "@/lib/api/query";
import { createItemNoteSchema, listItemNotesQuerySchema } from "@/lib/action-items/schemas";
import { createActionItemNote, listActionItemNotes } from "@/lib/action-items/service";

type Context = { params: Promise<{ itemId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const requestId = randomUUID();
  try {
    await requireActor(request);
    const { itemId } = await params;
    const input = listItemNotesQuerySchema.parse(searchParamsObject(request.nextUrl));
    return jsonWithRequestId(await listActionItemNotes(itemId, input), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  const requestId = randomUUID();
  try {
    const actor = await requireActor(request, { mutation: true, localUser: true });
    const { itemId } = await params;
    const input = createItemNoteSchema.parse(await readJson(request));
    return jsonWithRequestId(await createActionItemNote(itemId, input.text, actor), requestId, { status: 201 });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
