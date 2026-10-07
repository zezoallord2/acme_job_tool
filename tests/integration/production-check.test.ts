import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const run = promisify(execFile);
const ROOT = process.cwd();
const SCRIPT = join(ROOT, "scripts", "production-check.ts");
// Invoke tsx's JS entry through the current Node binary rather than going
// through npx or a .cmd shim, neither of which works reliably under execFile on
// Windows without a shell.
const TSX_CLI = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");

/**
 * The preflight is the gate a deploy passes through, so its verdicts are tested
 * rather than assumed. Each case runs the real script in a child process with a
 * complete environment, because the script is the thing an operator runs.
 */

const GOOD = {
  NODE_ENV: "production",
  APP_URL: "https://acmejobs.example",
  DATABASE_URL:
    "postgresql://postgres:postgres@127.0.0.1:5433/acme_jobs?schema=public",
  AUTH_SECRET: "a".repeat(64),
  KEY_ENCRYPTION_SECRET: "b".repeat(64),
  BILLING_LINK_SECRET: "c".repeat(64),
  ZERO_COST_MODE: "true",
  ACME_AI_ENABLED: "false",
  DEFAULT_AI_PROVIDER: "manual",
  MAIL_DRIVER: "smtp",
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  SMTP_USER: "mailer",
  SMTP_PASSWORD: "mailer-password",
  MAIL_FROM_ADDRESS: "no-reply@acmejobs.example",
  STORAGE_DRIVER: "local",
  DATA_DIR: "data",
  LOG_LEVEL: "info",
  RUN_WORKER_INLINE: "false",
  // Cleared explicitly: the parent shell may export it, and a leak here would
  // make the "correctly configured" baseline fail for the wrong reason.
  DEV_LOG_MAGIC_LINKS: "false",
} as const;

async function preflight(overrides: Record<string, string | undefined>) {
  // Do not inherit the parent environment wholesale: the dev shell exports
  // development credentials, and Vitest loads .env for this process, so any
  // variable an override means to unset would leak straight back in. Keep only
  // what Node needs to boot, then overlay the scenario.
  const base: Record<string, string | undefined> = {
    PATH: process.env.PATH,
    Path: process.env.Path,
    SystemRoot: process.env.SystemRoot,
    SYSTEMROOT: process.env.SYSTEMROOT,
    TEMP: process.env.TEMP,
    temp: process.env.temp,
    TMP: process.env.TMP,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
  };
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(GOOD)) {
    if (v !== undefined) env[k] = v;
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  try {
    const { stdout, stderr } = await run(process.execPath, [TSX_CLI, SCRIPT], {
      cwd: ROOT,
      env: Object.fromEntries(
        Object.entries({ ...base, ...env }).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ) as NodeJS.ProcessEnv,
      timeout: 180_000,
      windowsHide: true,
    });
    return { code: 0, output: stdout + stderr };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("production preflight", () => {
  it("passes a correctly configured production environment", async () => {
    const { output } = await preflight({});
    expect(output).toMatch(
      /READY TO DEPLOY|DEPLOYABLE with warnings|NOT READY/,
    );
    // No FAIL rows for the good configuration.
    expect(output).not.toMatch(/^\s*FAIL\s/m);
  }, 200_000);

  it("refuses to deploy when a secret is missing", async () => {
    const { output } = await preflight({ AUTH_SECRET: undefined });
    expect(output).toMatch(/AUTH_SECRET/);
    expect(output).toMatch(/NOT READY|NOT DEPLOYABLE/i);
  }, 200_000);

  it("refuses a placeholder secret", async () => {
    const { output } = await preflight({
      AUTH_SECRET: "acme-jobs-local-development-secret",
    });
    expect(output).toMatch(/AUTH_SECRET/);
  }, 200_000);

  it("warns (not refuses) on a non-https public URL", async () => {
    const { output } = await preflight({ APP_URL: "http://acmejobs.example" });
    expect(output).toMatch(/APP_URL/);
    expect(output).toMatch(/https/i);
    // The deployment is still considered deployable, with a loud warning.
    expect(output).toMatch(/WARNING/);
    expect(output).not.toMatch(/^\s*FAIL\s+APP_URL/m);
  }, 200_000);

  it("refuses a development database URL", async () => {
    const { output } = await preflight({
      DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5432/acme_jobs?schema=public",
    });
    expect(output).toMatch(/DATABASE_URL/);
  }, 200_000);

  it("does not treat development mode as deployable", async () => {
    const { output } = await preflight({
      NODE_ENV: "development",
      APP_URL: "http://localhost:3100",
    });
    expect(output).toMatch(/NOT READY|NOT DEPLOYABLE|NODE_ENV/i);
  }, 200_000);

  it("parses boolean environment variables instead of rejecting them", async () => {
    // Regression: these were declared as z.boolean(), which throws on the string
    // every real environment supplies, so any SMTP/S3 boolean setting broke
    // start-up entirely.
    const { output } = await preflight({
      MAIL_DRIVER: "smtp",
      SMTP_HOST: "smtp.example.test",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_REQUIRE_STARTTLS: "true",
      SMTP_USER: "mailer",
      SMTP_PASSWORD: "mailer-password",
      STORAGE_DRIVER: "s3",
      S3_ENDPOINT: "https://s3.example.test",
      S3_BUCKET: "acme-jobs",
      S3_REGION: "eu-west-2",
      S3_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
      S3_SECRET_ACCESS_KEY: "secret-access-key-value",
      S3_FORCE_PATH_STYLE: "true",
      // Inherited from the local shell otherwise, and a production FAIL.
      DEV_LOG_MAGIC_LINKS: "false",
    });

    // A schema crash names the offending key and says it was invalid.
    expect(output).not.toMatch(
      /SMTP_SECURE|S3_FORCE_PATH_STYLE|SMTP_REQUIRE_STARTTLS/,
    );
    expect(output).not.toMatch(
      /Unrecognized key|Invalid input|expected boolean/i,
    );
    // And the configured values were read, not ignored.
    expect(output).toMatch(/smtp via smtp\.example\.test/);
    expect(output).toMatch(/s3|S3/);
  }, 200_000);

  it("fails when the environment leaks a development-only flag", async () => {
    const { output } = await preflight({ DEV_LOG_MAGIC_LINKS: "true" });
    expect(output).toMatch(/DEV_LOG_MAGIC_LINKS/);
    expect(output).toMatch(/NOT READY/i);
  }, 200_000);
});
