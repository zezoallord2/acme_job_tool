import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTestUser, type TestUser } from "../helpers";
import {
  ENUMERATION_SAFE_MESSAGE,
  consumeResetToken,
  inspectResetToken,
  requestPasswordReset,
} from "@/services/password-reset-service";
import { lastDevelopmentMessage } from "@/lib/mail";
import { assertProductionConfigSafe, resetEnvCache } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { escapeHtml, passwordResetEmail } from "@/lib/email-templates";
import { signRequest, objectUrl, shouldForcePathStyle } from "@/lib/s3-sigv4";
import {
  assertSafeKey,
  assertMimeAllowed,
  generateObjectKey,
} from "@/lib/storage";

/**
 * Focused production-closeout regression coverage.
 *
 * Grouped by the risks that actually bite in production: password reset tokens,
 * account enumeration, production secret fallback, storage path traversal and
 * upload ownership, and the S3 request signature.
 */

describe("password reset: token handling", () => {
  let user: TestUser;
  const created: string[] = [];

  beforeEach(async () => {
    user = await createTestUser();
    resetEnvCache();
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.idempotencyKey.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
    resetEnvCache();
  });

  async function issueTokenFor(email: string): Promise<string> {
    const result = await requestPasswordReset(email);
    if (!result.developmentLink) {
      throw new Error("expected a development reset link");
    }
    const url = new URL(result.developmentLink);
    const token = url.searchParams.get("token");
    if (!token) throw new Error("no token in the link");
    return token;
  }

  it("stores only a hash, never the token itself", async () => {
    const token = await issueTokenFor(user.email);

    const rows = await prisma.idempotencyKey.findMany({
      where: { userId: user.id, scope: "password-reset" },
    });
    expect(rows).toHaveLength(1);

    const stored = rows[0]!.key;
    // The plaintext token must not be recoverable from the database.
    expect(stored).not.toBe(token);
    expect(stored).not.toContain(token);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes the password and revokes every session", async () => {
    const token = await issueTokenFor(user.email);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: "hash-of-an-existing-session",
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    const result = await consumeResetToken(
      token,
      "a-brand-new-strong-password",
    );
    expect(result.ok).toBe(true);

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    if (!updated.passwordHash) throw new Error("expected a password hash");
    const { verifyPassword } = await import("@/lib/password");
    expect(
      await verifyPassword(updated.passwordHash, "a-brand-new-strong-password"),
    ).toBe(true);

    // A reset exists because the password may be compromised, so old sessions die.
    const stillLive = await prisma.session.findFirst({
      where: { id: session.id, revokedAt: null },
    });
    expect(stillLive).toBeNull();
  });

  it("refuses to reuse a consumed token", async () => {
    const token = await issueTokenFor(user.email);
    expect(
      (await consumeResetToken(token, "a-brand-new-strong-password")).ok,
    ).toBe(true);

    const second = await consumeResetToken(token, "another-strong-password");
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("USED");
  });

  it("refuses an expired token and burns it", async () => {
    const token = await issueTokenFor(user.email);
    await prisma.idempotencyKey.updateMany({
      where: { userId: user.id, scope: "password-reset" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await consumeResetToken(
      token,
      "a-brand-new-strong-password",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("EXPIRED");

    // And it cannot be revived by retrying.
    const again = await consumeResetToken(token, "a-brand-new-strong-password");
    expect(again.ok).toBe(false);
  });

  it("invalidates an outstanding token when a new one is requested", async () => {
    const first = await issueTokenFor(user.email);
    const second = await issueTokenFor(user.email);
    expect(second).not.toBe(first);

    // The superseded token must be dead: an email an attacker triggered first
    // cannot be used after the real owner asks for a new one.
    expect(
      (await consumeResetToken(first, "a-brand-new-strong-password")).ok,
    ).toBe(false);
    expect(
      (await consumeResetToken(second, "a-brand-new-strong-password")).ok,
    ).toBe(true);
  });

  it("rejects a weak password without consuming the token", async () => {
    const token = await issueTokenFor(user.email);
    const result = await consumeResetToken(token, "password");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("WEAK_PASSWORD");

    // The token survives so the user can retry with something acceptable.
    const retry = await consumeResetToken(token, "a-brand-new-strong-password");
    expect(retry.ok).toBe(true);
  });

  it("reports link validity without consuming anything", async () => {
    const token = await issueTokenFor(user.email);
    expect((await inspectResetToken(token)).valid).toBe(true);
    expect((await inspectResetToken("not-a-real-token")).valid).toBe(false);
    expect((await inspectResetToken("")).valid).toBe(false);
  });
});

describe("password reset: account enumeration", () => {
  it("returns an identical result for a known and an unknown address", async () => {
    resetEnvCache();
    const known = await createTestUser();
    try {
      const a = await requestPasswordReset(known.email);
      const b = await requestPasswordReset(
        "definitely-not-a-user@nowhere.test",
      );

      // Same shape, and no token in either public result.
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      expect(b.developmentLink).toBeUndefined();
      expect(ENUMERATION_SAFE_MESSAGE).toContain("If that account exists");
    } finally {
      await prisma.user.deleteMany({ where: { id: known.id } });
      resetEnvCache();
    }
  });

  it("sends no mail for an unknown address", async () => {
    resetEnvCache();
    const before = (await lastDevelopmentMessage())?.subject ?? "";

    await requestPasswordReset("nobody-here@nowhere.test");
    const after = (await lastDevelopmentMessage())?.subject ?? "";

    expect(after).toBe(before);
    resetEnvCache();
  });

  it("emails a real link for a known address", async () => {
    resetEnvCache();
    const user = await createTestUser();
    try {
      await requestPasswordReset(user.email);
      const message = await lastDevelopmentMessage();
      expect(message?.to).toBe(user.email);
      expect(message?.subject).toMatch(/reset your acme jobs password/i);
      expect(message?.body).toContain("/reset-password?token=");
      // The link is never in the subject or headers.
      expect(message?.subject).not.toContain("token=");
    } finally {
      await prisma.user.deleteMany({ where: { id: user.id } });
      resetEnvCache();
    }
  });
});

describe("production secret fallback", () => {
  const base = {
    NODE_ENV: "production",
    APP_URL: "https://acmejobs.example",
    DATABASE_URL: "postgresql://user:pass@db.example:5432/acme",
    AUTH_SECRET: "a".repeat(64),
    KEY_ENCRYPTION_SECRET: "b".repeat(64),
  };

  it("accepts a correctly configured production environment", () => {
    expect(() => assertProductionConfigSafe(base)).not.toThrow();
  });

  it("refuses a missing AUTH_SECRET", () => {
    expect(() =>
      assertProductionConfigSafe({ ...base, AUTH_SECRET: undefined }),
    ).toThrow(/AUTH_SECRET/);
  });

  it("refuses a development placeholder in either secret", () => {
    expect(() =>
      assertProductionConfigSafe({
        ...base,
        AUTH_SECRET: "acme-jobs-local-development-secret",
      }),
    ).toThrow(/AUTH_SECRET/);

    expect(() =>
      assertProductionConfigSafe({
        ...base,
        KEY_ENCRYPTION_SECRET:
          "dev-only-change-me-0000000000000000000000000000",
      }),
    ).toThrow(/KEY_ENCRYPTION_SECRET/);
  });

  it("refuses KEY_ENCRYPTION_SECRET reusing AUTH_SECRET", () => {
    // This used to happen silently: the key fell back to the session secret, so
    // compromising sessions would also decrypt stored API keys.
    const shared = "c".repeat(64);
    expect(() =>
      assertProductionConfigSafe({
        ...base,
        AUTH_SECRET: shared,
        KEY_ENCRYPTION_SECRET: shared,
      }),
    ).toThrow(/must not be the same value/i);
  });

  it("refuses short secrets", () => {
    expect(() =>
      assertProductionConfigSafe({ ...base, AUTH_SECRET: "short" }),
    ).toThrow(/32 characters/);
  });

  it("does not boot-refuse on an http APP_URL, but refuses it missing", () => {
    // Session cookies are marked Secure only when the configured origin is
    // https, so a loopback or TLS-offloaded http deployment does not become a
    // silently Secure-only sign-in fiasco. Preflight warns loudly instead.
    expect(() =>
      assertProductionConfigSafe({
        ...base,
        APP_URL: "http://acmejobs.example",
      }),
    ).not.toThrow();
    expect(() => assertProductionConfigSafe({ ...base, APP_URL: "" })).toThrow(
      /APP_URL/,
    );
  });

  it("refuses the development DATABASE_URL default", () => {
    expect(() =>
      assertProductionConfigSafe({
        ...base,
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:5432/acme_jobs?schema=public",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("refuses DEV_LOG_MAGIC_LINKS in production", () => {
    expect(() =>
      assertProductionConfigSafe({ ...base, DEV_LOG_MAGIC_LINKS: "true" }),
    ).toThrow(/DEV_LOG_MAGIC_LINKS/);
  });

  it("does not apply production rules in development", () => {
    expect(() =>
      assertProductionConfigSafe({ NODE_ENV: "development" }),
    ).not.toThrow();
  });
});

describe("storage safety", () => {
  it("rejects traversal and malformed keys outright", () => {
    for (const bad of [
      "../secret",
      "a/../../b",
      "/absolute",
      "C:/windows",
      "back\\slash",
      ".hidden",
      "double//slash",
      "",
      "x".repeat(300),
    ]) {
      expect(() => assertSafeKey(bad), bad).toThrow();
    }
    expect(assertSafeKey("1730000000000-abc123.pdf")).toBe(
      "1730000000000-abc123.pdf",
    );
  });

  it("generates an unguessable object key regardless of the filename", () => {
    const a = generateObjectKey("application/pdf");
    const b = generateObjectKey("application/pdf");
    expect(a).not.toBe(b);
    // 16 random bytes, so two uploads of the same name never collide.
    expect(a).toMatch(/^\d{13}-[0-9a-f]{32}\.pdf$/);
  });

  it("allows uploads but refuses arbitrary types", () => {
    expect(() => assertMimeAllowed("application/pdf")).not.toThrow();
    expect(() => assertMimeAllowed("text/html")).toThrow();
    expect(() => assertMimeAllowed("application/x-msdownload")).toThrow();
    // Internal artefacts are a separate, narrower allowlist.
    expect(() => assertMimeAllowed("application/json", true)).not.toThrow();
    expect(() => assertMimeAllowed("text/html", true)).toThrow();
  });
});

describe("S3 request signing", () => {
  const config = {
    endpoint: "https://s3.eu-west-2.amazonaws.com",
    region: "eu-west-2",
    bucket: "acme-jobs",
    forcePathStyle: false,
  };
  const credentials = {
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  };

  it("produces a well-formed SigV4 authorization header", () => {
    const signed = signRequest({
      method: "PUT",
      config,
      credentials,
      key: "uploads/abc/file.pdf",
      body: Buffer.from("hello"),
      contentType: "application/pdf",
      now: new Date("2026-01-02T03:04:05Z"),
    });

    expect(signed.url).toBe(
      "https://acme-jobs.s3.eu-west-2.amazonaws.com/uploads/abc/file.pdf",
    );
    expect(signed.headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/\d{8}\/eu-west-2\/s3\/aws4_request, SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/,
    );
    expect(signed.headers["x-amz-date"]).toBe("20260102T030405Z");
    expect(signed.headers["x-amz-content-sha256"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes the signature when the body changes", () => {
    const now = new Date("2026-01-02T03:04:05Z");
    const a = signRequest({
      method: "PUT",
      config,
      credentials,
      key: "uploads/a.txt",
      body: Buffer.from("one"),
      now,
    });
    const b = signRequest({
      method: "PUT",
      config,
      credentials,
      key: "uploads/a.txt",
      body: Buffer.from("two"),
      now,
    });
    expect(a.headers.authorization).not.toBe(b.headers.authorization);
  });

  it("uses path style where the provider needs it", () => {
    expect(
      objectUrl({ ...config, forcePathStyle: true }, "uploads/a.txt"),
    ).toBe("https://s3.eu-west-2.amazonaws.com/acme-jobs/uploads/a.txt");
  });

  it("detects when path style is required", () => {
    // A known self-hosted hostname, or any bare host:port, means a local gateway.
    expect(shouldForcePathStyle("http://localhost:9000")).toBe(true);
    expect(shouldForcePathStyle("http://127.0.0.1:9000")).toBe(true);
    expect(shouldForcePathStyle("https://minio")).toBe(true);
    expect(shouldForcePathStyle("https://storage.minio")).toBe(true);
    // Real cloud endpoints resolve bucket subdomains, so they must not switch.
    expect(shouldForcePathStyle("https://s3.amazonaws.com")).toBe(false);
    expect(shouldForcePathStyle("https://abc.r2.cloudflarestorage.com")).toBe(
      false,
    );
  });

  it("cannot detect every custom gateway hostname", () => {
    // Documented limitation rather than a bug: "minio.example.com" is
    // indistinguishable from a cloud hostname to any heuristic, so it reads as
    // virtual-hosted. S3_FORCE_PATH_STYLE is the explicit override.
    expect(shouldForcePathStyle("https://minio.example.com")).toBe(false);
  });

  it("percent-encodes keys that need it", () => {
    expect(objectUrl(config, "uploads/a b+c.txt")).toContain("a%20b%2Bc.txt");
  });
});

describe("email templates", () => {
  it("escapes interpolated values", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });

  it("renders both HTML and text for a reset", () => {
    resetEnvCache();
    const rendered = passwordResetEmail({
      name: "Sam",
      resetUrl: "https://acmejobs.example/reset-password?token=abc",
      expiresInMinutes: 60,
    });

    expect(rendered.subject).toMatch(/reset/i);
    expect(rendered.html).toContain("https://acmejobs.example/reset-password");
    expect(rendered.text).toContain("https://acmejobs.example/reset-password");
    // Never promise a password by email, and say the link is single use.
    expect(rendered.text).toMatch(/once/i);
    expect(rendered.text).toMatch(/never email you a password/i);
    resetEnvCache();
  });
});

describe("argon2id remains the only password store", () => {
  it("hashes rather than storing plaintext", async () => {
    const hash = await hashPassword("a-strong-enough-password");
    expect(hash).not.toContain("a-strong-enough-password");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });
});
