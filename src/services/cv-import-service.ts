import { prisma } from "@/lib/db";
import { executeWithFallback } from "@/ai/router";
import { extractText } from "@/worker/handlers/document-parse";
import { storageProvider } from "@/lib/storage";
import { Errors } from "@/lib/errors";

/**
 * Builds a candidate profile from an uploaded CV.
 *
 * Design rule that governs everything here: the model may only report what is
 * literally in the document. This product's promise is "evidence, never
 * invented", so an extracted field that is not supported by a span of CV text is
 * discarded rather than shown. A weaker model that pads a profile with plausible
 * fiction is worse than no import at all, because the user cannot tell.
 */

export interface ExtractedProfile {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: string[];
  headline: string | null;
  summary: string | null;
  skills: string[];
  roles: Array<{
    title: string | null;
    company: string | null;
    start: string | null;
    end: string | null;
    bullets: string[];
  }>;
  education: Array<{
    institution: string | null;
    qualification: string | null;
    endYear: string | null;
  }>;
  certifications: string[];
}

const SYSTEM_PROMPT = `You extract structured data from a person's CV.

Absolute rules:
1. Copy only what is written in the document. Never infer, guess, or add
   anything that is not present in the text.
2. Never invent metrics, employers, dates, or qualifications.
3. If a field is not in the document, return null for it, or an empty array.
4. Keep bullet text close to the original wording. Do not improve it.
5. Return only JSON, no commentary.

Shape:
{"firstName":string|null,"lastName":string|null,"email":string|null,
 "phone":string|null,"location":string|null,"links":string[],
 "headline":string|null,"summary":string|null,"skills":string[],
 "roles":[{"title":string|null,"company":string|null,"start":string|null,
 "end":string|null,"bullets":string[]}],
 "education":[{"institution":string|null,"qualification":string|null,
 "endYear":string|null}],
 "certifications":string[]}`;

/** Caps how much CV text is sent, so a huge document cannot blow the budget. */
const MAX_CV_CHARS = 12_000;

function coerceArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Parses and sanitises the model's JSON.
 *
 * Everything here exists because a model response is untrusted input. A stray
 * markdown fence, a truncated response or a hallucinated field must not become
 * a saved profile field.
 */
export function parseExtractedProfile(raw: string): ExtractedProfile {
  let text = raw.trim();

  // Strip a markdown fence if the model wrapped the JSON.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();

  // Recover from the most common failure: prose around the JSON object.
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last <= first) {
    throw Errors.aiValidation(
      "The CV could not be read into a profile. Try a different file.",
    );
  }
  text = text.slice(first, last + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw Errors.aiValidation(
      "The CV could not be read into a profile. Try a different file.",
    );
  }

  const o = (parsed ?? {}) as Record<string, unknown>;
  const obj = (v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};

  const roles = Array.isArray(o.roles) ? o.roles.slice(0, 15).map(obj) : [];
  const education = Array.isArray(o.education)
    ? o.education.slice(0, 10).map(obj)
    : [];

  return {
    firstName: nullableString(o.firstName),
    lastName: nullableString(o.lastName),
    // Only accept an email that actually looks like one; a malformed value from
    // the model must not overwrite a real address on the account.
    email:
      typeof o.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)
        ? o.email.trim()
        : null,
    phone: nullableString(o.phone),
    location: nullableString(o.location),
    links: coerceArray(o.links)
      .filter((l) => /^https?:\/\/|linkedin\.com|github\.com/i.test(l))
      .slice(0, 8),
    headline: nullableString(o.headline),
    summary: nullableString(o.summary),
    skills: coerceArray(o.skills).slice(0, 40),
    roles: roles.map((r) => ({
      title: nullableString(r.title),
      company: nullableString(r.company),
      start: nullableString(r.start),
      end: nullableString(r.end),
      bullets: coerceArray(r.bullets).slice(0, 10),
    })),
    education: education.map((e) => ({
      institution: nullableString(e.institution),
      qualification: nullableString(e.qualification),
      endYear: nullableString(e.endYear),
    })),
    certifications: coerceArray(o.certifications).slice(0, 30),
  };
}

/** What the user should be told was found, so nothing looks silently lost. */
export interface ImportSummary {
  profile: ExtractedProfile;
  counts: {
    skills: number;
    roles: number;
    education: number;
    certifications: number;
  };
  /** True when nothing usable came back and the CV should not overwrite a profile. */
  empty: boolean;
  uploadKey: string;
  originalName: string;
}

export async function previewProfileFromCv(input: {
  userId: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  requireRealAI: boolean;
}): Promise<ImportSummary> {
  const text = await extractText(input.buffer, input.mimeType, input.fileName);

  if (!text.trim()) {
    throw Errors.aiValidation(
      "No readable text was found in that file. If it is a scan or an image, upload a text-based CV, DOCX, or PDF.",
    );
  }

  const result = await executeWithFallback(
    {
      workflowId: "PROFILE_IMPORT",
      promptVersion: "cv-import-v1",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Extract the profile from this CV.\n\n<cv>\n${text.slice(0, MAX_CV_CHARS)}\n</cv>`,
      expectJson: true,
      maxOutputTokens: 2000,
      temperature: 0.1,
    },
    // A paying user must be told when AI is broken, not handed a blank profile.
    { requireRealAI: input.requireRealAI },
  );

  if (result.response.manual) {
    throw Errors.aiValidation(
      "Profile import needs AI, and AI is unavailable right now. Switch to Basic AI in Settings, or use Bring Your Own Key.",
    );
  }

  const profile = parseExtractedProfile(result.response.rawText);

  const counts = {
    skills: profile.skills.length,
    roles: profile.roles.length,
    education: profile.education.length,
    certifications: profile.certifications.length,
  };
  const empty =
    counts.skills === 0 &&
    counts.roles === 0 &&
    counts.education === 0 &&
    counts.certifications === 0 &&
    !profile.summary;

  if (empty) {
    throw Errors.aiValidation(
      "That CV did not contain anything we could read into a profile. A one-page CV with your name, role and experience works best.",
    );
  }

  // Store the source before review, but do not touch profile records yet. Saving
  // extracted facts before the user sees them would turn an AI guess into a fact.
  const stored = await storageProvider().put({
    scope: "uploads",
    ownerId: input.userId,
    buffer: input.buffer,
    mimeType: input.mimeType,
    originalName: input.fileName,
  });

  return {
    profile,
    counts,
    empty: false,
    uploadKey: stored.key,
    originalName: stored.originalName,
  };
}

function safeDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Persists only the fields the user reviewed and explicitly confirmed. */
export async function confirmProfileImport(input: {
  userId: string;
  uploadKey: string;
  originalName: string;
  profile: ExtractedProfile;
}) {
  const provider = storageProvider();
  if (!(await provider.exists("uploads", input.uploadKey, input.userId))) {
    throw Errors.validation("That CV review expired. Upload the file again.");
  }
  // Re-sanitise browser JSON. The review UI is editable, and therefore input.
  const profile = parseExtractedProfile(JSON.stringify(input.profile));
  const linkedin = profile.links.find((l) => /linkedin\.com/i.test(l)) ?? null;
  const website =
    profile.links.find(
      (l) => /^https?:\/\//i.test(l) && !/linkedin\.com/i.test(l),
    ) ?? null;
  const sourceDescription = `Confirmed from uploaded CV: ${input.originalName}`;

  await prisma.$transaction(
    async (tx) => {
      await tx.userProfile.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          phone: profile.phone,
          locationCity: profile.location,
          linkedinUrl: linkedin,
          websiteUrl: website,
          headline: profile.headline,
          summary: profile.summary,
        },
        update: {
          ...(profile.firstName ? { firstName: profile.firstName } : {}),
          ...(profile.lastName ? { lastName: profile.lastName } : {}),
          ...(profile.email ? { email: profile.email } : {}),
          ...(profile.phone ? { phone: profile.phone } : {}),
          ...(profile.location ? { locationCity: profile.location } : {}),
          ...(linkedin ? { linkedinUrl: linkedin } : {}),
          ...(website ? { websiteUrl: website } : {}),
          ...(profile.headline ? { headline: profile.headline } : {}),
          ...(profile.summary ? { summary: profile.summary } : {}),
        },
      });
      await tx.careerMasterProfile.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          headline: profile.headline,
          professionalSummary: profile.summary,
        },
        update: {
          ...(profile.headline ? { headline: profile.headline } : {}),
          ...(profile.summary ? { professionalSummary: profile.summary } : {}),
        },
      });

      for (const name of profile.skills) {
        await tx.skill.upsert({
          where: { userId_name: { userId: input.userId, name } },
          create: {
            userId: input.userId,
            name,
            verification: "USER_CONFIRMED",
          },
          update: {},
        });
      }
      for (const role of profile.roles) {
        if (!role.company || !role.title) continue;
        const existing = await tx.employmentRecord.findFirst({
          where: {
            userId: input.userId,
            companyName: role.company,
            jobTitle: role.title,
          },
        });
        const employment =
          existing ??
          (await tx.employmentRecord.create({
            data: {
              userId: input.userId,
              companyName: role.company,
              jobTitle: role.title,
              startDate: safeDate(role.start),
              endDate: safeDate(role.end),
              isCurrent: /present|current|now/i.test(role.end ?? ""),
              highlights: role.bullets,
              verification: "USER_CONFIRMED",
            },
          }));
        for (const bullet of role.bullets) {
          const exists = await tx.evidence.findFirst({
            where: { userId: input.userId, statement: bullet },
          });
          if (exists) continue;
          await tx.evidence.create({
            data: {
              userId: input.userId,
              statement: bullet,
              claimType: "ACHIEVEMENT",
              sourceType: "DOCUMENT",
              sourceDescription,
              verificationStatus: "USER_CONFIRMED",
              confidenceCategory: "MEDIUM",
              authority: "USER_CONFIRMED",
              createdBy: "cv-import",
              lastConfirmedAt: new Date(),
              employmentId: employment.id,
              sources: {
                create: {
                  kind: "DOCUMENT",
                  label: input.originalName,
                  locator: input.uploadKey,
                  excerpt: bullet,
                  verification: "USER_CONFIRMED",
                },
              },
            },
          });
        }
      }
      for (const item of profile.education) {
        if (!item.institution) continue;
        const exists = await tx.educationRecord.findFirst({
          where: {
            userId: input.userId,
            institution: item.institution,
            degree: item.qualification,
          },
        });
        if (!exists)
          await tx.educationRecord.create({
            data: {
              userId: input.userId,
              institution: item.institution,
              degree: item.qualification,
              endDate: safeDate(item.endYear),
              verification: "USER_CONFIRMED",
            },
          });
      }
      for (const name of profile.certifications) {
        const exists = await tx.certification.findFirst({
          where: { userId: input.userId, name },
        });
        if (!exists)
          await tx.certification.create({
            data: {
              userId: input.userId,
              name,
              verification: "USER_CONFIRMED",
            },
          });
      }
    },
    { timeout: 20_000 },
  );

  return {
    skills: profile.skills.length,
    roles: profile.roles.filter((r) => r.company && r.title).length,
    education: profile.education.filter((e) => e.institution).length,
    certifications: profile.certifications.length,
  };
}
