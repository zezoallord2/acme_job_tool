"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, inTransaction } from "@/lib/db";
import { Errors, asAppError, userFacingMessage } from "@/lib/errors";
import { requireUser, requireSameOrigin, requireAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { AIProviderName } from "@prisma/client";
import { requireCapability } from "@/services/entitlement-service";

function fail(e: unknown) {
  return { ok: false, message: userFacingMessage(asAppError(e)) };
}

// ---------------------------------------------------------------------------
// Job input
// ---------------------------------------------------------------------------

const UPLOAD_ALLOWED = new Map<string, string>([
  ["txt", "text/plain"],
  ["md", "text/markdown"],
  ["pdf", "application/pdf"],
  [
    "docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
]);

/**
 * Accepts a job description file, stores it and queues the local text
 * extraction. Text extraction happens in the worker, not here, so a large
 * document cannot hold a request open.
 */
export async function uploadJobDescriptionAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; message?: string; queued?: boolean }> {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("upload", { userId: user.id });

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw Errors.validation("Choose a file to upload.");
    }

    const originalName = file.name || "upload";
    const extension = originalName.split(".").pop()?.toLowerCase() ?? "";
    const mime = UPLOAD_ALLOWED.get(extension);
    if (!mime) {
      throw Errors.validation(
        "Acme Jobs reads TXT, MD, PDF and DOCX files. Paste the text for anything else.",
      );
    }

    const { env } = await import("@/lib/env");
    const maxBytes = env().MAX_UPLOAD_BYTES;
    if (file.size > maxBytes) {
      throw Errors.validation(
        `That file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`,
      );
    }
    if (file.size === 0) {
      throw Errors.validation("That file is empty.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageProvider } = await import("@/lib/storage");
    const stored = await storageProvider().put({
      scope: "uploads",
      ownerId: user.id,
      buffer,
      mimeType: mime,
      originalName,
    });

    const { jobQueue } = await import("@/queue/queue");
    const queued = await jobQueue().enqueue({
      type: "DOCUMENT_PARSE",
      userId: user.id,
      payload: {
        key: stored.key,
        ownerId: user.id,
        mime,
        originalName,
        title: String(formData.get("title") ?? "") || null,
        company: String(formData.get("company") ?? "") || null,
      },
      // One parse per file, so a double-click cannot create two jobs.
      idempotencyKey: `document-parse:${user.id}:${stored.key}`,
    });

    revalidatePath("/app/jobs");
    return {
      ok: true,
      queued: true,
      message: queued.deduplicated
        ? "That file is already being parsed."
        : "Uploaded. The text is being extracted and the job will appear under Jobs.",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function createJobAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const { createJob } = await import("@/services/job-service");
    const job = await createJob(user.id, {
      title: formData.get("title"),
      company: formData.get("company"),
      location: formData.get("location"),
      description: formData.get("description"),
      deadlineAt: formData.get("deadlineAt") || null,
      contactEmail: formData.get("contactEmail") || null,
      sourceName: formData.get("sourceName") || null,
      inputSource: "PASTE",
    });
    revalidatePath("/app/jobs");
    return { ok: true, message: "Job saved.", jobId: job.id };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Evidence ledger
// ---------------------------------------------------------------------------

export async function createEvidenceAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const { createEvidence } = await import("@/services/evidence-service");
    const rawMetric = String(formData.get("metricValue") ?? "").trim();
    await createEvidence(user.id, {
      statement: formData.get("statement"),
      claimType: formData.get("claimType"),
      sourceType: formData.get("sourceType"),
      sourceDescription: formData.get("sourceDescription"),
      verificationStatus:
        formData.get("verificationStatus") ?? "USER_CONFIRMED",
      metricValue: rawMetric ? Number(rawMetric) : null,
      metricUnit: String(formData.get("metricUnit") ?? "").trim() || null,
      metricStatus:
        formData.get("metricStatus") ??
        (rawMetric ? "USER_ESTIMATE" : "NOT_APPLICABLE"),
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20),
    });
    revalidatePath("/app/evidence");
    return { ok: true, message: "Evidence added to your ledger." };
  } catch (e) {
    return fail(e);
  }
}

export async function changeVerificationAction(
  _prev: unknown,
  formData: FormData,
) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const { updateVerification } = await import("@/services/evidence-service");
    await updateVerification(
      user.id,
      String(formData.get("evidenceId")),
      String(formData.get("to")) as never,
      String(formData.get("note") ?? "") || undefined,
    );
    revalidatePath("/app/evidence");
    return { ok: true, message: "Verification status updated." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

const transitionSchema = z.object({
  applicationId: z.string().min(5),
  to: z.enum([
    "SAVED",
    "ANALYZING",
    "READY_TO_APPLY",
    "APPLIED",
    "SCREENING",
    "INTERVIEW",
    "FINAL_INTERVIEW",
    "OFFER",
    "REJECTED",
    "WITHDRAWN",
    "ARCHIVED",
  ]),
  reason: z.string().max(500).optional(),
  seal: z.string().optional(),
});

export async function transitionApplicationAction(
  _prev: unknown,
  formData: FormData,
) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const parsed = transitionSchema.safeParse({
      applicationId: String(formData.get("applicationId") ?? ""),
      to: String(formData.get("to") ?? ""),
      reason: String(formData.get("reason") ?? "") || undefined,
      seal: String(formData.get("seal") ?? "") || undefined,
    });
    if (!parsed.success)
      throw Errors.validation("That state change request was not valid.");

    const { transitionApplication, sealApplicationSnapshot } =
      await import("@/services/application-service");

    if (parsed.data.to === "APPLIED" && parsed.data.seal === "true") {
      await sealApplicationSnapshot(user.id, parsed.data.applicationId);
    }
    await transitionApplication(
      user.id,
      parsed.data.applicationId,
      parsed.data.to,
      { reason: parsed.data.reason },
    );
    revalidatePath("/app/applications");
    revalidatePath("/app");
    return {
      ok: true,
      message: `Application moved to ${parsed.data.to.replace(/_/g, " ").toLowerCase()}.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function recordOutcomeAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const { recordOutcome } = await import("@/services/application-service");
    await recordOutcome(
      user.id,
      String(formData.get("applicationId")),
      String(formData.get("type")) as never,
      String(formData.get("detail") ?? "") || undefined,
    );
    revalidatePath("/app/applications");
    return { ok: true, message: "Outcome recorded." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

export async function claimDecisionAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    await requireCapability(user.id, "CLAIM_INSPECTOR");
    const { confirmClaim, rejectClaim, editClaim } =
      await import("@/services/claim-service");
    const claimId = String(formData.get("claimId"));
    const decision = String(formData.get("decision"));
    if (decision === "CONFIRM") await confirmClaim(user.id, claimId);
    else if (decision === "REJECT") await rejectClaim(user.id, claimId);
    else if (decision === "EDIT") {
      await editClaim(user.id, claimId, String(formData.get("newText") ?? ""), {
        acceptWithoutEvidence: formData.get("acceptWithoutEvidence") === "true",
      });
    } else throw Errors.validation("Unknown claim decision.");
    revalidatePath("/app/claims");
    revalidatePath("/app");
    return {
      ok: true,
      message: decision === "CONFIRM" ? "Claim confirmed." : "Claim updated.",
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Resumes
// ---------------------------------------------------------------------------

export async function saveResumeAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const { updateResumeContent } = await import("@/services/resume-service");
    const content = JSON.parse(
      String(formData.get("content") ?? "{}"),
    ) as unknown;
    const expectedVersionRaw = String(formData.get("expectedVersion") ?? "");
    await updateResumeContent({
      userId: user.id,
      resumeId: String(formData.get("resumeId")),
      content,
      expectedVersion: expectedVersionRaw
        ? Number(expectedVersionRaw)
        : undefined,
      autosave: formData.get("autosave") === "true",
    });
    revalidatePath("/app/resumes");
    return { ok: true, message: "Resume saved." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Learning
// ---------------------------------------------------------------------------

export async function proposalAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    await requireCapability(user.id, "CAREER_LEARNING");
    const { acceptProposal, dismissProposal } =
      await import("@/services/learning-service");
    const id = String(formData.get("proposalId"));
    const decision = String(formData.get("decision"));
    if (decision === "ACCEPT") await acceptProposal(user.id, id);
    else if (decision === "IGNORE") {
      await dismissProposal(
        user.id,
        id,
        String(formData.get("reason") ?? "") || undefined,
      );
    } else throw Errors.validation("Unknown proposal decision.");
    revalidatePath("/app/learning");
    revalidatePath("/app/evidence");
    return {
      ok: true,
      message:
        decision === "ACCEPT"
          ? "Added to your Evidence Ledger."
          : "Proposal dismissed.",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function feedbackAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const interactionId = String(formData.get("interactionId") ?? "");
    if (!interactionId) return { ok: true, message: "Recorded." };
    await prisma.aIInteractionFeedback.create({
      data: {
        userId: user.id,
        interactionId,
        vote: String(formData.get("vote")) as never,
        reasons: String(formData.get("reasons") ?? "")
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean) as never,
        comment: String(formData.get("comment") ?? "").slice(0, 1000) || null,
        context: String(formData.get("context") ?? "").slice(0, 200) || null,
      },
    });
    return { ok: true, message: "Thanks — that improves the next version." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateSettingsAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });

    const theme =
      (formData.get("theme") as "LIGHT" | "DARK" | "SYSTEM") ?? "SYSTEM";
    const aiProvider =
      (formData.get("aiProvider") as AIProviderName) ?? "MANUAL";
    const data = {
      theme,
      aiProvider,
      productLearningEnabled: formData.get("productLearningEnabled") === "true",
      analyticsEnabled: formData.get("analyticsEnabled") === "true",
      notifyInterviews: formData.get("notifyInterviews") === "true",
      notifyFollowUps: formData.get("notifyFollowUps") === "true",
      notifyDeadlines: formData.get("notifyDeadlines") === "true",
      notifyDrafts: formData.get("notifyDrafts") === "true",
    };

    await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
    revalidatePath("/app/settings");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveApiKeyAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("write", { userId: user.id });
    const provider = String(
      formData.get("provider") ?? "",
    ).toUpperCase() as AIProviderName;
    const key = String(formData.get("key") ?? "").trim();
    if (!["OPENAI", "ANTHROPIC", "GEMINI", "OPENROUTER"].includes(provider)) {
      throw Errors.validation("Choose a supported provider.");
    }
    if (key.length < 20)
      throw Errors.validation("That does not look like a valid API key.");
    const { encryptSecret, keyHint } = await import("@/lib/crypto");
    await prisma.userApiKey.deleteMany({
      where: { userId: user.id, provider },
    });
    await prisma.userApiKey.create({
      data: {
        userId: user.id,
        provider,
        encryptedKey: new Uint8Array(encryptSecret(key)),
        keyHint: keyHint(key),
        label: String(formData.get("label") ?? "").slice(0, 60) || null,
      },
    });
    revalidatePath("/app/settings");
    return {
      ok: true,
      message:
        "Key stored encrypted. It is never sent to your browser or logged.",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteApiKeyAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await prisma.userApiKey.deleteMany({
      where: { userId: user.id, id: String(formData.get("keyId")) },
    });
    revalidatePath("/app/settings");
    return { ok: true, message: "Key removed." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function adminGrantEntitlementAction(
  _prev: unknown,
  formData: FormData,
) {
  try {
    await requireSameOrigin();
    const admin = await requireAdmin();
    await enforceRateLimit("write", { userId: admin.id });
    const { grantCompleteEntitlement } =
      await import("@/services/entitlement-service");
    const targetEmail = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const target = await prisma.user.findUnique({
      where: { email: targetEmail },
      select: { id: true },
    });
    if (!target) throw Errors.notFound("User");
    const result = await grantCompleteEntitlement({
      userId: target.id,
      source: "MANUAL_ADMIN",
      externalEventId: `manual:${target.id}:${Date.now()}`,
      adminUserId: admin.id,
    });
    revalidatePath("/admin");
    return {
      ok: true,
      message: result.deduplicated
        ? "Already granted (idempotent)."
        : "Complete Edition granted.",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function adminRevokeEntitlementAction(
  _prev: unknown,
  formData: FormData,
) {
  try {
    await requireSameOrigin();
    const admin = await requireAdmin();
    const { revokeCompleteEntitlement } =
      await import("@/services/entitlement-service");
    const targetId = String(formData.get("userId"));
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!target) throw Errors.notFound("User");
    const count = await revokeCompleteEntitlement(target.id, admin.id);
    revalidatePath("/admin");
    return { ok: true, message: `${count} entitlement(s) revoked.` };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAccountAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    if (String(formData.get("confirm") ?? "") !== user.email) {
      throw Errors.validation("Type your email exactly to confirm deletion.");
    }
    await inTransaction(async (tx) => {
      await tx.user.delete({ where: { id: user.id } });
      await tx.auditLog.create({
        data: {
          action: "account.deleted",
          entity: "User",
          entityId: user.id,
          outcome: "success",
        },
      });
    });
    return {
      ok: true,
      message: "Your account and all career data were deleted.",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function reportProblemAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    const user = await requireUser();
    await enforceRateLimit("bugReport", { userId: user.id });
    const { createBugReport } = await import("@/services/debug-service");
    const id = await createBugReport({
      userId: user.id,
      whatAttempted: String(formData.get("whatAttempted") ?? ""),
      whatHappened: String(formData.get("whatHappened") ?? ""),
      steps: String(formData.get("steps") ?? ""),
      includeDiagnostics: formData.get("includeDiagnostics") === "true",
      route: String(formData.get("route") ?? ""),
    });
    return { ok: true, message: `Thanks. Your reference code is ${id}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function requeueDeadJobAction(_prev: unknown, formData: FormData) {
  try {
    await requireSameOrigin();
    await requireAdmin();
    const { jobQueue } = await import("@/queue/queue");
    await jobQueue().requeue(String(formData.get("jobId")));
    revalidatePath("/admin");
    return { ok: true, message: "Job requeued." };
  } catch (e) {
    return fail(e);
  }
}
