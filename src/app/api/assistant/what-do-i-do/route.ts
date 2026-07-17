import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { getSession } from "@/lib/auth/session";
import { ApiError, errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { listActionItems } from "@/lib/action-items/service";
import { createPrismSession, sendPrismMessage } from "@/lib/prism/client";
import { buildGuidancePrompt } from "@/lib/prism/prompt";

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const actor = await requireActor(request, { portalOnly: true, mutation: true });
    if (!actor.portalUserId) throw new ApiError(401, "PORTAL_SESSION_REQUIRED", "A Portal session is required.");

    let selection = await listActionItems({
      status: "open,active",
      assignedTo: "me",
      limit: 5
    }, actor);
    let selectionKind: "assigned" | "high-priority" | "none" = "assigned";
    if (!selection.items.length) {
      selection = await listActionItems({ status: "open,active", limit: 3 }, actor);
      selectionKind = selection.items.length ? "high-priority" : "none";
    }

    const externalUserId = `portal-user:${actor.portalUserId}`;
    const session = await getSession();
    let prismSessionId = session.prismSessionId;
    if (!prismSessionId) {
      prismSessionId = await createPrismSession(externalUserId);
      session.prismSessionId = prismSessionId;
      await session.save();
    }

    const prompt = buildGuidancePrompt(selectionKind, selection.items);
    let guidance: string;
    try {
      guidance = await sendPrismMessage(prismSessionId, externalUserId, prompt);
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "PRISM_SESSION_NOT_FOUND") throw error;
      prismSessionId = await createPrismSession(externalUserId);
      session.prismSessionId = prismSessionId;
      await session.save();
      guidance = await sendPrismMessage(prismSessionId, externalUserId, prompt);
    }

    return jsonWithRequestId({ guidance, selection: selectionKind }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
