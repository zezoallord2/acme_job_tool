import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/utils";
import { asAppError, userFacingMessage } from "@/lib/errors";
import { requireCapability } from "@/services/entitlement-service";

export const dynamic = "force-dynamic";

/** Every export resolves the user server-side. No userId is ever taken from input. */
async function safe<T>(fn: () => Promise<T>): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (e) {
    return NextResponse.json(
      { error: userFacingMessage(asAppError(e)) },
      { status: asAppError(e).status },
    );
  }
}

export async function GET() {
  return safe(async () => {
    const user = await requireUser();
    await requireCapability(user.id, "APPLICATION_TRACKER");
    const rows = await prisma.application.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        job: {
          select: {
            company: true,
            title: true,
            location: true,
            sourceName: true,
            deadlineAt: true,
          },
        },
        matrix: {
          select: {
            fitClassification: true,
            coveragePercent: true,
            recommendation: true,
          },
        },
      },
    });

    const csv = toCsv(
      rows.map((r) => ({
        company: r.job?.company ?? "",
        role: r.job?.title ?? "",
        location: r.job?.location ?? "",
        source: r.job?.sourceName ?? "",
        status: r.status,
        date_saved: r.createdAt.toISOString(),
        date_applied: r.appliedAt?.toISOString() ?? "",
        evidence_fit: r.matrix?.fitClassification ?? "",
        coverage_percent: r.matrix
          ? Math.round(r.matrix.coveragePercent * 100)
          : "",
        recommendation: r.matrix?.recommendation ?? "",
        next_action: r.nextAction ?? "",
        next_action_due: r.nextActionDue?.toISOString() ?? "",
        deadline: r.job?.deadlineAt?.toISOString() ?? "",
        interview_date: "",
        contact_name: r.contactName ?? "",
        contact_email: r.contactEmail ?? "",
        notes_count: 0,
      })),
    );

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="acme-applications.csv"',
        "cache-control": "no-store",
      },
    });
  });
}
