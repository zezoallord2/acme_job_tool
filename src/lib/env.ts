import { z } from "zod";

/**
 * Centralized configuration. Every value is validated once at first access so a
 * misconfigured deployment fails loudly instead of misbehaving silently.
 *
 * Zero-cost rule: no variable in this file is required for Acme Jobs to boot in
 * Manual AI mode. Paid credentials are optional adapters only.
 */

const boolish = z
  .union([z.boolean(), z.string()])
  .transform((v) =>
    typeof v === "boolean" ? v : /^(1|true|yes|on)$/i.test(v.trim()),
  );

const csv = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_NAME: z.string().default("Acme Jobs"),
  APP_URL: z.string().default("http://localhost:3100"),
  APP_VERSION: z.string().default("1.0.0"),
  SCHEMA_VERSION: z.string().default("1"),

  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().optional(),

  ZERO_COST_MODE: boolish.default("true"),
  // Server-held provider keys power the default one-click AI for every plan.
  // Without a key this is harmless: the router reports "AI unavailable" and the
  // UI offers Manual Mode as an explicit, secondary choice.
  ACME_AI_ENABLED: boolish.default("true"),

  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(336),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).default(10),
  DEV_LOG_MAGIC_LINKS: boolish.default("false"),

  DATA_DIR: z.string().default("./data"),
  /**
   * Which storage driver to use.
   *
   * `local` (default) is correct for development and for self-hosted servers
   * with a persistent disk. `s3` is for ephemeral/serverless hosts where the
   * filesystem does not survive a redeploy.
   *
   * STORAGE_PROVIDER is the older name and is still honoured, so existing
   * deployments keep working.
   */
  STORAGE_DRIVER: z.enum(["local", "s3"]).optional(),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).optional(),
  /** Where local files live. Falls back to DATA_DIR when unset. */
  LOCAL_STORAGE_PATH: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** Base URL for public reads, e.g. a CDN in front of the bucket. */
  S3_PUBLIC_BASE_URL: z.string().optional(),
  /**
   * Path-style addressing. Required by MinIO and most self-hosted gateways,
   * harmful on AWS. Leave unset to let each provider use its default.
   */
  S3_FORCE_PATH_STYLE: boolish.optional(),

  QUEUE_PROVIDER: z.enum(["postgres", "redis"]).default("postgres"),
  QUEUE_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(2000),
  QUEUE_BATCH_SIZE: z.coerce.number().int().min(1).max(50).default(5),
  QUEUE_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(3),
  QUEUE_LOCK_TIMEOUT_MS: z.coerce.number().int().min(5000).default(120000),
  RUN_WORKER_INLINE: boolish.default("true"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  LOG_DIR: z.string().default("./data/logs"),
  OBSERVABILITY_PROVIDER: z.enum(["internal"]).default("internal"),

  ANALYTICS_PROVIDER: z.enum(["internal"]).default("internal"),
  PRODUCT_LEARNING_ENABLED: boolish.default("true"),

  // Ordered failover chain of SERVER-held keys. Gemini's free tier first, an
  // OpenRouter free model second; a user's own key (BYOK) is tried after these.
  // `manual` is never reached silently: when every provider fails the workflow
  // returns an explicit error and the UI offers Manual Mode as a button.
  AI_MODE_PRIORITY: csv.default("gemini,openrouter"),
  DEFAULT_AI_PROVIDER: z
    .enum(["manual", "openai", "anthropic", "gemini", "openrouter"])
    .default("gemini"),

  // Which concrete model the Acme-funded "Basic AI" mode uses. Groq by default:
  // it has a genuinely usable free tier and an OpenAI-compatible API, so Basic
  // AI can be offered at $0 without a paid dependency.
  BASIC_AI_MODEL: z.string().default("qwen/qwen3.8-27b"),
  BASIC_AI_BASE_URL: z.string().default("https://api.groq.com/openai/v1"),
  BASIC_AI_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60000),
  BASIC_AI_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .min(16_384)
    .max(10_000_000)
    .default(1_000_000),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  // Overrides the OpenAI host for any OpenAI-compatible endpoint (Groq, Together,
  // Fireworks, LM Studio, vLLM). Empty means api.openai.com.
  OPENAI_BASE_URL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-3-5-haiku-latest"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  OPENROUTER_API_KEY: z.string().optional(),
  // `openrouter/free` routes to whichever free model is currently available, so a
  // retired `:free` id cannot silently break the fallback. Pin a specific model
  // (e.g. nvidia/nemotron-3-super-120b-a12b:free) for more predictable JSON.
  OPENROUTER_MODEL: z.string().default("openrouter/free"),

  // --- Abuse limits for the AI-first features (per user, per UTC day) -------
  // Features are open to every plan; these caps, plus the hourly aiAssist rate
  // limit, are what keep free-tier provider quota from being drained.
  TAILOR_DAILY_CAP_FREE: z.coerce.number().int().min(0).default(5),
  TAILOR_DAILY_CAP_PAID: z.coerce.number().int().min(0).default(30),
  INTERVIEW_DAILY_CAP_FREE: z.coerce.number().int().min(0).default(3),
  INTERVIEW_DAILY_CAP_PAID: z.coerce.number().int().min(0).default(20),
  JOB_REFRESH_DAILY_CAP_FREE: z.coerce.number().int().min(0).default(10),
  JOB_REFRESH_DAILY_CAP_PAID: z.coerce.number().int().min(0).default(40),

  // --- Job search providers --------------------------------------------------
  // Every keyed provider is a no-op when its key is missing, and says so in the
  // provider health strip instead of silently returning nothing.
  /** Optional allow-list of provider ids (comma separated). Empty = all. */
  JOB_SEARCH_PROVIDERS: csv.default(""),
  JOB_PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1000).default(9000),
  ADZUNA_APP_ID: z.string().optional(),
  ADZUNA_APP_KEY: z.string().optional(),
  /** Adzuna is per-country; these are searched in addition to the target country. */
  ADZUNA_COUNTRIES: csv.default("us,gb"),
  JOOBLE_API_KEY: z.string().optional(),
  /** Jooble's free key is 500 requests for its lifetime; budget it monthly. */
  JOOBLE_MONTHLY_GLOBAL: z.coerce.number().int().min(0).default(40),
  USAJOBS_API_KEY: z.string().optional(),
  /** USAJobs requires the email you registered with as the User-Agent. */
  USAJOBS_USER_AGENT: z.string().optional(),
  THEMUSE_API_KEY: z.string().optional(),
  SERPAPI_API_KEY: z.string().optional(),
  SERPAPI_PAGES: z.coerce.number().int().min(1).max(5).default(2),
  SERPAPI_MONTHLY_GLOBAL: z.coerce.number().int().min(0).default(240),
  SERPAPI_MONTHLY_PER_USER: z.coerce.number().int().min(0).default(10),
  /** JSearch via OpenWeb Ninja (the official host, x-api-key header). */
  JSEARCH_API_KEY: z.string().optional(),
  /** JSearch via RapidAPI (legacy host). Used when JSEARCH_API_KEY is unset. */
  RAPIDAPI_KEY: z.string().optional(),
  JSEARCH_PAGES: z.coerce.number().int().min(1).max(5).default(2),
  JSEARCH_MONTHLY_GLOBAL: z.coerce.number().int().min(0).default(90),
  JSEARCH_MONTHLY_PER_USER: z.coerce.number().int().min(0).default(10),

  ENTITLEMENT_PROVIDER: z.enum(["manual", "whop", "stripe"]).default("manual"),
  BILLING_PROVIDER: z.enum(["manual", "whop", "stripe"]).default("manual"),
  WHOP_API_KEY: z.string().optional(),
  WHOP_WEBHOOK_SECRET: z.string().optional(),
  WHOP_PRODUCT_ID: z.string().optional(),
  /**
   * Shared secret used to sign the billing-account link token. It ties a purchase
   * to the local account that made it. Required when BILLING_PROVIDER=whop,
   * because without it any visitor could claim another user's purchase.
   * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   */
  BILLING_LINK_SECRET: z.string().optional(),

  /**
   * Transactional email driver.
   *
   * `development` writes the message to a local log file and costs nothing.
   * `smtp` speaks plain SMTP and works with any compatible provider, so no
   * vendor is hardcoded.
   */
  MAIL_DRIVER: z.enum(["development", "smtp"]).default("development"),
  MAIL_FROM_ADDRESS: z
    .string()
    .email("MAIL_FROM_ADDRESS must be an email address")
    .default("no-reply@acmejobs.local"),
  MAIL_FROM_NAME: z.string().default("Acme Jobs"),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  /** Implicit TLS on 465. Leave unset to use STARTTLS on 587. */
  SMTP_SECURE: boolish.optional(),

  // Transactional mail carries password-reset tokens, so an encrypted channel is
  // mandatory by default. Only disable for a relay you control on a private
  // network; anything else risks delivering reset links in cleartext.
  SMTP_REQUIRE_STARTTLS: boolish.default(true),

  /**
   * Password reset lifetime. Deliberately short: a reset link is a temporary
   * credential, and a long-lived one in a mailbox is a standing risk.
   */
  PASSWORD_RESET_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(1440)
    .default(60),

  EMAIL_ENABLED: boolish.default("false"),

  RATE_LIMIT_PROVIDER: z.enum(["database", "memory"]).default("database"),

  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .default(5 * 1024 * 1024),

  KEY_ENCRYPTION_SECRET: z.string().min(16).optional(),

  ALLOW_AUTO_REPAIR_IN_ENV: z
    .enum(["local_dev", "test", "staging", "none"])
    .default("local_dev"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/**
 * Values that exist only to make `npm run dev` work. None of them may reach
 * production: `AUTH_SECRET` signs sessions and `KEY_ENCRYPTION_SECRET` encrypts
 * stored third-party keys, so a known default in production is a known
 * credential.
 */
export const DEV_ONLY_SECRETS = [
  "acme-jobs-local-development-secret",
  "dev-only-change-me-0000000000000000000000000000",
  "change-me",
] as const;

/** The silent DATABASE_URL fallback, so the preflight can flag it explicitly. */
export const DEV_ONLY_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/acme_jobs?schema=public";

function isDevSecret(value: string | undefined): boolean {
  if (!value) return false;
  return DEV_ONLY_SECRETS.some((dev) => value.includes(dev));
}

/**
 * Hard failures that must stop a production **runtime**.
 *
 * Called from `instrumentation.ts` when the server boots, and from
 * `npm run production:check`. It is deliberately NOT called from `env()`:
 * `next build` evaluates route modules with NODE_ENV=production on a build
 * machine that legitimately has no runtime secrets yet, and failing there would
 * break the standard build-then-deploy model.
 *
 * Throwing rather than warning is deliberate: a server that starts with a
 * predictable secret looks healthy and is not.
 */
export function assertProductionConfigSafe(
  source: Record<string, string | undefined> = process.env,
): void {
  if (source.NODE_ENV !== "production") return;

  const failures: string[] = [];

  const auth = source.AUTH_SECRET;
  if (!auth || isDevSecret(auth)) {
    failures.push(
      "AUTH_SECRET is missing or still a development placeholder. Generate one with: openssl rand -hex 32",
    );
  } else if (auth.length < 32) {
    failures.push("AUTH_SECRET must be at least 32 characters in production.");
  }

  const key = source.KEY_ENCRYPTION_SECRET;
  if (!key || isDevSecret(key)) {
    failures.push(
      "KEY_ENCRYPTION_SECRET is missing or still a development placeholder. Generate one with: openssl rand -hex 32",
    );
  } else if (key.length < 32) {
    failures.push(
      "KEY_ENCRYPTION_SECRET must be at least 32 characters in production.",
    );
  } else if (key === auth) {
    // Previously the key silently fell back to AUTH_SECRET. Reusing one secret
    // for two purposes means a session-signing compromise also decrypts stored
    // API keys, so they must be independent.
    failures.push(
      "KEY_ENCRYPTION_SECRET must not be the same value as AUTH_SECRET. They protect different things.",
    );
  }

  if (!source.DATABASE_URL || source.DATABASE_URL === DEV_ONLY_DATABASE_URL) {
    failures.push(
      "DATABASE_URL is missing or still the development default. Production must point at a real database.",
    );
  }

  if (!source.APP_URL) {
    failures.push(
      "APP_URL is not set. Set it to the public origin (https in deployments).",
    );
  }

  if (
    source.DEV_LOG_MAGIC_LINKS &&
    /^(1|true|yes|on)$/i.test(source.DEV_LOG_MAGIC_LINKS)
  ) {
    // It prints working sign-in links, which is exactly what must not exist on a
    // reachable production host.
    failures.push(
      "DEV_LOG_MAGIC_LINKS must be false in production. It prints sign-in links.",
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `Refusing to start in production with an unsafe configuration:\n  - ${failures.join(
        "\n  - ",
      )}`,
    );
  }
}

function readEnv(): Record<string, string | undefined> {
  const source: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) source[k] = v;
  }
  if (!process.env.DATABASE_URL && process.env.TEST_DATABASE_URL) {
    source.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }
  if (!source.DATABASE_URL) {
    source.DATABASE_URL = DEV_ONLY_DATABASE_URL;
  }
  if (!source.AUTH_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is required in production.");
    }
    source.AUTH_SECRET = "acme-jobs-local-development-secret";
  }
  // No production fallback: assertProductionConfigSafe rejects the dev default, and
  // a missing key in production fails the boot instead of silently reusing the
  // session secret.
  if (!source.KEY_ENCRYPTION_SECRET && process.env.NODE_ENV !== "production") {
    source.KEY_ENCRYPTION_SECRET = source.AUTH_SECRET;
  }

  return source;
}

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(readEnv());
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration -> ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}

export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}

export function isTest(): boolean {
  return env().NODE_ENV === "test";
}

export function databaseUrlForTests(): string {
  const e = env();
  return e.TEST_DATABASE_URL ?? e.DATABASE_URL;
}

/**
 * Resolved storage driver.
 *
 * STORAGE_DRIVER wins; STORAGE_PROVIDER is the legacy name and still honoured
 * so an existing deployment that only sets the old variable keeps its behaviour.
 */
export function storageDriver(): "local" | "s3" {
  const e = env();
  return e.STORAGE_DRIVER ?? e.STORAGE_PROVIDER ?? "local";
}

/** Resolved local storage root, preferring LOCAL_STORAGE_PATH over DATA_DIR. */
export function localStoragePath(): string {
  const e = env();
  return e.LOCAL_STORAGE_PATH ?? e.DATA_DIR;
}

/** Resolved mail driver. */
export function mailDriver(): "development" | "smtp" {
  return env().MAIL_DRIVER;
}
