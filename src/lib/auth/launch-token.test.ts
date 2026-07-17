import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { verifyPortalLaunchToken } from "@/lib/auth/launch-token";

const secret = "test-secret-long-enough-for-verification";

describe("Portal launch verification", () => {
  beforeEach(() => {
    process.env.MODULE_LAUNCH_SECRET = secret;
    process.env.PORTAL_ISSUER = "https://portal.raidguild.org";
    process.env.MODULE_SLUG = "action-items";
  });

  afterEach(() => {
    delete process.env.MODULE_LAUNCH_SECRET;
    delete process.env.PORTAL_ISSUER;
    delete process.env.MODULE_SLUG;
  });

  it("accepts the expected signed launch and normalizes identity", async () => {
    const token = await new SignJWT({
      typ: "portal_module_launch",
      moduleSlug: "action-items",
      userID: 13,
      profileID: 36,
      name: "Member Name",
      handle: "member",
      roles: ["member"]
    }).setProtectedHeader({ alg: "HS256" })
      .setIssuer("https://portal.raidguild.org")
      .setAudience("action-items")
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(new TextEncoder().encode(secret));

    await expect(verifyPortalLaunchToken(token)).resolves.toMatchObject({
      portalUserId: "13",
      portalProfileId: "36",
      handle: "member"
    });
  });

  it("rejects the wrong audience", async () => {
    const token = await new SignJWT({ typ: "portal_module_launch", moduleSlug: "action-items", userID: 13 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("https://portal.raidguild.org")
      .setAudience("another-module")
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(new TextEncoder().encode(secret));

    await expect(verifyPortalLaunchToken(token)).rejects.toMatchObject({ code: "invalid_aud" });
  });
});
