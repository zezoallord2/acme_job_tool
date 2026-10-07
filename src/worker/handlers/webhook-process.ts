import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { logInfo } from "@/lib/logger";
import type { ClaimedJob } from "@/queue/queue";

/**
 * Replays a previously failed billing webhook. Idempotent: the entitlement grant
 * is keyed on the external event id, so a replay cannot double-grant.
 */
export async function handleWebhookProcess(
  job: ClaimedJob,
): Promise<{ status: string }> {
  const webhookEventId = (job.payload as { webhookEventId: string })
    .webhookEventId;
  if (!webhookEventId)
    throw Errors.validation("Webhook job is missing an event id.");

  const record = await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
  });
  if (!record) throw Errors.notFound("Webhook event");
  if (record.status === "SUCCEEDED") {
    logInfo(
      { operation: "worker.webhook.skip" },
      "Webhook already processed; nothing to do",
      { webhookEventId },
    );
    return { status: "SUCCEEDED" };
  }
  if (record.errorCode === "USER_NOT_LINKED") {
    return { status: "SKIPPED_UNLINKED_USER" };
  }

  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });

  // Actual grant logic lives in the webhook route, which owns signature
  // verification. A replay here only re-queues for an operator-visible retry.
  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: {
      status: "QUEUED",
      errorCode: "REPLAY_REQUIRED",
      errorMessage:
        "Signature verification must happen in the request path. Operator action required.",
    },
  });

  return { status: "QUEUED" };
}

export async function handleDeadLetterReplay(
  job: ClaimedJob,
): Promise<{ requeued: string }> {
  const targetId = (job.payload as { targetJobId: string }).targetJobId;
  if (!targetId) throw Errors.validation("Replay job is missing a target id.");
  const { jobQueue } = await import("@/queue/queue");
  await jobQueue().requeue(targetId);
  return { requeued: targetId };
}
