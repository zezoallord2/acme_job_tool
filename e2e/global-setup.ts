import { PrismaClient } from "@prisma/client";
import { startMockServices } from "./mock-services";

/**
 * E2E global setup.
 *
 * Clears rate-limit counters so a test run is not throttled by the security
 * limits that correctly protect a real deployment. Production limits are
 * unchanged: only test-run state is reset.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  // Mock AI + job feed for the AI journey spec. Returned teardown closes it.
  const mock = await startMockServices();
  const prisma = new PrismaClient();
  try {
    await prisma.rateLimitBucket.deleteMany({});

    // Specs create real users on every run. Without this they accumulated in
    // the dev database as `e2e-*@acme.test` rows. Only test accounts are
    // removed; the seeded demo accounts are left alone.
    const { count: removedUsers } = await prisma.user.deleteMany({
      where: { email: { endsWith: "@acme.test" } },
    });

    const users = await prisma.user.findMany({
      where: { email: { endsWith: "@acmejobs.local" } },
      select: { email: true },
    });
    if (users.length === 0) {
      console.warn(
        "E2E: seeded users not found. Run `npm run db:seed` before the E2E suite.",
      );
    }
    if (removedUsers > 0) {
      console.log(
        `E2E: removed ${removedUsers} leftover test account(s) from a previous run.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
  return () => new Promise<void>((resolve) => mock.close(() => resolve()));
}
