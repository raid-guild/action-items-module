import { describe, expect, it, vi } from "vitest";
import { pollSnapshotJob, type PrismSnapshotResponse } from "@/lib/prism/snapshot-poll";

const completed: PrismSnapshotResponse = { proposal: null, parseError: "test", rawResponse: "{}" };

describe("snapshot job polling", () => {
  it("continues through multiple queued responses", async () => {
    const getStatus = vi.fn()
      .mockResolvedValueOnce({ status: "queued" })
      .mockResolvedValueOnce({ status: "queued" })
      .mockResolvedValueOnce(completed);
    await expect(pollSnapshotJob(getStatus, { timeoutMs: 10, intervalMs: 1, sleep: async () => {} })).resolves.toBe(completed);
    expect(getStatus).toHaveBeenCalledTimes(3);
  });

  it("stops after the polling timeout", async () => {
    const getStatus = vi.fn().mockResolvedValue({ status: "queued" });
    await expect(pollSnapshotJob(getStatus, { timeoutMs: 3, intervalMs: 1, sleep: async () => {} })).rejects.toThrow(/3 milliseconds/);
    expect(getStatus).toHaveBeenCalledTimes(3);
  });

  it("caps the final sleep at the remaining timeout", async () => {
    const delays: number[] = [];
    const getStatus = vi.fn().mockResolvedValue({ status: "queued" });
    await expect(pollSnapshotJob(getStatus, {
      timeoutMs: 3,
      intervalMs: 10,
      sleep: async (delay) => { delays.push(delay); },
    })).rejects.toThrow(/3 milliseconds/);
    expect(delays).toEqual([3]);
    expect(getStatus).toHaveBeenCalledOnce();
  });
});
