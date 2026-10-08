import { NextResponse } from "next/server";
import { requireUser, requireSameOrigin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { Errors } from "@/lib/errors";
import { getEntitlementState } from "@/services/entitlement-service";
import {
  confirmProfileImport,
  previewProfileFromCv,
} from "@/services/cv-import-service";

export const dynamic = "force-dynamic";

/**
 * Builds a profile from an uploaded CV.
 *
 * One request: parse the document, ask the model to extract only what is
 * written there, and persist the result. The user should never have to copy
 * anything between screens to get a profile.
 */
const MAX_BYTES = 8 * 1024 * 1024;

const ACCEPTED: Record<string, string> = {
  "application/pdf": "cv.pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "cv.docx",
  "text/plain": "cv.txt",
  "text/markdown": "cv.md",
};

function extensionFor(fileName: string, mime: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return ".pdf";
  if (lower.endsWith(".docx")) return ".docx";
  if (lower.endsWith(".md")) return ".md";
  if (lower.endsWith(".txt")) return ".txt";
  return ACCEPTED[mime]?.split(".").pop() ?? "";
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await requireSameOrigin();

    // Import is expensive: a model call plus document parsing per upload. The
    // "upload" bucket exists for exactly this.
    await enforceRateLimit("upload", { userId: user.id });

    const form = await request.formData().catch(() => null);
    const file = form?.get("cv");
    if (!(file instanceof File)) {
      throw Errors.validation("Choose a CV file to upload.");
    }
    if (file.size === 0) {
      throw Errors.validation("That file is empty.");
    }
    if (file.size > MAX_BYTES) {
      throw Errors.validation(
        "That CV is larger than 8 MB. Export a text-based PDF or DOCX and try again.",
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = await detectMime(buffer, file.type);
    if (!ACCEPTED[detected]) {
      throw Errors.validation(
        "Upload a PDF, DOCX, TXT or MD file. If it is a scan or a photo, export a text-based version first.",
      );
    }

    const entitlement = await getEntitlementState(user.id);

    const result = await previewProfileFromCv({
      userId: user.id,
      buffer,
      fileName: `cv${extensionFor(file.name, detected)}`,
      mimeType: detected,
      // A paying customer must be told when AI is broken rather than being shown
      // an empty profile that looks like their CV was bad.
      requireRealAI: entitlement.isComplete,
    });

    const { profile, counts } = result;
    return NextResponse.json({
      ok: true,
      needsReview: true,
      uploadKey: result.uploadKey,
      originalName: result.originalName,
      found: counts,
      profile,
      message: `Found ${counts.roles} role${counts.roles === 1 ? "" : "s"}, ${counts.skills} skills and ${counts.certifications} certification${counts.certifications === 1 ? "" : "s"}. Review before saving.`,
    });
  } catch (e) {
    const { asAppError, userFacingMessage } = await import("@/lib/errors");
    const err = asAppError(e);
    return NextResponse.json(
      { ok: false, error: userFacingMessage(err) },
      { status: err.status ?? 400 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    await requireSameOrigin();
    await enforceRateLimit("write", { userId: user.id });
    const body = (await request.json()) as {
      uploadKey?: string;
      originalName?: string;
      profile?: Parameters<typeof confirmProfileImport>[0]["profile"];
    };
    if (!body.uploadKey || !body.originalName || !body.profile)
      throw Errors.validation("The CV review is incomplete.");
    const counts = await confirmProfileImport({
      userId: user.id,
      uploadKey: body.uploadKey,
      originalName: body.originalName,
      profile: body.profile,
    });
    return NextResponse.json({
      ok: true,
      found: counts,
      message: "Your reviewed CV details are now in My Profile.",
    });
  } catch (e) {
    const { asAppError, userFacingMessage } = await import("@/lib/errors");
    const err = asAppError(e);
    return NextResponse.json(
      { ok: false, error: userFacingMessage(err) },
      { status: err.status ?? 400 },
    );
  }
}

/** Sniffs the real type from magic bytes rather than trusting the browser. */
async function detectMime(buffer: Buffer, declared: string): Promise<string> {
  if (buffer.length >= 4) {
    const magic = buffer.subarray(0, 4).toString("latin1");
    if (magic === "%PDF") return "application/pdf";
    // DOCX and other OOXML files are ZIP containers: PK\x03\x04.
    if (magic.startsWith("PK")) {
      return ACCEPTED[declared] ? declared : "application/zip";
    }
  }
  // Plain text: no NUL bytes and mostly printable.
  const head = buffer.subarray(0, 512);
  if (!head.includes(0)) {
    const text = head.toString("utf8");
    if (Buffer.from(text, "utf8").equals(head)) {
      return declared === "text/markdown" ? "text/markdown" : "text/plain";
    }
  }
  return declared || "application/octet-stream";
}
