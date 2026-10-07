import { prisma } from "@/lib/db";
import { runIntegrityChecks } from "@/services/integrity-service";
import { logInfo } from "@/lib/logger";
import type { ClaimedJob } from "@/queue/queue";
import type { SystemErrorSeverity } from "@prisma/client";

export async function handleIntegrityCheck(job: ClaimedJob): Promise<{
  issues: number;
  autoRepaired: number;
}> {
  const started = Date.now();
  const result = await runIntegrityChecks({
    // Repair runs only outside production. This is enforced server-side, not by
    // trusting the caller.
    allowRepair: process.env.NODE_ENV !== "production",
    triggeredBy: "queue",
  });

  logInfo({ operation: "worker.integrity" }, "Integrity check completed", {
    issues: result.issues.length,
    autoRepaired: result.autoRepaired,
    durationMs: Date.now() - started,
    traceId: job.traceId ?? undefined,
  });

  if (result.issues.length > 0) {
    const worst = result.issues.reduce<SystemErrorSeverity>(
      (acc, i) =>
        i.severity === "CRITICAL" || acc === "CRITICAL"
          ? "CRITICAL"
          : i.severity,
      "INFO",
    );
    await prisma.systemError.create({
      data: {
        traceId: job.traceId ?? null,
        severity: worst,
        category: "INTEGRITY",
        code: "INTEGRITY_ISSUES_FOUND",
        message: `${result.issues.length} data integrity issue(s) detected`,
        affectedWorkflow: "integrity:check",
        service: "worker",
        sanitizedContext: { issues: result.issues.slice(0, 20) } as never,
      },
    });
  }

  return { issues: result.issues.length, autoRepaired: result.autoRepaired };
}
