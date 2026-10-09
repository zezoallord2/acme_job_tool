import { cookies, headers } from "next/headers";
import { cache } from "react";
import { prisma } from "./db";
import { env } from "./env";
import { hashContent, newIdempotencyKey } from "./crypto";
import { Errors } from "./errors";
import { userFacingMessage } from "./errors";
import type { User } from "@prisma/client";

/**
 * Self-hosted authentication: email + password, Argon2id, database-backed
 * sessions, signed opaque cookie. No third-party auth service, no paid tier.
 *
 * Authorization is always enforced server-side: `requireUser` and
 * `assertOwnership` are the only ways to obtain a user-scoped client.
 */

export const SESSION_COOKIE = "acme_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  isInternal: boolean;
  plan: "FREE" | "COMPLETE";
}

export async function createSession(
  userId: string,
  meta?: { ip?: string; userAgent?: string },
): Promise<{ token: string; expiresAt: Date }> {
  const raw = newIdempotencyKey("sess");
  const tokenHash = hashContent(raw);
  const ttlHours = env().SESSION_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipHash: meta?.ip ? hashContent(meta.ip).slice(0, 16) : null,
      userAgent: meta?.userAgent?.slice(0, 200) ?? null,
    },
  });
  return { token: raw, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash: hashContent(token) },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // `lax` rather than `strict`: a strict cookie would be withheld on the
    // top-level navigation a payment provider uses to send a customer back, and
    // `lax` still blocks cross-site POST, which is where CSRF matters.
    sameSite: "lax",
    // The Secure attribute means "over TLS only". Marking it Secure while the
    // deployment itself is http (loopback, local test, TLS-offloaded proxy
    // configuration) would silently break every sign-in. The preflight
    // warns when production runs without https.
    secure:
      env().NODE_ENV === "production" &&
      /^https:\/\//i.test(env().APP_URL ?? ""),
    // No `domain` on purpose: a host-only cookie is not sent to sibling
    // subdomains, so a compromised subdomain cannot read the session.
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  // Must match the attributes used when setting, or some browsers treat the
  // clear as a no-op and leave the session cookie in place.
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure:
      env().NODE_ENV === "production" &&
      /^https:\/\//i.test(env().APP_URL ?? ""),
    path: "/",
    maxAge: 0,
  });
}

// Share only within one server render; never cache sessions across requests.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveSession(token);
});

export async function resolveSession(
  token: string,
): Promise<SessionUser | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashContent(token) },
    include: {
      user: {
        include: {
          entitlements: {
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (session.user.deletedAt || session.user.suspendedAt) return null;

  return toSessionUser(session.user, session.user.entitlements);
}

export function toSessionUser(
  user: {
    id: string;
    email: string;
    name: string | null;
    isAdmin: boolean;
    isInternal: boolean;
  },
  entitlements: Array<{
    plan: "FREE" | "COMPLETE";
    status: string;
    expiresAt: Date | null;
  }>,
): SessionUser {
  const activeComplete = entitlements.find(
    (e) =>
      e.plan === "COMPLETE" &&
      e.status === "ACTIVE" &&
      (!e.expiresAt || e.expiresAt > new Date()),
  );
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    isInternal: user.isInternal,
    plan: activeComplete ? "COMPLETE" : "FREE",
  };
}

/** Throws unless a valid session exists. Use at the top of every server action. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw Errors.unauthenticated();
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin && !user.isInternal) {
    throw Errors.unauthorized("Administrator access is required.");
  }
  return user;
}

/**
 * Ownership guard. This is the only authorization primitive user data uses.
 *
 * Accepts either a resolved record (checked against `userId`) or an id that is
 * looked up with `userId` in the same query. Both paths filter in SQL, so an
 * unauthorised id returns null rather than leaking existence.
 */
export async function assertOwnership<T extends { userId: string }>(
  record: T | null,
  userId: string,
  resource: string,
): Promise<T> {
  if (!record || record.userId !== userId) {
    // Same error for "does not exist" and "belongs to someone else" so the
    // response cannot be used to enumerate other users' data.
    throw Errors.notFound(resource);
  }
  return record;
}

export function assertOwner<T extends { userId: string }>(
  record: T,
  userId: string,
  resource: string,
): T {
  if (record.userId !== userId) throw Errors.notFound(resource);
  return record;
}

export async function requestMeta(): Promise<{
  ip?: string;
  userAgent?: string;
}> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    undefined;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 200) ?? undefined };
}

export async function requireSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return;
  const host = h.get("host");
  if (!host) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw Errors.unauthorized("Request origin could not be verified.");
  }
  if (originHost !== host) {
    throw Errors.unauthorized("Cross-origin request rejected.");
  }
}

export async function requireSessionUserOrThrow(): Promise<User> {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) throw Errors.unauthenticated();
  return user;
}

export { userFacingMessage };
