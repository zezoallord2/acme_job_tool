import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";

/**
 * Keeps the boot-readiness canary list honest.
 *
 * Readiness deliberately checks for specific columns so a half-applied
 * migration fails loudly. The risk with a hand-maintained list is drift: rename
 * a field in the schema, forget the canary, and every deployment reports a
 * blocker that does not exist. These tests make that a build failure instead.
 */

const SCHEMA = readFileSync("prisma/schema.prisma", "utf8");

function modelBody(model: string): string {
  const start = SCHEMA.indexOf(`model ${model} {`);
  if (start === -1) throw new Error(`model ${model} not found in schema`);
  const end = SCHEMA.indexOf("\n}", start);
  return SCHEMA.slice(start, end);
}

describe("boot readiness canaries match the schema", () => {
  it("every required table exists in the Prisma schema", async () => {
    // Mirrors REQUIRED_TABLES in src/lib/boot-readiness.ts.
    const required = [
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
    for (const table of required) {
      expect(SCHEMA, `${table} must exist in schema.prisma`).toContain(
        `model ${table} {`,
      );
    }
  });

  it("every canary column exists in its model", async () => {
    const canaries: Array<[string, string]> = [
      ["Evidence", "verificationStatus"],
      ["Application", "version"],
      ["UserSettings", "notifyFollowUps"],
      ["EvidenceProposal", "confidence"],
      ["CareerNarrative", "userConfirmed"],
      ["VoiceProfile", "isDirect"],
    ];
    for (const [model, column] of canaries) {
      const body = modelBody(model);
      expect(body, `${model}.${column} must exist in schema.prisma`).toContain(
        column,
      );
    }
  });

  it("every canary column actually exists in the live database", async () => {
    // Guards against a migration that was never applied locally either.
    const canaries: Array<[string, string]> = [
      ["Evidence", "verificationStatus"],
      ["Application", "version"],
      ["UserSettings", "notifyFollowUps"],
      ["EvidenceProposal", "confidence"],
      ["CareerNarrative", "userConfirmed"],
      ["VoiceProfile", "isDirect"],
    ];
    for (const [table, column] of canaries) {
      const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(*)::bigint AS n
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${table}
          AND column_name = ${column}
      `;
      expect(
        Number(rows[0]?.n ?? 0),
        `${table}.${column} must exist in the database. Run: npm run db:deploy`,
      ).toBeGreaterThan(0);
    }
  });

  it("the source list and these tests agree", async () => {
    // Catches someone editing one list and not the other.
    const source = readFileSync("src/lib/boot-readiness.ts", "utf8");
    const declared = [
      ...source.matchAll(/table:\s*"(\w+)",\s*column:\s*"(\w+)"/g),
    ].map((m) => [m[1]!, m[2]!] as [string, string]);

    expect(declared.length).toBeGreaterThan(0);

    const here: Array<[string, string]> = [
      ["Evidence", "verificationStatus"],
      ["Application", "version"],
      ["UserSettings", "notifyFollowUps"],
      ["EvidenceProposal", "confidence"],
      ["CareerNarrative", "userConfirmed"],
      ["VoiceProfile", "isDirect"],
    ];
    expect(declared.sort()).toEqual(here.sort());
  });
});
