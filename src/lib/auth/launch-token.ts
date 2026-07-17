import { decodeJwt, errors as joseErrors, jwtVerify } from "jose";

export interface PortalLaunchClaims {
  portalUserId: string;
  portalProfileId: string | null;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  roles: string[];
}

export class LaunchTokenError extends Error {
  constructor(message: string, readonly code: string, readonly details: Record<string, unknown> = {}) {
    super(message);
    this.name = "LaunchTokenError";
  }
}

export async function verifyPortalLaunchToken(token: string): Promise<PortalLaunchClaims> {
  const secret = requiredEnv("MODULE_LAUNCH_SECRET");
  const issuer = requiredEnv("PORTAL_ISSUER");
  const moduleSlug = process.env.MODULE_SLUG?.trim() || "action-items";
  const summary = decodeSummary(token);

  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
  try {
    ({ payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      issuer,
      audience: moduleSlug
    }));
  } catch (error) {
    throw new LaunchTokenError("Portal launch token verification failed.", jwtErrorCode(error), summary);
  }

  if (payload.typ !== "portal_module_launch") {
    throw new LaunchTokenError("Portal launch token has an invalid type.", "invalid_typ");
  }
  if (payload.moduleSlug !== moduleSlug) {
    throw new LaunchTokenError("Portal launch token has an invalid module.", "invalid_module_slug");
  }
  if (typeof payload.iat !== "number" || payload.iat > Math.floor(Date.now() / 1000) + 60) {
    throw new LaunchTokenError("Portal launch token has an invalid issued-at time.", "invalid_iat");
  }
  if (typeof payload.exp !== "number") {
    throw new LaunchTokenError("Portal launch token is missing an expiration.", "missing_exp");
  }

  const portalUserId = stringClaim(payload.userID) ?? stringClaim(payload.userId);
  if (!portalUserId) {
    throw new LaunchTokenError("Portal launch token is missing userID.", "missing_user_id");
  }

  return {
    portalUserId,
    portalProfileId: stringClaim(payload.profileID) ?? stringClaim(payload.profileId) ?? null,
    name: stringClaim(payload.name) ?? null,
    handle: stringClaim(payload.handle) ?? null,
    avatarUrl: stringClaim(payload.picture) ?? stringClaim(payload.avatarURL) ?? null,
    roles: Array.isArray(payload.roles) ? payload.roles.filter((role): role is string => typeof role === "string") : []
  };
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new LaunchTokenError(`${name} is not configured.`, `missing_${name.toLowerCase()}`);
  return value;
}

function stringClaim(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function decodeSummary(token: string) {
  try {
    const payload = decodeJwt(token);
    return { iss: payload.iss, aud: payload.aud, typ: payload.typ, moduleSlug: payload.moduleSlug, exp: payload.exp };
  } catch {
    return { malformed: true };
  }
}

function jwtErrorCode(error: unknown) {
  if (error instanceof joseErrors.JWTExpired) return "expired";
  if (error instanceof joseErrors.JWTClaimValidationFailed) return `invalid_${error.claim}`;
  if (error instanceof joseErrors.JWSSignatureVerificationFailed) return "invalid_signature";
  return "invalid_jwt";
}
