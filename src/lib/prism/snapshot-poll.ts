import type { PrismSnapshotProposal } from "@/lib/prism/snapshot";

export type PrismSnapshotResponse = {
  proposal: PrismSnapshotProposal | null;
  parseError: string | null;
  rawResponse: string;
};
export type SnapshotPollResponse = { status: "queued" } | PrismSnapshotResponse;

export async function pollSnapshotJob(
  getStatus: () => Promise<SnapshotPollResponse>,
  options: { timeoutMs?: number; intervalMs?: number; sleep?: (milliseconds: number) => Promise<void> } = {}
): Promise<PrismSnapshotResponse> {
  const timeoutMs = options.timeoutMs ?? 240_000;
  const intervalMs = options.intervalMs ?? 2_000;
  const sleep = options.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let elapsed = 0;
  while (elapsed < timeoutMs) {
    await sleep(intervalMs);
    elapsed += intervalMs;
    const result = await getStatus();
    if (!("status" in result) || result.status !== "queued") return result as PrismSnapshotResponse;
  }
  throw new Error("Prism did not complete the KPI snapshot within four minutes.");
}
