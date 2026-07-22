import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/actor";
import { ApiError, errorResponse, jsonWithRequestId } from "@/lib/api/errors";
import { getProjectDashboard } from "@/lib/action-items/service";
import { parseSnapshotProposal } from "@/lib/prism/snapshot";
import { getSnapshotHookStatus } from "@/lib/prism/snapshot-hook";
import { verifySnapshotJob } from "@/lib/prism/snapshot-job";

type Context = { params: Promise<{ projectId: string; jobId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const requestId = randomUUID();
  try {
    const actor = await requireActor(request, { portalOnly: true });
    if (!actor.portalUserId) throw new ApiError(401, "PORTAL_SESSION_REQUIRED", "A Portal session is required.");
    const { projectId, jobId } = await params;
    const job = await verifySnapshotJob(jobId);
    if (job.projectId !== projectId || job.portalUserId !== actor.portalUserId) {
      throw new ApiError(403, "SNAPSHOT_JOB_FORBIDDEN", "This snapshot job belongs to another project or user.");
    }
    const status = await getSnapshotHookStatus({ requestNumber: job.requestNumber, resultUrl: job.resultUrl });
    if (status.status === "queued") return jsonWithRequestId({ status: "queued" }, requestId, { status: 202 });

    const dashboard = await getProjectDashboard(projectId);
    const rawResponse = JSON.stringify(status.result);
    const parsed = parseSnapshotProposal(rawResponse, dashboard.kpis.map((kpi) => kpi.id));
    return jsonWithRequestId({ proposal: parsed.proposal, parseError: parsed.error, rawResponse }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
