import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a real local server and a real PostgreSQL database.
 * Playwright is a test tool only — the product never requires browser automation.
 */
const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const AI_PORT = Number(process.env.E2E_AI_PORT ?? 3211);
export const AI_BASE_URL = `http://127.0.0.1:${AI_PORT}`;
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 3299);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /responsive\.spec\.ts/,
    },
  ],
  webServer: [
    {
      // No AI keys: the zero-key experience (AI unavailable, Manual Mode).
      command: `npm run start -- --port ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        ...process.env,
        NODE_ENV: "production",
        // The production boot gate refuses placeholder or missing secrets. E2E
        // injects throwaway ones; real deployments must use unique random values.
        AUTH_SECRET:
          "e2e-auth-secret-0123456789abcdef0123456789abcdef0123456789abcdef",
        KEY_ENCRYPTION_SECRET:
          "e2e-encryption-secret-0123456789abcdef0123456789abcdef0123456789ab",
        BILLING_LINK_SECRET:
          "e2e-billing-link-secret-0123456789abcdef0123456789abcdef0123456789abc",
        MAIL_DRIVER: "development",
        DEV_LOG_MAGIC_LINKS: "false",
        ACME_AI_ENABLED: "false",
      },
    },
    {
      // AI on, pointed at the local mock model and a mock job feed
      // (e2e/mock-services.ts, started in global setup). Used by
      // ai-journeys.spec.ts so the AI-first flows run without real keys.
      command: `npm run start -- --port ${AI_PORT}`,
      url: AI_BASE_URL,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        ...process.env,
        NODE_ENV: "production",
        // The production boot gate refuses placeholder or missing secrets. E2E
        // injects throwaway ones; real deployments must use unique random values.
        AUTH_SECRET:
          "e2e-auth-secret-0123456789abcdef0123456789abcdef0123456789abcdef",
        KEY_ENCRYPTION_SECRET:
          "e2e-encryption-secret-0123456789abcdef0123456789abcdef0123456789ab",
        BILLING_LINK_SECRET:
          "e2e-billing-link-secret-0123456789abcdef0123456789abcdef0123456789abc",
        MAIL_DRIVER: "development",
        DEV_LOG_MAGIC_LINKS: "false",
        ACME_AI_ENABLED: "true",
        AI_MODE_PRIORITY: "openai",
        DEFAULT_AI_PROVIDER: "openai",
        OPENAI_API_KEY: "e2e-mock-key",
        OPENAI_MODEL: "mock-model",
        OPENAI_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/v1`,
        GEMINI_API_KEY: "",
        OPENROUTER_API_KEY: "",
        JOB_SEARCH_PROVIDERS: "remotive",
        REMOTIVE_API_URL: `http://127.0.0.1:${MOCK_PORT}/remotive`,
      },
    },
  ],
});
