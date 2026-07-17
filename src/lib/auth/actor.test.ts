import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { assertSameOrigin, AuthError } from "@/lib/auth/actor";

const publicOrigin = "https://action-items-module-production.up.railway.app";

afterEach(() => {
  delete process.env.APP_ORIGIN;
});

describe("same-origin validation behind Railway", () => {
  it("uses APP_ORIGIN instead of the internal request host", () => {
    process.env.APP_ORIGIN = publicOrigin;
    const request = mutationRequest({ origin: publicOrigin });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects an origin that differs from APP_ORIGIN", () => {
    process.env.APP_ORIGIN = publicOrigin;
    const request = mutationRequest({ origin: "https://attacker.example" });
    expect(() => assertSameOrigin(request)).toThrow(AuthError);
  });

  it("falls back to the first forwarded host and protocol", () => {
    const request = mutationRequest({
      origin: publicOrigin,
      "x-forwarded-host": "action-items-module-production.up.railway.app, 0.0.0.0:8080",
      "x-forwarded-proto": "https, http"
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });
});

function mutationRequest(headers: Record<string, string>) {
  return new NextRequest("http://0.0.0.0:8080/api/assistant/what-do-i-do", {
    method: "POST",
    headers
  });
}
