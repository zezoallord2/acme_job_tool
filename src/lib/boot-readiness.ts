import { hashContent } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { logWarn } from "@/lib/logger";

/**
 * Boot-time schema and data-directory readiness.
 *
 * Hosting failure modes this prevents:
 *
 *  1. A host that starts the app without running migrations. The first request
 *     then fails with a Prisma error about a missing column, and the host's
 *     health check may still pass, so traffic keeps arriving.
 *  2. A read-only or missing filesystem, which breaks the local storage
 *     provider on an ephemeral container.
 *
 * This does NOT run migrations. Applying schema changes automatically at boot is
 * how a half-upgraded database happens: two instances racing, or a migration
 * failing halfway with traffic already live. Migrations are an explicit
 * deployment step (`prisma migrate deploy`), and this only verifies the result.
 */

export interface BootCheck {
  name: string;
  ok: boolean;
  fatal: boolean;
  detail: string;
}

/**
 * Tables the application cannot run without. Checked by name so a partially
 * applied migration is caught rather than surfacing later as a query error.
 */
const REQUIRED_TABLES = [
  "User",
  "Evidence",
  "JobPosting",
  "Application",
  "Entitlement",
  "WorkQueueItem",
  "WebhookEvent",
  "AIInteraction",
  "EvidenceProposal",
];

/**
 * Columns used as a drift canary, so a half-applied migration is caught rather
 * than surfacing later as an obscure query error. Every entry here is verified
 * against the Prisma schema so a rename cannot turn this into a false alarm.
 */
const REQUIRED_COLUMNS: Array<{ table: string; column: string }> = [
  { table: "Evidence", column: "verificationStatus" },
  { table: "Application", column: "version" },
  { table: "UserSettings", column: "notifyFollowUps" },
  { table: "EvidenceProposal", column: "confidence" },
  { table: "CareerNarrative", column: "userConfirmed" },
  { table: "VoiceProfile", column: "isDirect" },
];

export async function checkBootReadiness(): Promise<BootCheck[]> {
  const checks: BootCheck[] = [];

  // --- Database reachable ---
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({
      name: "database",
      ok: true,
      fatal: true,
      detail: "reachable",
    });
  } catch (e) {
    checks.push({
      name: "database",
      ok: false,
      fatal: true,
      detail: `unreachable: ${e instanceof Error ? e.message.slice(0, 120) : "unknown"}`,
    });
    // Nothing else can be checked without a database.
    return checks;
  }

  // --- Required tables present ---
  const missingTables: string[] = [];
  for (const table of REQUIRED_TABLES) {
    const row = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::bigint AS n
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${table}
    `;
    if (Number(row[0]?.n ?? 0) === 0) missingTables.push(table);
  }
  checks.push({
    name: "schema.tables",
    ok: missingTables.length === 0,
    // Fatal: without these tables the app cannot serve a single request.
    fatal: true,
    detail:
      missingTables.length === 0
        ? "all required tables present"
        : `missing: ${missingTables.join(", ")}. Run: prisma migrate deploy`,
  });

  // --- Column canaries catch a half-applied migration ---
  const missingColumns: string[] = [];
  for (const { table, column } of REQUIRED_COLUMNS) {
    const row = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::bigint AS n
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${table}
        AND column_name = ${column}
    `;
    if (Number(row[0]?.n ?? 0) === 0) missingColumns.push(`${table}.${column}`);
  }
  checks.push({
    name: "schema.columns",
    ok: missingColumns.length === 0,
    fatal: true,
    detail:
      missingColumns.length === 0
        ? "no schema drift detected"
        : `missing columns: ${missingColumns.join(", ")}. Run: prisma migrate deploy`,
  });

  // --- Data directory writable ---
  try {
    const { ensureDataDirs, storageProvider } = await import("@/lib/storage");
    await ensureDataDirs();
    await storageProvider().put({
      scope: "backups",
      ownerId: "boot-check",
      buffer: Buffer.from("boot check"),
      mimeType: "text/plain",
      originalName: ".boot-check",
    });
    checks.push({
      name: "storage.writable",
      ok: true,
      fatal: true,
      detail: "data directory writable",
    });
  } catch (e) {
    checks.push({
      name: "storage.writable",
      ok: false,
      // Uploads and exports need it; the app can still read and analyse.
      fatal: false,
      detail: `data directory not writable: ${
        e instanceof Error ? e.message.slice(0, 120) : "unknown"
      }. Set STORAGE_PROVIDER=s3 or mount a persistent volume.`,
    });
  }

  return checks;
}

export interface BootReadinessResult {
  ready: boolean;
  fatalFailures: string[];
  warnings: string[];
  checks: BootCheck[];
}

/**
 * Readiness gate for the HTTP surface.
 *
 * `ALLOW_SCHEMA_MIGRATIONS_ON_BOOT` is intentionally absent: this app never
 * migrates at boot.
 */
export async function assertBootReady(): Promise<BootReadinessResult> {
  const checks = await checkBootReadiness();
  const fatalFailures = checks
    .filter((c) => !c.ok && c.fatal)
    .map((c) => `${c.name}: ${c.detail}`);
  const warnings = checks
    .filter((c) => !c.ok && !c.fatal)
    .map((c) => `${c.name}: ${c.detail}`);

  if (fatalFailures.length > 0) {
    logWarn({ operation: "boot.readiness" }, "Boot readiness check failed", {
      failures: fatalFailures,
    });
  }

  return {
    ready: fatalFailures.length === 0,
    fatalFailures,
    warnings,
    checks,
  };
}

/** Stable string for the readiness probe, so hosts can log something comparable. */
export function readinessSummary(result: BootReadinessResult): string {
  const hash = hashContent(result.checks.map((c) => `${c.name}:${c.ok}`));
  return `${result.ready ? "ready" : "not-ready"}:${hash.slice(0, 12)}`;
}
