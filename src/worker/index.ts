import { randomUUID } from "node:crypto";
import { jobQueue } from "@/queue/queue";
import { runWorker, runMaintenance } from "./runner";
import { env } from "@/lib/env";
import { logInfo, logError } from "@/lib/logger";
import { disconnectDb } from "@/lib/db";

/**
 * Local worker process. Runs as an ordinary Node process — no paid worker
 * platform required. `npm run worker`.
 */
async function main(): Promise<void> {
  const workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
  const queue = jobQueue();

  const shutdown = async (signal: string) => {
    logInfo({ operation: "worker.shutdown" }, `Received ${signal}; stopping`);
    await runMaintenance().catch(() => undefined);
    await disconnectDb().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  logInfo({ operation: "worker.boot" }, "Acme Jobs worker", {
    queue: queue.name,
    pollIntervalMs: env().QUEUE_POLL_INTERVAL_MS,
    zeroCostMode: env().ZERO_COST_MODE,
  });

  await runWorker({
    queue,
    workerId,
    pollIntervalMs: env().QUEUE_POLL_INTERVAL_MS,
  });
}

main().catch((e) => {
  logError({ operation: "worker.fatal" }, "Worker crashed");
  console.error(e);
  process.exit(1);
});
