import { runIntegrityChecks } from "../src/services/integrity-service";
import { prisma } from "../src/lib/db";

/**
 * Integrity gate.
 *
 *   npm run integrity:check
 *
 * Read-only by default: it reports problems and never changes data, because
 * automatic repair is refused outside development.
 */

async function main(): Promise<void> {
  const started = Date.now();

  const result = await runIntegrityChecks({
    allowRepair: false,
    triggeredBy: "cli:integrity-check",
  });

  // CRITICAL and ERROR block a release; WARNING and INFO are advisory.
  const blocking = result.issues.filter(
    (i) => i.severity === "CRITICAL" || i.severity === "ERROR",
  );
  const warnings = result.issues.filter(
    (i) => i.severity !== "CRITICAL" && i.severity !== "ERROR",
  );

  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const issue of warnings.slice(0, 50)) {
      console.log(
        `  [${issue.severity}] ${issue.checkName} -> ${issue.entityType}:${issue.entityId} ${issue.issueType}`,
      );
      console.log(`      ${issue.detail}`);
    }
  }

  if (blocking.length > 0) {
    console.log(`\nBlocking issues (${blocking.length}):`);
    for (const issue of blocking.slice(0, 50)) {
      console.log(
        `  [${issue.severity}] ${issue.checkName} -> ${issue.entityType}:${issue.entityId} ${issue.issueType}`,
      );
      console.log(`      ${issue.detail}`);
      console.log(`      autoRepairable: ${issue.autoRepairable}`);
    }
    console.log(
      `\nINTEGRITY FAILED in ${Date.now() - started}ms (${result.issues.length} issues, 0 auto-repaired).`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\nINTEGRITY OK in ${Date.now() - started}ms (${warnings.length} warnings, 0 auto-repaired).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Integrity check failed to run:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
