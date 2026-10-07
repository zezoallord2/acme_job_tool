import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { runWorkflow } from "@/workflows/runner";
import { logInfo } from "@/lib/logger";
import type { WorkflowId } from "@/ai/workflow-ids";
import { WORKFLOW_IDS } from "@/ai/workflow-ids";
import type { ClaimedJob } from "@/queue/queue";

/**
 * Background AI workflow. Runs the same validation pipeline as the interactive
 * path. When no provider is available the job records that Manual Mode is
 * required rather than pretending to have produced output.
 */
export async function handleAiWorkflow(
  job: ClaimedJob,
): Promise<{ interactionId: string; manual: boolean }> {
  const { userId, workflowId, context, interactionId } = job.payload as {
    userId: string;
    workflowId: WorkflowId;
    context: Record<string, unknown>;
    interactionId?: string;
  };

  if (!WORKFLOW_IDS.includes(workflowId)) {
    throw Errors.validation(`Unknown AI workflow: ${workflowId}`);
  }

  const evidence = await prisma.evidence
    .findMany({
      where: {
        userId,
        verificationStatus: { in: ["VERIFIED", "USER_CONFIRMED"] },
      },
    })
    .then((rows) =>
      rows.map((r) => ({
        id: r.id,
        statement: r.statement,
        claimType: r.claimType,
        verificationStatus: r.verificationStatus,
        confidenceCategory: r.confidenceCategory,
        metricValue: r.metricValue,
        metricUnit: r.metricUnit,
        metricStatus: r.metricStatus,
        sourceType: r.sourceType,
        sourceDescription: r.sourceDescription,
        tags: r.tags,
      })),
    );

  const outcome = await runWorkflow({
    userId,
    workflowId,
    context: context ?? {},
    evidence,
    preferManual: true,
    traceId: job.traceId ?? undefined,
  });

  if (!outcome.ok) {
    logInfo(
      { operation: "worker.ai.manual-required" },
      "AI workflow requires Manual Mode",
      {
        workflowId,
        code: outcome.code,
        userId,
      },
    );
    return {
      interactionId: outcome.interactionId ?? interactionId ?? "",
      manual: true,
    };
  }

  return { interactionId: outcome.interactionId, manual: false };
}
