import { z } from "zod";
import { prisma, inTransaction } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { hashContent } from "@/lib/crypto";
import type { ResumeTemplate, SectionType } from "@prisma/client";

/**
 * Resume service: master resume, job-specific versions with lineage, section
 * content, bullets and immutable versions.
 */

export const RESUME_CONTENT_SCHEMA = z.object({
  contact: z
    .object({
      fullName: z.string().max(200).default(""),
      email: z.string().max(200).default(""),
      phone: z.string().max(60).default(""),
      location: z.string().max(200).default(""),
      linkedinUrl: z.string().max(300).default(""),
    })
    .default({
      fullName: "",
      email: "",
      phone: "",
      location: "",
      linkedinUrl: "",
    }),
  summary: z.string().max(4000).default(""),
  skills: z.array(z.string().max(80)).max(60).default([]),
  experiences: z
    .array(
      z.object({
        company: z.string().max(200).default(""),
        title: z.string().max(200).default(""),
        location: z.string().max(200).default(""),
        startDate: z.string().max(40).default(""),
        endDate: z.string().max(40).default(""),
        bullets: z.array(z.string().max(1000)).max(20).default([]),
      }),
    )
    .max(15)
    .default([]),
  projects: z
    .array(
      z.object({
        name: z.string().max(200).default(""),
        role: z.string().max(200).default(""),
        tech: z.array(z.string().max(80)).max(30).default([]),
        bullets: z.array(z.string().max(1000)).max(20).default([]),
      }),
    )
    .max(10)
    .default([]),
  education: z
    .array(
      z.object({
        institution: z.string().max(200).default(""),
        degree: z.string().max(200).default(""),
        field: z.string().max(200).default(""),
        startDate: z.string().max(40).default(""),
        endDate: z.string().max(40).default(""),
      }),
    )
    .max(6)
    .default([]),
  certifications: z
    .array(
      z.object({
        name: z.string().max(200),
        issuer: z.string().max(200).default(""),
        year: z.string().max(20).default(""),
      }),
    )
    .max(20)
    .default([]),
});

export type ResumeContent = z.infer<typeof RESUME_CONTENT_SCHEMA>;

const SECTION_FOR_KEY: Record<keyof ResumeContent, SectionType> = {
  contact: "CONTACT",
  summary: "SUMMARY",
  skills: "SKILLS",
  experiences: "EXPERIENCE",
  projects: "PROJECTS",
  education: "EDUCATION",
  certifications: "CERTIFICATIONS",
};

export async function ensureMasterResume(userId: string) {
  const existing = await prisma.resume.findFirst({
    where: { userId, isMaster: true },
  });
  if (existing) return existing;

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const career = await prisma.careerMasterProfile.findUnique({
    where: { userId },
  });
  const employments = await prisma.employmentRecord.findMany({
    where: { userId },
    orderBy: [{ startDate: "desc" }],
  });
  const skills = await prisma.skill.findMany({
    where: { userId },
    orderBy: [{ isCore: "desc" }, { name: "asc" }],
  });
  const education = await prisma.educationRecord.findMany({
    where: { userId },
    orderBy: { endDate: "desc" },
  });
  const projects = await prisma.project.findMany({
    where: { userId },
    take: 5,
  });
  const certifications = await prisma.certification.findMany({
    where: { userId },
  });

  const content = RESUME_CONTENT_SCHEMA.parse({
    contact: {
      fullName:
        [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "",
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
      location: [profile?.locationCity, profile?.locationCountry]
        .filter(Boolean)
        .join(", "),
      linkedinUrl: profile?.linkedinUrl ?? "",
    },
    summary: career?.professionalSummary ?? "",
    skills: skills.map((s) => s.name),
    experiences: employments.map((e) => ({
      company: e.companyName,
      title: e.jobTitle,
      location: e.location ?? "",
      startDate: e.startDate ? formatMonth(e.startDate) : "",
      endDate: e.isCurrent
        ? "Present"
        : e.endDate
          ? formatMonth(e.endDate)
          : "",
      bullets: e.highlights.slice(0, 5),
    })),
    projects: projects.map((p) => ({
      name: p.name,
      role: p.role ?? "",
      tech: p.techStack,
      bullets: p.outcomes ? [p.outcomes] : [],
    })),
    education: education.map((e) => ({
      institution: e.institution,
      degree: e.degree ?? "",
      field: e.fieldOfStudy ?? "",
      startDate: e.startDate ? formatMonth(e.startDate) : "",
      endDate: e.endDate ? formatMonth(e.endDate) : "",
    })),
    certifications: certifications.map((c) => ({
      name: c.name,
      issuer: c.issuer ?? "",
      year: c.issuedDate ? String(c.issuedDate.getUTCFullYear()) : "",
    })),
  });

  const resume = await prisma.resume.create({
    data: {
      userId,
      label: "Master Resume",
      template: "STANDARD_PROFESSIONAL",
      isMaster: true,
      currentVersion: 1,
      versions: {
        create: {
          version: 1,
          content: content as never,
          contentHash: hashContent(content),
        },
      },
    },
  });

  await prisma.resumeSection.createMany({
    data: (Object.keys(content) as Array<keyof ResumeContent>).map(
      (key, i) => ({
        resumeId: resume.id,
        type: SECTION_FOR_KEY[key],
        title: SECTION_TITLES[SECTION_FOR_KEY[key]],
        orderIndex: i,
        content: content[key] as never,
      }),
    ),
  });

  return resume;
}

const SECTION_TITLES: Record<SectionType, string> = {
  CONTACT: "Contact",
  SUMMARY: "Summary",
  SKILLS: "Skills",
  EXPERIENCE: "Experience",
  PROJECTS: "Projects",
  EDUCATION: "Education",
  CERTIFICATIONS: "Certifications",
  VOLUNTEER: "Volunteer Experience",
  PROJECTS_EXTRA: "Additional Projects",
  ADDITIONAL: "Additional",
};

function formatMonth(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function listResumes(userId: string) {
  return prisma.resume.findMany({
    where: { userId },
    orderBy: [{ isMaster: "desc" }, { updatedAt: "desc" }],
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
      job: { select: { company: true, title: true } },
    },
  });
}

export async function getResume(userId: string, resumeId: string) {
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId },
    include: {
      sections: { orderBy: { orderIndex: "asc" } },
      versions: { orderBy: { version: "desc" } },
      bullets: true,
      job: { select: { id: true, company: true, title: true } },
      application: { select: { id: true, status: true } },
    },
  });
  if (!resume) throw Errors.notFound("Resume");
  return resume;
}

export async function createJobVersion(input: {
  userId: string;
  jobId: string;
  applicationId?: string;
  label: string;
  template?: ResumeTemplate;
}) {
  const master = await ensureMasterResume(input.userId);
  const masterLatest = await prisma.resumeVersion.findFirst({
    where: { resumeId: master.id },
    orderBy: { version: "desc" },
  });
  const content = RESUME_CONTENT_SCHEMA.parse(masterLatest?.content ?? {});

  return inTransaction(async (tx) => {
    const created = await tx.resume.create({
      data: {
        userId: input.userId,
        label: input.label,
        template: input.template ?? "STANDARD_PROFESSIONAL",
        isMaster: false,
        parentId: master.id,
        jobId: input.jobId,
        applicationId: input.applicationId ?? null,
        currentVersion: 1,
        versions: {
          create: {
            version: 1,
            content: content as never,
            contentHash: hashContent(content),
          },
        },
      },
    });
    await tx.resumeSection.createMany({
      data: (Object.keys(content) as Array<keyof ResumeContent>).map(
        (key, i) => ({
          resumeId: created.id,
          type: SECTION_FOR_KEY[key],
          title: SECTION_TITLES[SECTION_FOR_KEY[key]],
          orderIndex: i,
          content: content[key] as never,
        }),
      ),
    });
    return created;
  });
}

/** Optimistic update: a stale `expectedVersion` produces a conflict, not a clobber. */
export async function updateResumeContent(input: {
  userId: string;
  resumeId: string;
  content: unknown;
  expectedVersion?: number;
  autosave?: boolean;
}) {
  const resume = await prisma.resume.findFirst({
    where: { id: input.resumeId, userId: input.userId },
  });
  if (!resume) throw Errors.notFound("Resume");

  if (
    input.expectedVersion !== undefined &&
    input.expectedVersion !== resume.currentVersion
  ) {
    throw Errors.conflict(
      "This resume changed since you last saved. Compare versions before saving.",
      {
        expectedVersion: input.expectedVersion,
        currentVersion: resume.currentVersion,
      },
    );
  }

  const parsed = RESUME_CONTENT_SCHEMA.safeParse(input.content);
  if (!parsed.success) {
    throw Errors.validation("Resume content is not valid.", {
      issues: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 6),
    });
  }
  const content = parsed.data;

  return inTransaction(async (tx) => {
    const nextVersion = resume.currentVersion + 1;
    const updated = await tx.resume.update({
      where: { id: resume.id },
      data: {
        currentVersion: nextVersion,
        versions: {
          create: {
            version: nextVersion,
            content: content as never,
            contentHash: hashContent(content),
            label: input.autosave ? "Autosave" : "Manual save",
          },
        },
      },
    });
    for (const key of Object.keys(content) as Array<keyof ResumeContent>) {
      await tx.resumeSection.updateMany({
        where: { resumeId: resume.id, type: SECTION_FOR_KEY[key] },
        data: {
          content: content[key] as never,
          title: SECTION_TITLES[SECTION_FOR_KEY[key]],
        },
      });
    }
    return updated;
  });
}

export async function resumeLineage(userId: string, masterId: string) {
  const master = await prisma.resume.findFirst({
    where: { id: masterId, userId },
  });
  if (!master) throw Errors.notFound("Resume");
  const children = await prisma.resume.findMany({
    where: { userId, parentId: masterId },
    orderBy: { createdAt: "desc" },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
      job: { select: { company: true, title: true } },
    },
  });
  const versions = await prisma.resumeVersion.findMany({
    where: { resumeId: masterId },
    orderBy: { version: "desc" },
  });
  return { master: { ...master, versions }, children };
}

export async function restoreResumeVersion(
  userId: string,
  resumeId: string,
  version: number,
) {
  const target = await prisma.resumeVersion.findFirst({
    where: { resumeId, version },
    include: { resume: { select: { userId: true, currentVersion: true } } },
  });
  if (!target || target.resume.userId !== userId)
    throw Errors.notFound("Resume version");
  const content = RESUME_CONTENT_SCHEMA.parse(target.content);
  return updateResumeContent({ userId, resumeId, content });
}

export async function markVersionSent(
  userId: string,
  resumeId: string,
  version: number,
) {
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId },
    select: { id: true },
  });
  if (!resume) throw Errors.notFound("Resume");
  return prisma.resumeVersion.updateMany({
    where: { resumeId, version },
    data: { isSent: true },
  });
}

export async function attachResumeToApplication(
  userId: string,
  resumeId: string,
  applicationId: string,
) {
  const [resume, app] = await Promise.all([
    prisma.resume.findFirst({
      where: { id: resumeId, userId },
      select: { id: true, jobId: true },
    }),
    prisma.application.findFirst({
      where: { id: applicationId, userId },
      select: { id: true },
    }),
  ]);
  if (!resume) throw Errors.notFound("Resume");
  if (!app) throw Errors.notFound("Application");
  await prisma.resume.update({
    where: { id: resumeId },
    data: { applicationId },
  });
}

export function flattenResumeText(content: ResumeContent): string {
  const lines: string[] = [];
  if (content.contact.fullName) lines.push(content.contact.fullName);
  if (content.contact.email) lines.push(content.contact.email);
  if (content.contact.location) lines.push(content.contact.location);
  if (content.summary) lines.push(content.summary);
  if (content.skills.length) lines.push(content.skills.join(", "));
  for (const e of content.experiences) {
    lines.push(`${e.title} at ${e.company}`);
    lines.push(...e.bullets);
  }
  for (const p of content.projects) {
    lines.push(p.name);
    lines.push(...p.bullets);
  }
  for (const e of content.education)
    lines.push(`${e.degree} ${e.field} — ${e.institution}`);
  for (const c of content.certifications) lines.push(`${c.name} ${c.issuer}`);
  return lines.join("\n");
}
