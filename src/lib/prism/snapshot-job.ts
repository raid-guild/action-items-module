import { createHash } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { SnapshotHookJob } from "@/lib/prism/snapshot-hook";

const claimsSchema = z.object({
  projectId: z.string().uuid(),
  portalUserId: z.string().min(1),
  requestNumber: z.number().int().positive(),
  resultUrl: z.string().min(1)
});

export async function issueSnapshotJob(input: SnapshotHookJob & { projectId: string; portalUserId: string }) {
  return new SignJWT(input)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("raidguild-action-items")
    .setAudience("project-kpi-snapshot")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(jobKey());
}

export async function verifySnapshotJob(token: string) {
  try {
    const { payload } = await jwtVerify(token, jobKey(), {
      algorithms: ["HS256"], issuer: "raidguild-action-items", audience: "project-kpi-snapshot"
    });
    return claimsSchema.parse(payload);
  } catch {
    throw new ApiError(400, "INVALID_SNAPSHOT_JOB", "The snapshot job is invalid or expired.");
  }
}

function jobKey() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) throw new ApiError(503, "SNAPSHOT_JOB_NOT_CONFIGURED", "Snapshot job signing is not configured.");
  return createHash("sha256").update(`project-kpi-snapshot:${secret}`).digest();
}
