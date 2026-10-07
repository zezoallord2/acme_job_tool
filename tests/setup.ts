import { beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";

/**
 * Test bootstrap.
 *
 * Integration and security tests run against a real PostgreSQL database
 * (acme_jobs_test), created and migrated here. Nothing is mocked at the
 * persistence layer, so authorization and transaction behaviour is genuinely
 * exercised rather than simulated.
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5433/acme_jobs_test?schema=public";

process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.ZERO_COST_MODE = "true";
process.env.ACME_AI_ENABLED = "false";
process.env.DEFAULT_AI_PROVIDER = "manual";
process.env.AUTH_SECRET = "acme-jobs-test-secret-0123456789abcdef";
process.env.KEY_ENCRYPTION_SECRET = "acme-jobs-test-secret-0123456789abcdef";
process.env.RATE_LIMIT_PROVIDER = "memory";
process.env.LOG_LEVEL = "silent";
process.env.QUEUE_MAX_ATTEMPTS = "3";
process.env.QUEUE_POLL_INTERVAL_MS = "200";
// No provider credentials: proves the zero-cost configuration boots and works.
delete process.env.OPENAI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.REDIS_URL;
delete process.env.SENTRY_DSN;
delete process.env.WHOP_API_KEY;
delete process.env.WHOP_WEBHOOK_SECRET;

let migrated = false;

beforeAll(() => {
  if (migrated) return;
  migrated = true;
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}, 180_000);

afterAll(async () => {
  const { disconnectDb } = await import("@/lib/db");
  await disconnectDb().catch(() => undefined);
});
