import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { analyticsFor } from "@/services/ask-acme-service";
import { toCsv } from "@/lib/utils";
import { asAppError, userFacingMessage } from "@/lib/errors";
import { requireCapability } from "@/services/entitlement-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    await requireCapability(user.id, "ANALYTICS");
    const analytics = await analyticsFor(user.id);
    const csv = toCsv(
      analytics.formulas.map((f) => ({
        metric: f.name,
        formula: f.formula,
        value: f.value,
      })),
    );
    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="acme-analytics.csv"',
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    const err = asAppError(e);
    return NextResponse.json(
      { error: userFacingMessage(err) },
      { status: err.status },
    );
  }
}
