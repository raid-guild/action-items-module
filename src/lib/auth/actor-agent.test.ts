import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("@/lib/db/client", () => ({ getDb }));

import { AuthError, requireActor } from "@/lib/auth/actor";

afterEach(() => {
  delete process.env.ACTION_ITEMS_AGENT_API_TOKEN;
  delete process.env.ACTION_ITEMS_AGENT_PORTAL_USER_ID;
  getDb.mockReset();
});

describe("agent Portal user mapping", () => {
  it("resolves the bearer agent to its configured local Portal user", async () => {
    process.env.ACTION_ITEMS_AGENT_API_TOKEN = "agent-secret";
    process.env.ACTION_ITEMS_AGENT_PORTAL_USER_ID = "portal-user-13";
    getDb.mockReturnValue(dbReturning([{ id: "local-user-id", portalUserId: "portal-user-13", isActive: true }]));

    await expect(requireActor(agentRequest(), { localUser: true })).resolves.toMatchObject({
      type: "agent",
      id: "agent:prism-action-items",
      localUserId: "local-user-id",
      portalUserId: "portal-user-13"
    });
  });

  it("requires a mapping for agent operations that need a local user", async () => {
    process.env.ACTION_ITEMS_AGENT_API_TOKEN = "agent-secret";

    await expect(requireActor(agentRequest(), { localUser: true })).rejects.toMatchObject({
      status: 403,
      message: "Agent Portal user mapping required."
    });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("does not require a Portal user mapping for ordinary agent operations", async () => {
    process.env.ACTION_ITEMS_AGENT_API_TOKEN = "agent-secret";

    await expect(requireActor(agentRequest(), { mutation: true })).resolves.toMatchObject({
      type: "agent",
      id: "agent:prism-action-items"
    });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects a missing or inactive mapped Portal user", async () => {
    process.env.ACTION_ITEMS_AGENT_API_TOKEN = "agent-secret";
    process.env.ACTION_ITEMS_AGENT_PORTAL_USER_ID = "portal-user-13";
    getDb.mockReturnValue(dbReturning([]));

    await expect(requireActor(agentRequest(), { localUser: true })).rejects.toBeInstanceOf(AuthError);
  });
});

function agentRequest() {
  return new NextRequest("https://action-items.example/api/v1/items", {
    headers: { authorization: "Bearer agent-secret" }
  });
}

function dbReturning(rows: unknown[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => rows })
      })
    })
  };
}
