import { createHmac, timingSafeEqual } from "node:crypto";
import { Errors } from "@/lib/errors";
import { env } from "@/lib/env";
import type { BillingProviderName } from "@prisma/client";

/**
 * Billing identity linking.
 *
 * The problem this solves: a payment platform knows a user by their own id, not
 * by our email. When a purchase webhook arrives there is no way to tell which
 * local account it belongs to, so the entitlement cannot be granted and the
 * customer paid for nothing.
 *
 * The flow is deliberately narrow. Acme Jobs never asks the payment platform for
 * anything at signup. Instead:
 *
 *  1. The user buys a plan through the platform.
 *  2. The platform redirects back with a signed identifier.
 *  3. The user is asked to sign in (or sign up) *while holding that link*.
 *  4. The link is exchanged, server-side, for a local `UserIntegration` row.
 *
 * Because the signed token can only be minted by our own server using
 * `BILLING_LINK_SECRET`, a visitor cannot forge one to claim someone else's
 * purchase, and a link cannot be replayed onto a different account.
 */

const LINK_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function secret(): string {
  const value = env().BILLING_LINK_SECRET;
  if (!value || value.length < 32) {
    throw Errors.configuration(
      "BILLING_LINK_SECRET must be set to at least 32 characters for billing to work.",
    );
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export interface BillingLinkClaims {
  provider: BillingProviderName;
  externalUserId: string;
  /** Present when the platform supplied an email; used only as a cross-check. */
  email?: string | null;
  /** Unix ms. Absent for a non-expiring link. */
  expiresAt?: number;
}

/** Mints a link the user can follow back to us. Only our server can do this. */
export function createBillingLinkToken(claims: BillingLinkClaims): string {
  const body: BillingLinkClaims = {
    ...claims,
    expiresAt: claims.expiresAt ?? Date.now() + LINK_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(body), "utf8").toString(
    "base64url",
  );
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Verifies a link token. Returns null for anything forged, tampered with,
 * expired, or malformed. Never throws, so a bad link cannot 500 the callback.
 */
export function verifyBillingLinkToken(
  token: string,
  expectedProvider?: BillingProviderName,
): BillingLinkClaims | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const encoded = token.slice(0, dot);
  const provided = token.slice(dot + 1);

  let expected: string;
  try {
    expected = sign(encoded);
  } catch {
    // No secret configured: linking is not available rather than insecure.
    return null;
  }

  // Constant-time compare, and length-checked first so timingSafeEqual cannot throw.
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return null;
  }

  let claims: BillingLinkClaims;
  try {
    claims = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as BillingLinkClaims;
  } catch {
    return null;
  }

  if (!claims.externalUserId || !claims.provider) return null;
  if (expectedProvider && claims.provider !== expectedProvider) return null;
  if (typeof claims.expiresAt === "number" && claims.expiresAt < Date.now()) {
    return null;
  }
  return claims;
}
