import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { ApiError, errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { getProjectDashboard } from "@/lib/action-items/service";
import { buildSnapshotHookInput } from "@/lib/prism/snapshot";
import { triggerSnapshotHook } from "@/lib/prism/snapshot-hook";
import { issueSnapshotJob } from "@/lib/prism/snapshot-job";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const requestId = randomUUID();
  try {
    const actor = await requireActor(request, { portalOnly: true, mutation: true });
    if (!actor.portalUserId) throw new ApiError(401, "PORTAL_SESSION_REQUIRED", "A Portal session is required.");
    const { projectId } = await params;
    const dashboard = await getProjectDashboard(projectId);
    if (!dashboard.kpis.length) throw new ApiError(422, "PROJECT_KPIS_REQUIRED", "Add at least one KPI before asking Prism for a snapshot.");

    const prismJob = await triggerSnapshotHook(buildSnapshotHookInput(dashboard));
    const jobId = await issueSnapshotJob({ ...prismJob, projectId, portalUserId: actor.portalUserId });
    return jsonWithRequestId({ status: "queued", jobId }, requestId, { status: 202 });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
