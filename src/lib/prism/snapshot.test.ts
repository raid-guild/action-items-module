import { describe, expect, it } from "vitest";
import { buildSnapshotHookInput, parseSnapshotProposal } from "@/lib/prism/snapshot";
import type { ProjectDashboard } from "@/lib/action-items/service";

const first = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";

describe("Prism KPI snapshot proposal", () => {
  it("preserves exact multi-site measurement configuration in the hook input", () => {
    const measurementConfig = {
      provider: "plausible" as const,
      siteIds: ["fireside.raidguild.org", "portal.raidguild.org", "raidguild.ai", "raidguild.org"],
      metric: "visits" as const,
      aggregation: "sum" as const,
      dateRange: { type: "rolling" as const, days: 14 },
      campaignFilter: { property: "visit:utm_campaign" as const, value: "summer-brigade" },
      sharedGoalName: null,
      siteGoalOverrides: [],
      requireCompleteCoverage: true
    };
    const dashboard = {
      project: { id: first, title: "Summer Brigade", description: "", intent: "Grow", portalLinkUrl: null, status: "open" },
      kpis: [{ id: second, name: "Attributed visits", description: "", unit: "number", source: "Plausible", sourceUrl: null, measurementConfig, baselineValue: 0, targetValue: 100, weight: 7, currentValue: null, progress: null, snapshots: [] }],
      health: { score: null, change: null, history: [] },
      delivery: { total: 0, completed: 0, active: 0, open: 0, cancelled: 0, completionRate: null }
    } satisfies ProjectDashboard;
    expect(buildSnapshotHookInput(dashboard).projectKpisData.kpis[0].measurementConfig).toEqual(measurementConfig);
  });

  it("accepts a complete structured response", () => {
    const result = parseSnapshotProposal(JSON.stringify({
      capturedAt: "2026-07-22T17:00:00.000Z",
      metrics: [{ kpiId: first, value: 212, source: "Plausible", sourceUrl: null, evidence: "Visitors during the last 14 days", confidence: "high" }],
      unavailable: [{ kpiId: second, reason: "LinkedIn is not connected" }]
    }), [first, second]);
    expect(result.proposal?.metrics[0].value).toBe(212);
  });

  it("rejects prose, malformed shapes, and missing KPIs", () => {
    expect(parseSnapshotProposal("I found 212 visitors.", [first]).proposal).toBeNull();
    expect(parseSnapshotProposal(JSON.stringify({ capturedAt: "now", metrics: [], unavailable: [] }), [first]).proposal).toBeNull();
    expect(parseSnapshotProposal(JSON.stringify({ capturedAt: "2026-07-22T17:00:00.000Z", metrics: [], unavailable: [] }), [first]).error).toMatch(/every configured KPI/);
  });
});
