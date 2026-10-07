import { assertProductionConfigSafe } from "@/lib/env";
import { prisma } from "@/lib/db";

/**
 * Production preflight.
 *
 *   npm run production:check
 *
 * Verifies configuration BEFORE a deployment, not after. Each check returns
 * PASS, WARNING or FAIL:
 *
 *   FAIL     the app will not boot, or will boot insecurely. Deployment must stop.
 *   WARNING  deployable, but something will degrade or is worth fixing first.
 *   PASS     good to go.
 *
 * Exits non-zero on any FAIL, so it can be a required step in a deploy pipeline.
 * It never prints a secret value: findings name the variable and the problem.
 */

type Status = "PASS" | "WARNING" | "FAIL";

interface Check {
  name: string;
  status: Status;
  detail: string;
  /** What to do, when something needs doing. */
  remedy?: string;
}

const checks: Check[] = [];

function pass(name: string, detail: string): void {
  checks.push({ name, status: "PASS", detail });
}
function warn(name: string, detail: string, remedy?: string): void {
  checks.push({ name, status: "WARNING", detail, remedy });
}
function fail(name: string, detail: string, remedy?: string): void {
  checks.push({ name, status: "FAIL", detail, remedy });
}

/** Shows a prefix of a value, never the whole thing. */
function mask(value: string | undefined): string {
  if (!value) return "(unset)";
  if (value.length <= 8) return "(set, too short to be a secret)";
  return `${value.slice(0, 4)}…${value.slice(-2)} (${value.length} chars)`;
}

async function main(): Promise<void> {
  const e = process.env;
  const isProductionMode = e.NODE_ENV === "production";

  // --- 1. Environment shape -------------------------------------------------
  if (!isProductionMode) {
    warn(
      "NODE_ENV",
      `NODE_ENV is "${e.NODE_ENV ?? "(unset)"}", not "production".`,
      "Set NODE_ENV=production so secure cookies and error messages behave correctly.",
    );
  } else {
    pass("NODE_ENV", "production");
  }

  // --- 2. Secrets ----------------------------------------------------------
  // The same assertion the server makes at boot, so the preflight and the runtime
  // can never disagree about what counts as safe.
  if (isProductionMode) {
    try {
      assertProductionConfigSafe(e);
      pass(
        "security secrets",
        "The runtime boot gate accepts this configuration",
      );
    } catch (err) {
      fail(
        "security secrets",
        err instanceof Error
          ? err.message.replace(/^Refusing to start[^\n]*\n/, "")
          : "unsafe configuration",
        "The server will refuse to start. Fix these before deploying.",
      );
    }
  } else {
    warn(
      "security secrets",
      "Boot gate not exercised: NODE_ENV is not production. It runs when the server starts.",
    );
  }

  if (!e.AUTH_SECRET) {
    fail("AUTH_SECRET", "Not set.", "openssl rand -hex 32");
  } else {
    pass("AUTH_SECRET", `present, ${mask(e.AUTH_SECRET)}`);
  }
  if (!e.KEY_ENCRYPTION_SECRET) {
    fail(
      "KEY_ENCRYPTION_SECRET",
      "Not set. Encrypts stored third-party API keys.",
      "openssl rand -hex 32",
    );
  } else if (e.KEY_ENCRYPTION_SECRET === e.AUTH_SECRET) {
    fail(
      "KEY_ENCRYPTION_SECRET",
      "Same value as AUTH_SECRET. A session compromise would also decrypt API keys.",
      "Generate an independent value.",
    );
  } else {
    pass("KEY_ENCRYPTION_SECRET", `present, ${mask(e.KEY_ENCRYPTION_SECRET)}`);
  }

  if (!e.BILLING_LINK_SECRET) {
    if ((e.BILLING_PROVIDER ?? "manual") === "whop") {
      fail(
        "BILLING_LINK_SECRET",
        "Required when BILLING_PROVIDER=whop. Without it any visitor could claim a purchase.",
        "openssl rand -hex 32",
      );
    } else {
      pass(
        "BILLING_LINK_SECRET",
        "Not set, and not needed because BILLING_PROVIDER is not whop",
      );
    }
  } else {
    pass("BILLING_LINK_SECRET", `present, ${mask(e.BILLING_LINK_SECRET)}`);
  }

  // --- 3. Application URL ---------------------------------------------------
  if (!e.APP_URL) {
    fail(
      "APP_URL",
      "Not set.",
      "Set it to the public https origin, no trailing slash.",
    );
  } else if (!/^https:\/\//i.test(e.APP_URL)) {
    // Not a deploy-time failure because cookies are only marked Secure for
    // https origins (see src/lib/auth.ts), and some operators intentionally
    // run http behind a trusted proxy. It must still be loud.
    warn(
      "APP_URL",
      `Is "${e.APP_URL}", which is not https. Session cookies will not carry the Secure attribute, so terminate TLS or accept the risk on a private network.`,
      "Set an https:// origin.",
    );
  } else if (/\/+$/.test(e.APP_URL)) {
    warn(
      "APP_URL",
      "Has a trailing slash; links may contain a double slash.",
      "Remove it.",
    );
  } else {
    pass("APP_URL", e.APP_URL);
  }

  // --- 4. Database and migrations ------------------------------------------
  if (!e.DATABASE_URL) {
    fail("DATABASE_URL", "Not set.");
  } else {
    try {
      await prisma.$queryRaw`SELECT 1`;
      pass("DATABASE_URL", "Database reachable");

      // Confirm the schema matches the migrations, using the same tables the app
      // needs. This is the check that catches "the host forgot to migrate".
      const { checkBootReadiness } = await import("@/lib/boot-readiness");
      const readiness = await checkBootReadiness();
      const drift = readiness.filter((c) => !c.ok && c.fatal);
      if (drift.length > 0) {
        fail(
          "migrations",
          drift.map((c) => `${c.name}: ${c.detail}`).join(" | "),
          "Run: npx prisma migrate deploy",
        );
      } else {
        pass("migrations", "Schema matches the committed migrations");
      }
    } catch (err) {
      fail(
        "DATABASE_URL",
        `Unreachable: ${err instanceof Error ? err.message.slice(0, 120) : "unknown"}`,
        "Check the connection string and that the host can reach the database.",
      );
    }
  }

  // --- 5. Storage -----------------------------------------------------------
  const driver = e.STORAGE_DRIVER ?? e.STORAGE_PROVIDER ?? "local";
  if (driver === "s3") {
    const missing = [
      ["S3_ENDPOINT", e.S3_ENDPOINT],
      ["S3_BUCKET", e.S3_BUCKET],
      ["S3_ACCESS_KEY_ID", e.S3_ACCESS_KEY_ID],
      ["S3_SECRET_ACCESS_KEY", e.S3_SECRET_ACCESS_KEY],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length > 0) {
      fail(
        "storage",
        `STORAGE_DRIVER=s3 but missing: ${missing.join(", ")}.`,
        "Set them, or use STORAGE_DRIVER=local with a persistent volume.",
      );
    } else {
      pass(
        "storage",
        `S3-compatible, bucket ${e.S3_BUCKET}, region ${e.S3_REGION ?? "us-east-1"}`,
      );
    }
  } else {
    pass("storage", "local filesystem");
    const dataDir = e.LOCAL_STORAGE_PATH ?? e.DATA_DIR ?? "./data";
    try {
      const { mkdir, writeFile, rm, access } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const root = resolve(process.cwd(), dataDir);
      await mkdir(root, { recursive: true });
      const probe = resolve(root, `.production-check-${Date.now()}`);
      await writeFile(probe, "ok", "utf8");
      await access(probe);
      await rm(probe, { force: true });
      pass("storage.writable", `${dataDir} is writable`);
    } catch (err) {
      fail(
        "storage.writable",
        `${dataDir} is not writable: ${
          err instanceof Error ? err.message.slice(0, 100) : "unknown"
        }`,
        "Mount a persistent volume, or set STORAGE_DRIVER=s3.",
      );
    }
    if (!e.DATA_DIR && !e.LOCAL_STORAGE_PATH) {
      warn(
        "storage.path",
        "Neither DATA_DIR nor LOCAL_STORAGE_PATH is set; defaulting to ./data.",
      );
    }
  }

  // --- 6. Mail --------------------------------------------------------------
  const mailDriver = e.MAIL_DRIVER ?? "development";
  if (mailDriver === "development") {
    if (isProductionMode) {
      fail(
        "mail",
        "MAIL_DRIVER=development in production. Password reset emails would never be delivered.",
        "Set MAIL_DRIVER=smtp with SMTP_HOST, or accept that reset is unavailable.",
      );
    } else {
      pass("mail", "development (writes to the local mail log, costs nothing)");
    }
  } else if (mailDriver === "smtp") {
    if (!e.SMTP_HOST) {
      fail("mail", "MAIL_DRIVER=smtp but SMTP_HOST is not set.");
    } else {
      pass(
        "mail",
        `smtp via ${e.SMTP_HOST}:${e.SMTP_PORT ?? (e.SMTP_SECURE === "true" ? 465 : 587)}`,
      );
      if (!e.MAIL_FROM_ADDRESS) {
        warn(
          "mail.from",
          "MAIL_FROM_ADDRESS not set; a placeholder will be used.",
        );
      }
    }
  }

  // --- 7. Billing -----------------------------------------------------------
  const billing = (e.BILLING_PROVIDER ?? "manual").toLowerCase();
  if (billing === "manual") {
    pass("billing", "manual admin grants; no payment platform required");
  } else if (billing === "whop") {
    if (!e.WHOP_WEBHOOK_SECRET) {
      fail(
        "billing.whop",
        "WHOP_WEBHOOK_SECRET is not set; webhooks would be rejected.",
      );
    } else {
      pass("billing.whop", "webhook secret present");
    }
    if (!e.WHOP_PRODUCT_ID) {
      warn(
        "billing.whop",
        "WHOP_PRODUCT_ID not set; events for other products are not filtered.",
      );
    }
    if (!e.WHOP_API_KEY) {
      warn(
        "billing.whop",
        "WHOP_API_KEY not set. Only inbound webhooks are handled; refunds are not automated.",
      );
    }
  }

  // --- 8. Zero-cost ---------------------------------------------------------
  if (e.ZERO_COST_MODE === "false") {
    warn(
      "zero cost",
      "ZERO_COST_MODE=false. Paid AI may be used, which breaks the $0 guarantee.",
    );
  } else {
    pass("zero cost", "ZERO_COST_MODE is on; no paid service is required");
  }
  if (e.ACME_AI_ENABLED === "true") {
    warn(
      "acme ai",
      "ACME_AI_ENABLED=true, which requires paid provider credits.",
    );
  }

  // --- 9. Hygiene -----------------------------------------------------------
  if (
    e.DEV_LOG_MAGIC_LINKS &&
    /^(1|true|yes|on)$/i.test(e.DEV_LOG_MAGIC_LINKS)
  ) {
    fail(
      "DEV_LOG_MAGIC_LINKS",
      "Enabled. It prints sign-in links and must never be on in production.",
    );
  } else {
    pass("DEV_LOG_MAGIC_LINKS", "disabled");
  }

  if (e.RUN_WORKER_INLINE === "true") {
    warn(
      "worker",
      "RUN_WORKER_INLINE=true. The web process also runs background jobs, which blocks requests on slow work.",
      "Run a separate worker process and set this to false.",
    );
  } else {
    pass("worker", "separate worker process");
  }

  const used = [
    "AUTH_SECRET",
    "KEY_ENCRYPTION_SECRET",
    "BILLING_LINK_SECRET",
    "WHOP_WEBHOOK_SECRET",
    "S3_SECRET_ACCESS_KEY",
    "SMTP_PASSWORD",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
  ].filter((k) => e[k]);
  pass(
    "secret inventory",
    `${used.length} secret(s) present: ${used.join(", ")} (values never printed)`,
  );

  // --- Report ---------------------------------------------------------------
  const fails = checks.filter((c) => c.status === "FAIL");
  const warns = checks.filter((c) => c.status === "WARNING");

  console.log("");
  console.log("ACME JOBS — PRODUCTION PREFLIGHT");
  console.log("=".repeat(72));
  for (const c of checks) {
    const tag =
      c.status === "FAIL"
        ? "FAIL    "
        : c.status === "WARNING"
          ? "WARNING "
          : "PASS    ";
    console.log(`${tag} ${c.name}`);
    console.log(`        ${c.detail}`);
    if (c.remedy && c.status !== "PASS") {
      console.log(`        -> ${c.remedy}`);
    }
  }
  console.log("=".repeat(72));
  console.log(
    `PASS ${checks.length - fails.length - warns.length}   WARNING ${warns.length}   FAIL ${fails.length}`,
  );
  console.log("");

  if (fails.length > 0) {
    console.log("NOT READY. Resolve every FAIL before deploying.");
    process.exitCode = 1;
    return;
  }
  if (warns.length > 0) {
    console.log("DEPLOYABLE with warnings. Review the WARNING items above.");
    return;
  }
  console.log("READY TO DEPLOY.");
}

main()
  .catch((err: unknown) => {
    console.error("Preflight could not complete:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
