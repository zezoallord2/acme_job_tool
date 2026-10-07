"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { asAppError, userFacingMessage } from "@/lib/errors";
import { env } from "@/lib/env";
import {
  hashPassword,
  verifyPassword,
  checkPasswordPolicy,
} from "@/lib/password";
import {
  createSession,
  setSessionCookie,
  destroySession,
  clearSessionCookie,
  requestMeta,
  requireSameOrigin,
} from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  ENUMERATION_SAFE_MESSAGE,
  consumeResetToken,
  requestPasswordReset,
} from "@/services/password-reset-service";
import { ensureDataDirs } from "@/lib/storage";
import { logInfo } from "@/lib/logger";

export async function signupAction(
  _prev: unknown,
  formData: FormData,
): Promise<unknown> {
  const meta = await requestMeta();
  try {
    await requireSameOrigin();
    await enforceRateLimit("signup", { ip: meta.ip });

    const email = z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address.")
      .safeParse(formData.get("email"));
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    const fieldErrors: Record<string, string> = {};
    if (!email.success)
      fieldErrors.email = email.error.issues[0]?.message ?? "Invalid email.";
    const policy = checkPasswordPolicy(password, env().PASSWORD_MIN_LENGTH, {
      email: String(formData.get("email") ?? ""),
    });
    if (!policy.ok)
      fieldErrors.password = policy.problems[0] ?? "Weak password.";
    if (!email.success || Object.keys(fieldErrors).length > 0) {
      return {
        ok: false,
        message: "Check the highlighted fields.",
        fieldErrors,
      };
    }
    const emailValue = email.data;

    const existing = await prisma.user.findUnique({
      where: { email: emailValue },
      select: { id: true },
    });
    if (existing) {
      return {
        ok: false,
        message: "An account with that email already exists.",
        fieldErrors: { email: "Already registered." },
      };
    }

    await ensureDataDirs();
    const user = await prisma.user.create({
      data: {
        email: emailValue,
        name: name || emailValue.split("@")[0],
        passwordHash: await hashPassword(password),
        // ACME_BASIC, not LOCAL: `LOCAL` pointed at an Ollama endpoint that is not
        // running on most machines, so every new account silently fell through to
        // Manual Mode and looked broken. New accounts now start on the AI included
        // in their plan, which is the product they signed up for.
        settings: { create: { aiProvider: "ACME_BASIC" } },
        profile: { create: { email: emailValue, firstName: name || null } },
        onboardings: { create: {} },
      },
      select: { id: true },
    });

    const session = await createSession(user.id, meta);
    await setSessionCookie(session.token, session.expiresAt);
    logInfo({ operation: "auth.signup", userId: user.id }, "User registered");
    redirect("/onboarding");
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { ok: false, message: userFacingMessage(asAppError(e)) };
  }
}

export async function loginAction(
  _prev: unknown,
  formData: FormData,
): Promise<unknown> {
  const meta = await requestMeta();
  try {
    await requireSameOrigin();
    await enforceRateLimit("login", { ip: meta.ip });

    const emailRaw = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");
    if (!emailRaw || !password)
      return { ok: false, message: "Enter your email and password." };

    const user = await prisma.user.findUnique({
      where: { email: emailRaw },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        suspendedAt: true,
        deletedAt: true,
      },
    });

    // A fixed-shape dummy hash is verified when the account does not exist, so
    // response time does not reveal whether an email is registered.
    const hash =
      user?.passwordHash ??
      "$argon2id$v=19$m=19456,t=2,p=1$YWFhYWFhYWFhYWFhYWFhYQ$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhY";
    const valid = await verifyPassword(hash, password);

    if (!user || !valid || user.deletedAt || user.suspendedAt) {
      return { ok: false, message: "Email or password is incorrect." };
    }

    const session = await createSession(user.id, meta);
    await setSessionCookie(session.token, session.expiresAt);
    logInfo({ operation: "auth.login", userId: user.id }, "User signed in");
    redirect("/app");
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { ok: false, message: userFacingMessage(asAppError(e)) };
  }
}

export async function logoutAction(): Promise<void> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const token = jar.get("acme_session")?.value;
  if (token) await destroySession(token);
  await clearSessionCookie();
  redirect("/");
}

function isRedirect(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/**
 * Development-only mail catcher. With no SMTP transport configured the reset link
 * is written to data/logs/mail.log instead of being emailed, so password recovery
 * works with zero paid services.
 */
/**
 * Starts a password reset.
 *
 * Returns the same message for every input so the endpoint cannot be used to
 * discover which addresses have accounts. The per-IP rate limit and the
 * service's own timing padding make that harder still.
 */
export async function requestPasswordResetAction(
  _prev: unknown,
  formData: FormData,
): Promise<unknown> {
  const meta = await requestMeta();
  try {
    await requireSameOrigin();
    await enforceRateLimit("passwordReset", { ip: meta.ip });
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    if (!z.string().email().safeParse(email).success) {
      return { ok: false, message: "Enter a valid email address." };
    }

    const result = await requestPasswordReset(email);

    // A development-only convenience. The token is never included in production.
    if (result.developmentLink) {
      return {
        ok: true,
        message: ENUMERATION_SAFE_MESSAGE,
        developmentLink: result.developmentLink,
      };
    }
    return { ok: true, message: ENUMERATION_SAFE_MESSAGE };
  } catch (e) {
    return { ok: false, message: userFacingMessage(asAppError(e)) };
  }
}

/** Completes a password reset. The token is single use and time limited. */
export async function confirmPasswordResetAction(
  _prev: unknown,
  formData: FormData,
): Promise<unknown> {
  const meta = await requestMeta();
  try {
    await requireSameOrigin();
    await enforceRateLimit("passwordResetConfirm", { ip: meta.ip });
    const token = String(formData.get("token") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (password !== confirm) {
      return { ok: false, message: "The two passwords do not match." };
    }

    const result = await consumeResetToken(token, password);
    if (result.ok) {
      return {
        ok: true,
        message:
          "Your password has been changed and every other session was signed out. You can sign in now.",
      };
    }

    const messages: Record<string, string> = {
      INVALID: "This reset link is not valid. Request a new one.",
      USED: "This reset link has already been used. Request a new one.",
      EXPIRED: "This reset link has expired. Request a new one.",
      WEAK_PASSWORD:
        "That password is too weak. Use at least the minimum length and avoid common passwords.",
    };
    return {
      ok: false,
      message: messages[result.reason] ?? "That link cannot be used.",
    };
  } catch (e) {
    return { ok: false, message: userFacingMessage(asAppError(e)) };
  }
}
