import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

/**
 * Creates (or re-grants) a Complete Edition demo account on a local database.
 *
 * Usage:
 *   npx tsx scripts/create-demo-account.ts <email> [name]
 *
 * The account is granted Complete Edition through the same manual entitlement
 * path the admin UI uses, so no payment provider is involved. Local-only helper:
 * it refuses to touch a database whose host is not loopback.
 */
const prisma = new PrismaClient();

const DEMO_PASSWORD =
  process.env.DEMO_ACCOUNT_PASSWORD ?? "acme-demo-password-2026";

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const name = (process.argv[3] ?? "Demo User").trim();

  if (!email || !email.includes("@")) {
    throw new Error("Usage: tsx scripts/create-demo-account.ts <email> [name]");
  }

  const url = process.env.DATABASE_URL ?? "";
  if (!/(127\.0\.0\.1|localhost)/.test(url)) {
    throw new Error(
      "Refusing to create a demo account against a non-local database. " +
        "This script is a local development convenience only.",
    );
  }

  const passwordHash = await hash(DEMO_PASSWORD, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      settings: { create: {} },
      profile: { create: { email, firstName: name.split(" ")[0] } },
    },
    update: { passwordHash },
  });

  // Idempotent grant: the entitlement table has a unique (source, externalEventId),
  // so re-running refreshes rather than duplicating.
  await prisma.entitlement.upsert({
    where: {
      source_externalEventId: {
        source: "MANUAL_ADMIN",
        externalEventId: `demo-grant-${user.id}`,
      },
    },
    create: {
      userId: user.id,
      source: "MANUAL_ADMIN",
      externalEventId: `demo-grant-${user.id}`,
      plan: "COMPLETE",
      status: "ACTIVE",
    },
    update: { status: "ACTIVE" },
  });

  console.log(`Complete Edition account ready for ${email}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
