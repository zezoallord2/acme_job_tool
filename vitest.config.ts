import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    pool: "forks",
    // Integration tests share one real database. Two suites that touch the
    // global WorkQueueItem table would otherwise race: `claim()` is deliberately
    // unscoped, because in production several workers are meant to share the
    // queue, so a parallel fork can steal another suite's job and fail it with
    // "job not found". Running files sequentially costs time and removes a
    // class of flaky, order-dependent failures.
    fileParallelism: false,
    maxWorkers: 1,
    env: {
      NODE_ENV: "test",
    },
  },
});
