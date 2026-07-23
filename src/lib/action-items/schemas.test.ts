import { describe, expect, it } from "vitest";
import {
  createItemNoteSchema, createItemSchema, createProjectKpiSchema, createProjectKpiSnapshotSchema, createProjectSchema, listItemsQuerySchema, plausibleMeasurementConfigSchema, updateItemSchema, updateProjectSchema
} from "@/lib/action-items/schemas";

describe("action item schemas", () => {
  it("applies create defaults without imposing a priority or effort maximum", () => {
    expect(createItemSchema.parse({ title: "  Ship it  ", priority: 1000, effort: 5000 })).toEqual({
      title: "Ship it",
      description: "",
      budget: "",
      status: "open",
      priority: 1000,
      effort: 5000
    });
  });

  it("validates KPI targets and snapshot values", () => {
    expect(createProjectKpiSchema.parse({ name: "Website clicks", baselineValue: 100, targetValue: 500 })).toMatchObject({
      name: "Website clicks", source: "manual", unit: "number", weight: 1
    });
    expect(() => createProjectKpiSchema.parse({ name: "Clicks", baselineValue: 100, targetValue: 100 })).toThrow();
    expect(createProjectKpiSnapshotSchema.parse({ value: 212 })).toEqual({ value: 212, note: "" });
  });

  it("validates multi-site Plausible measurement configuration", () => {
    const config = plausibleMeasurementConfigSchema.parse({
      provider: "plausible",
      siteIds: ["fireside.raidguild.org", "portal.raidguild.org", "raidguild.ai", "raidguild.org"],
      metric: "visits",
      aggregation: "sum",
      dateRange: { type: "rolling", days: 14 },
      campaignFilter: { property: "visit:utm_campaign", value: "summer-brigade" },
      sharedGoalName: null,
      siteGoalOverrides: [],
      requireCompleteCoverage: true
    });
    expect(config.siteIds).toHaveLength(4);
    expect(plausibleMeasurementConfigSchema.parse({ ...config, campaignFilter: null }).campaignFilter).toBeNull();
    expect(() => plausibleMeasurementConfigSchema.parse({ ...config, siteIds: ["raidguild.org", "raidguild.org"] })).toThrow();
    expect(() => plausibleMeasurementConfigSchema.parse({ ...config, dateRange: { type: "fixed", start: "2026-08-01", end: "2026-07-01" } })).toThrow();
  });

  it("rejects zero and negative priority or effort", () => {
    expect(() => createItemSchema.parse({ title: "No", priority: 0 })).toThrow();
    expect(() => createItemSchema.parse({ title: "No", effort: -1 })).toThrow();
  });

  it("requires an effective field alongside an update version", () => {
    expect(() => updateItemSchema.parse({ version: 1 })).toThrow();
    expect(updateItemSchema.parse({ version: 2, status: "completed" })).toEqual({ version: 2, status: "completed" });
  });

  it("coerces bounded list limits", () => {
    expect(listItemsQuerySchema.parse({ limit: "100" }).limit).toBe(100);
    expect(listItemsQuerySchema.parse({ priorities: "1,2", projectIds: "00000000-0000-4000-8000-000000000001", projectAssignment: "unassigned" })).toMatchObject({
      priorities: "1,2",
      projectIds: "00000000-0000-4000-8000-000000000001",
      projectAssignment: "unassigned"
    });
    expect(() => listItemsQuerySchema.parse({ projectAssignment: "assigned" })).toThrow();
    expect(() => listItemsQuerySchema.parse({ limit: "101" })).toThrow();
  });

  it("validates projects and their open/closed statuses", () => {
    expect(createProjectSchema.parse({ title: "  Portal refresh  ", portalLinkUrl: "https://portal.raidguild.org/projects/refresh" })).toEqual({
      title: "Portal refresh",
      description: "",
      intent: "",
      portalLinkUrl: "https://portal.raidguild.org/projects/refresh",
      status: "open"
    });
    expect(() => createProjectSchema.parse({ title: "Nope", status: "active" })).toThrow();
    expect(updateProjectSchema.parse({ status: "closed" })).toEqual({ status: "closed" });
    expect(() => updateProjectSchema.parse({})).toThrow();
  });

  it("trims notes and rejects empty note text", () => {
    expect(createItemNoteSchema.parse({ text: "  Follow up with the steward.  " })).toEqual({ text: "Follow up with the steward." });
    expect(() => createItemNoteSchema.parse({ text: "   " })).toThrow();
  });
});
