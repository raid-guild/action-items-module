import { describe, expect, it } from "vitest";
import { createItemSchema, listItemsQuerySchema, updateItemSchema } from "@/lib/action-items/schemas";

describe("action item schemas", () => {
  it("applies create defaults without imposing a priority or effort maximum", () => {
    expect(createItemSchema.parse({ title: "  Ship it  ", priority: 1000, effort: 5000 })).toEqual({
      title: "Ship it",
      description: "",
      status: "open",
      priority: 1000,
      effort: 5000
    });
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
    expect(() => listItemsQuerySchema.parse({ limit: "101" })).toThrow();
  });
});
