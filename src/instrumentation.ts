/**
 * Next.js instrumentation.
 *
 * `register()` runs once when the server process starts, in both the app and the
 * worker, and not during `next build`. That makes it the correct place for the
 * production security gate: the build machine has no runtime secrets, but a
 * running server must refuse to serve traffic with them missing.
 *
 * Failing here is loud on purpose. A process that starts with a predictable
 * session secret looks healthy and is not, so it must never reach "listening".
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionConfigSafe } = await import("@/lib/env");
    assertProductionConfigSafe(process.env);

    // The worker is a server too, and it holds the same privileges.
    if (process.env.RUN_WORKER_INLINE === "true") {
      const { jobQueue } = await import("@/queue/queue");
      const { logInfo } = await import("@/lib/logger");
      logInfo(
        { operation: "boot.worker" },
        "Background worker running inside the web process",
      );
      void jobQueue();
    }
  }
}
