/**
 * Seed: FREE and PAID demo users plus baseline operational data.
 *
 * Both demo accounts exist so every paid feature can be developed and tested at
 * $0 — entitlement is granted through ManualAdminEntitlementProvider, which needs
 * no payment provider.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "acme-demo-password-2026";

async function upsertUser(input: {
  email: string;
  name: string;
  isAdmin?: boolean;
  complete: boolean;
}): Promise<string> {
  const passwordHash = await hash(DEMO_PASSWORD, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      name: input.name,
      passwordHash,
      isAdmin: input.isAdmin ?? false,
      settings: { create: {} },
      profile: {
        create: {
          email: input.email,
          firstName: input.name.split(" ")[0],
          lastName: input.name.split(" ")[1] ?? null,
        },
      },
      onboardings: { create: {} },
    },
    update: { name: input.name, passwordHash, isAdmin: input.isAdmin ?? false },
    select: { id: true },
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, aiProvider: "ACME_BASIC" },
    update: { aiProvider: "ACME_BASIC" },
  });
  await prisma.onboardingProgress
    .upsert({
      where: {
        id:
          (
            await prisma.onboardingProgress.findFirst({
              where: { userId: user.id },
              select: { id: true },
            })
          )?.id ?? "x",
      },
      create: { userId: user.id },
      update: {},
    })
    .catch(async () => {
      const existing = await prisma.onboardingProgress.findFirst({
        where: { userId: user.id },
      });
      if (!existing)
        await prisma.onboardingProgress.create({ data: { userId: user.id } });
    });

  if (input.complete) {
    const existingGrant = await prisma.entitlement.findFirst({
      where: { userId: user.id, plan: "COMPLETE", status: "ACTIVE" },
      select: { id: true },
    });
    if (!existingGrant) {
      await prisma.entitlement.create({
        data: {
          userId: user.id,
          plan: "COMPLETE",
          status: "ACTIVE",
          source: "MANUAL_ADMIN",
          externalEventId: `seed:${user.id}`,
        },
      });
    }
  }

  return user.id;
}

async function seedFreeUser(userId: string): Promise<void> {
  await prisma.careerMasterProfile.upsert({
    where: { userId },
    create: {
      userId,
      targetRolePrimary: "Data Analyst",
      targetIndustry: "Technology",
      yearsExperience: 0,
      isCareerChanger: false,
      currentSituation:
        "Final-year undergraduate looking for a first analyst role.",
      primaryGoal: "IMPROVE_RESUME",
      professionalSummary:
        "Final-year undergraduate with an internship in customer operations reporting, hands-on Excel work and a university analytics project.",
    },
    update: {},
  });

  await prisma.userProfile.update({
    where: { userId },
    data: {
      phone: "+44 20 7946 0000",
      locationCity: "Manchester",
      linkedinUrl: "https://linkedin.com/in/example",
    },
  });

  await prisma.employmentRecord.create({
    data: {
      userId,
      companyName: "Northwind Services",
      jobTitle: "Operations Intern",
      location: "Manchester",
      startDate: new Date("2025-06-01"),
      endDate: new Date("2025-09-01"),
      highlights: [
        "Built and updated the weekly Excel report used by the operations team.",
        "Handled approximately 40 support tickets per day.",
      ],
    },
  });

  await prisma.educationRecord.create({
    data: {
      userId,
      institution: "University of Manchester",
      degree: "BSc",
      fieldOfStudy: "Business Analytics",
      startDate: new Date("2022-09-01"),
      endDate: new Date("2025-06-01"),
    },
  });

  for (const name of ["Excel", "Reporting", "Data Analysis", "Power BI"]) {
    await prisma.skill.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name, isCore: true, category: "analytics" },
      update: {},
    });
  }

  await prisma.project.create({
    data: {
      userId,
      name: "University retail analytics project",
      role: "Analyst",
      techStack: ["Excel", "Python"],
      outcomes:
        "Built a Python pipeline that cleaned 12 months of transaction data and produced a weekly dashboard.",
    },
  });

  const evidence = [
    {
      statement:
        "Built and updated the weekly Excel report used by the operations team.",
      claimType: "ACHIEVEMENT" as const,
      sourceType: "EMPLOYMENT" as const,
      metricValue: 1,
      metricUnit: "weekly report",
      tags: ["excel", "reporting", "operations"],
    },
    {
      statement: "Handled approximately 40 support tickets per day.",
      claimType: "RESPONSIBILITY" as const,
      sourceType: "EMPLOYMENT" as const,
      metricValue: 40,
      metricUnit: "tickets/day",
      tags: ["customer support", "operations"],
    },
    {
      statement:
        "Supported a five-person project team by preparing the weekly status pack.",
      claimType: "RESPONSIBILITY" as const,
      sourceType: "PROJECT" as const,
      metricValue: 5,
      metricUnit: "people",
      tags: ["teamwork", "reporting"],
    },
  ];

  for (const e of evidence) {
    const exists = await prisma.evidence.findFirst({
      where: { userId, statement: e.statement },
    });
    if (exists) continue;
    await prisma.evidence.create({
      data: {
        userId,
        statement: e.statement,
        claimType: e.claimType,
        sourceType: e.sourceType,
        sourceDescription: "Northwind Services internship",
        verificationStatus: "USER_CONFIRMED",
        confidenceCategory: "MEDIUM",
        metricValue: e.metricValue,
        metricUnit: e.metricUnit,
        metricStatus: "USER_ESTIMATE",
        tags: e.tags,
        lastConfirmedAt: new Date(),
      },
    });
  }

  // Deliberately unverified record: proves missing evidence stays missing.
  await prisma.evidence
    .create({
      data: {
        userId,
        statement: "Increased revenue by 30%.",
        claimType: "ACHIEVEMENT" as never,
        sourceType: "USER_STATEMENT" as never,
        sourceDescription:
          "Recalled during a previous search, no supporting record",
        verificationStatus: "UNVERIFIED",
        confidenceCategory: "LOW",
        tags: ["revenue"],
      },
    })
    .catch(() => undefined);

  const freeStoryTitle = "Rebuilt the weekly operations report";
  const freeStory = await prisma.starStory.findFirst({
    where: { userId, title: freeStoryTitle },
    select: { id: true },
  });
  if (!freeStory) {
    await prisma.starStory.create({
      data: {
        userId,
        title: freeStoryTitle,
        category: "ACHIEVEMENT",
        situation:
          "The operations team ran the week from a report that took two days to assemble.",
        task: "I had to make the weekly numbers available at the start of the week.",
        action:
          "I rebuilt the report in Excel, automating the extract and the formatting.",
        result:
          "The team had the numbers on Monday morning instead of Wednesday.",
        evidenceIds: [],
        strength: "PARTIAL",
      },
    });
  }
}

async function seedPaidUser(userId: string): Promise<void> {
  await prisma.careerMasterProfile.upsert({
    where: { userId },
    create: {
      userId,
      targetRolePrimary: "Analytics Engineer",
      targetRoleSecondary: "Data Analyst",
      targetIndustry: "Finance technology",
      yearsExperience: 4,
      isCareerChanger: true,
      careerChangeFrom: "Accounting",
      careerChangeTo: "Analytics",
      currentSituation: "Four years in accounting, moving into analytics.",
      primaryGoal: "BETTER_TARGETING",
      professionalSummary:
        "Accountant moving into analytics. Built reporting and automation in finance, and completed a data analysis programme.",
    },
    update: {},
  });

  await prisma.userProfile.update({
    where: { userId },
    data: {
      phone: "+44 20 7946 0011",
      locationCity: "London",
      linkedinUrl: "https://linkedin.com/in/example-paid",
    },
  });

  await prisma.employmentRecord.create({
    data: {
      userId,
      companyName: "Halden Group",
      jobTitle: "Financial Analyst",
      location: "London",
      startDate: new Date("2022-03-01"),
      endDate: new Date("2024-02-01"),
      highlights: [
        "Rebuilt the month-end reporting pack, cutting preparation time from five days to two.",
        "Introduced Power Query automation across four reporting workbooks.",
      ],
    },
  });

  await prisma.certification.create({
    data: {
      userId,
      name: "ACCA Level 2",
      issuer: "ACCA",
      issuedDate: new Date("2023-06-01"),
    },
  });

  for (const name of [
    "Excel",
    "Power Query",
    "Power BI",
    "SQL",
    "Financial Reporting",
  ]) {
    await prisma.skill.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name, isCore: name === "Excel", category: "analytics" },
      update: {},
    });
  }

  const evidenceRows = [
    {
      statement:
        "Rebuilt the month-end reporting pack, cutting preparation time from five days to two.",
      claimType: "ACHIEVEMENT" as const,
      metricValue: 5,
      metricUnit: "days saved",
      tags: ["reporting", "automation"],
    },
    {
      statement:
        "Introduced Power Query automation across four reporting workbooks.",
      claimType: "ACHIEVEMENT" as const,
      metricValue: 4,
      metricUnit: "workbooks",
      tags: ["power query", "automation"],
    },
    {
      statement: "Wrote SQL queries against a PostgreSQL reporting database.",
      claimType: "SKILL" as const,
      metricValue: null,
      metricUnit: null,
      tags: ["sql", "postgresql"],
    },
    {
      statement:
        "Delivered a stakeholder briefing on cost variance every month.",
      claimType: "RESPONSIBILITY" as const,
      metricValue: 12,
      metricUnit: "briefings/year",
      tags: ["communication", "finance"],
    },
  ];

  for (const e of evidenceRows) {
    const exists = await prisma.evidence.findFirst({
      where: { userId, statement: e.statement },
    });
    if (exists) continue;
    await prisma.evidence.create({
      data: {
        userId,
        statement: e.statement,
        claimType: e.claimType,
        sourceType: "EMPLOYMENT",
        sourceDescription: "Halden Group, Financial Analyst",
        verificationStatus: "VERIFIED",
        confidenceCategory: "HIGH",
        metricValue: e.metricValue,
        metricUnit: e.metricUnit,
        metricStatus: e.metricValue === null ? "NOT_APPLICABLE" : "VERIFIED",
        tags: e.tags,
        lastConfirmedAt: new Date(),
      },
    });
  }

  const paidStories = [
    {
      userId,
      title: "Cut month-end reporting time by three days",
      category: "ACHIEVEMENT",
      situation:
        "Month-end reporting took five days and blocked the wider team.",
      task: "I owned reducing that time without losing accuracy.",
      action:
        "I automated the four workbooks with Power Query and restructured the pack.",
      result:
        "Preparation fell from five days to two, and the pack was issued a day earlier.",
      evidenceIds: [],
      strength: "STRONG",
    },
    {
      userId,
      title: "Moved from accounting into analytics",
      category: "LEARNING",
      situation:
        "I wanted to move from accounting into analytics without starting again.",
      task: "I needed credible proof I could do analytics work.",
      action:
        "I completed a data analysis programme and rebuilt my reporting in SQL and Power Query.",
      result:
        "I now describe a continuous path from accounting into analytics rather than a change of field.",
      evidenceIds: [],
      strength: "STRONG",
    },
  ] satisfies Prisma.StarStoryCreateManyInput[];
  for (const story of paidStories) {
    const exists = await prisma.starStory.findFirst({
      where: { userId, title: story.title },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.starStory.create({ data: story });
  }
}

async function seedOperations(): Promise<void> {
  await prisma.featureFlag.upsert({
    where: { key: "ai_workflow_resume_bullet_v8" },
    create: {
      key: "ai_workflow_resume_bullet_v8",
      name: "Resume bullet prompt v8 candidate",
      description:
        "Candidate prompt under evaluation. Measured against v7 before promotion.",
      state: "OFF",
      category: "prompt",
    },
    update: {},
  });

  await prisma.featureFlag.upsert({
    where: { key: "daily_priority_v2" },
    create: {
      key: "daily_priority_v2",
      name: "Daily Priority Engine v2",
      description: "Revised ranking weights. Experiment on presentation only.",
      state: "ON",
      category: "ui",
      rolloutPercent: 100,
    },
    update: {},
  });

  await prisma.promptCandidate.upsert({
    where: {
      identifier_version: { identifier: "RESUME_BULLET_PROMPT", version: 8 },
    },
    create: {
      identifier: "RESUME_BULLET_PROMPT",
      version: 8,
      status: "CANDIDATE",
      content: {
        note: "Stricter unsupportedAspects reporting; candidate for evaluation.",
      } as never,
      contentHash: "seed-resume-bullet-v8",
      rationale:
        "Hypothesis: forcing explicit unsupportedAspects reduces the unsupported claim rate.",
      basedOnVersion: 7,
      evaluationVersion: "AI_EVAL_v2",
    },
    update: {},
  });

  await prisma.promptCandidate.upsert({
    where: {
      identifier_version: { identifier: "JOB_ANALYSIS_PROMPT", version: 5 },
    },
    create: {
      identifier: "JOB_ANALYSIS_PROMPT",
      version: 5,
      status: "CANDIDATE",
      content: { note: "Adds dealBreakers extraction improvements." } as never,
      contentHash: "seed-job-analysis-v5",
      rationale:
        "Hypothesis: clearer deal-breaker detection improves skip recommendations.",
      basedOnVersion: 4,
      evaluationVersion: "AI_EVAL_v2",
    },
    update: {},
  });

  await prisma.releaseRecord.upsert({
    where: { id: "seed-release" },
    create: {
      id: "seed-release",
      appVersion: "1.0.0",
      schemaVersion: "1",
      status: "RELEASED",
      releasedAt: new Date(),
      promptVersions: {
        JOB_ANALYSIS: "v4",
        RESUME_BULLET: "v7",
        RESUME_TAILORING: "v6",
      } as never,
      featureFlags: { daily_priority_v2: "ON" } as never,
      notes: "Zero-cost release. AI is on by default via the hosted free tier.",
    },
    update: {},
  });

  await prisma.systemError.create({
    data: {
      severity: "INFO",
      category: "CONFIGURATION",
      code: "AI_PROVIDER_NOT_CONFIGURED",
      message:
        "No AI provider configured; Manual Mode is the default path. This is expected in zero-cost mode.",
      affectedWorkflow: "ai:resolve",
      service: "seed",
      resolutionStatus: "IGNORED",
    },
  });
}

async function main(): Promise<void> {
  const freeId = await upsertUser({
    email: "free@acmejobs.local",
    name: "Fiona Free",
    complete: false,
  });
  await seedFreeUser(freeId);

  const paidId = await upsertUser({
    email: "paid@acmejobs.local",
    name: "Priyank Paid",
    complete: true,
  });
  await seedPaidUser(paidId);

  const adminId = await upsertUser({
    email: "admin@acmejobs.local",
    name: "Avery Admin",
    isAdmin: true,
    complete: true,
  });
  await prisma.userSettings.update({
    where: { userId: adminId },
    data: { aiProvider: "MANUAL" },
  });

  await seedOperations();

  console.log("Seed complete.");
  console.log(`  FREE  user: free@acmejobs.local  / ${DEMO_PASSWORD}`);
  console.log(`  PAID  user: paid@acmejobs.local  / ${DEMO_PASSWORD}`);
  console.log(`  ADMIN user: admin@acmejobs.local / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
