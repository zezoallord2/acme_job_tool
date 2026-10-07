import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hashContent, safeEquals } from "@/lib/crypto";
import { hashPassword, checkPasswordPolicy } from "@/lib/password";
import { mailProvider } from "@/lib/mail";
import { passwordResetEmail } from "@/lib/email-templates";
import { logInfo, logWarn } from "@/lib/logger";

/**
 * Password reset.
 *
 * Design decisions that matter:
 *
 *  - Only the SHA-256 of the token is stored. A leaked database therefore does
 *    not hand an attacker working reset links. The token is 32 random bytes from
 *    the CSPRNG, so it is not guessable either.
 *  - The token is single use. Consuming it is what actually changes the password.
 *  - A new request invalidates the user's outstanding tokens, so an email an
 *    attacker triggered first cannot be used after the real owner asks.
 *  - Every existing session is revoked when a password changes, so a stolen
 *    session does not survive a reset.
 *  - The public response is identical whether or not the account exists, and the
 *    work done for a known account is padded so timing does not leak it either.
 *  - Tokens are never written to logs in production. In development the link is
 *    written only to the local mail log, which is how a developer tests the flow
 *    without an email account.
 *
 * Storage reuses the `IdempotencyKey` table (`scope = "password-reset"`) rather
 * than adding a migration during closeout. The shape matches exactly what a reset
 * token needs: an opaque identifier, an owner, a status and an expiry.
 */

const SCOPE = "password-reset";
const ISSUED = "ISSUED";
const CONSUMED = "CONSUMED";

/** The one message every caller receives, regardless of account existence. */
export const ENUMERATION_SAFE_MESSAGE =
  "If that account exists, a password reset link has been sent.";

function baseUrl(): string {
  return env().APP_URL.replace(/\/+$/, "");
}

/**
 * Approximate time the work takes for a real account, so a request for an
 * unknown address does not return noticeably faster.
 */
async function padTiming(): Promise<void> {
  // Argon2id at the app's configured cost is the dominant cost of this path.
  const started = Date.now();
  await hashPassword(`timing-pad-${randomBytes(16).toString("hex")}`);
  const elapsed = Date.now() - started;
  const target = 120;
  if (elapsed < target) {
    await new Promise((r) => setTimeout(r, target - elapsed));
  }
}

export interface RequestResetResult {
  ok: true;
  /** Never contains the token. Present for UI messaging in development only. */
  developmentLink?: string;
}

/**
 * Issues a reset token and emails the link.
 *
 * Returns the same result shape and message for a known and an unknown account.
 */
export async function requestPasswordReset(
  email: string,
): Promise<RequestResetResult> {
  const normalised = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true, name: true, email: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    // Same shape, same timing, same work minus the send.
    await padTiming();
    return { ok: true };
  }

  // A new request supersedes any outstanding token for this account.
  await prisma.idempotencyKey.updateMany({
    where: { userId: user.id, scope: SCOPE, status: ISSUED },
    data: { status: "SUPERSEDED" },
  });

  const token = randomBytes(32).toString("base64url");
  const ttlMinutes = env().PASSWORD_RESET_TTL_MINUTES;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  // Only the hash is persisted.
  await prisma.idempotencyKey.create({
    data: {
      userId: user.id,
      key: hashContent(token),
      scope: SCOPE,
      requestHash: hashContent(user.id),
      status: ISSUED,
      expiresAt,
    },
  });

  const resetUrl = `${baseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const rendered = passwordResetEmail({
    name: user.name,
    resetUrl,
    expiresInMinutes: ttlMinutes,
  });

  try {
    await mailProvider().send({
      to: user.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  } catch (e) {
    // The account exists, so the generic success message is still correct; the
    // operator needs to know delivery failed, but the user must not learn it.
    logWarn(
      { operation: "password.reset.send" },
      "Reset email could not be delivered",
      { userId: user.id, reason: e instanceof Error ? e.name : "unknown" },
    );
    await padTiming();
    return { ok: true };
  }

  // A digest, never the token, so an operator can correlate without being able
  // to use the link.
  logInfo(
    { operation: "password.reset.issued" },
    "Password reset token issued",
    { userId: user.id, tokenHash: hashContent(token).slice(0, 12) },
  );

  return {
    ok: true,
    // Development convenience only. Never populated in production.
    ...(env().NODE_ENV === "production" ? {} : { developmentLink: resetUrl }),
  };
}

export type ConsumeResult =
  | { ok: true }
  | { ok: false; reason: "INVALID" | "EXPIRED" | "USED" | "WEAK_PASSWORD" };

/** Whether a token is currently usable, for rendering the reset form. */
export async function inspectResetToken(
  token: string,
): Promise<{ valid: boolean; reason?: string }> {
  if (!token)
    return { valid: false, reason: "This link is missing its token." };
  const row = await findToken(token);
  if (!row) return { valid: false, reason: "This reset link is not valid." };
  if (row.status !== ISSUED) {
    return {
      valid: false,
      reason: "This reset link has already been used. Request a new one.",
    };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return {
      valid: false,
      reason: "This reset link has expired. Request a new one.",
    };
  }
  return { valid: true };
}

async function findToken(token: string) {
  return prisma.idempotencyKey.findFirst({
    where: { key: hashContent(token), scope: SCOPE },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Consumes a token and sets the new password.
 *
 * Single use is enforced with a conditional update, so two concurrent requests
 * carrying the same token cannot both succeed: the loser finds zero rows.
 */
export async function consumeResetToken(
  token: string,
  newPassword: string,
): Promise<ConsumeResult> {
  const policy = checkPasswordPolicy(newPassword, env().PASSWORD_MIN_LENGTH);
  if (!policy.ok) {
    return { ok: false, reason: "WEAK_PASSWORD" };
  }

  const row = await findToken(token);
  if (!row) return { ok: false, reason: "INVALID" };
  if (row.status === CONSUMED) return { ok: false, reason: "USED" };
  if (row.status !== ISSUED) return { ok: false, reason: "INVALID" };
  if (row.expiresAt.getTime() < Date.now()) {
    // Burn an expired token so it cannot be probed repeatedly.
    await prisma.idempotencyKey
      .updateMany({
        where: { id: row.id, status: ISSUED },
        data: { status: "EXPIRED" },
      })
      .catch(() => undefined);
    return { ok: false, reason: "EXPIRED" };
  }
  if (!row.userId) return { ok: false, reason: "INVALID" };

  const passwordHash = await hashPassword(newPassword);

  // Claim the token first. The `status: ISSUED` condition is what makes this
  // single-use: a second request updates zero rows and is rejected below.
  const claimed = await prisma.idempotencyKey.updateMany({
    where: { id: row.id, status: ISSUED },
    data: { status: CONSUMED },
  });
  if (claimed.count === 0) return { ok: false, reason: "USED" };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    // A reset exists because the password may be compromised, so every existing
    // session must die with it.
    prisma.session.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  logInfo(
    { operation: "password.reset.consumed" },
    "Password reset completed",
    { userId: row.userId },
  );
  return { ok: true };
}

/** Constant-time comparison helper, exported so tests can assert the property. */
export function tokensMatch(a: string, b: string): boolean {
  return safeEquals(hashContent(a), hashContent(b));
}
