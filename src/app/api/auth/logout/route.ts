import { destroySession, clearSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function POST() {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const token = jar.get("acme_session")?.value;
  if (token) await destroySession(token);
  await prisma.auditLog
    .create({
      data: { action: "auth.logout", entity: "Session", outcome: "success" },
    })
    .catch(() => undefined);
  await clearSessionCookie();
  redirect("/");
}

export async function GET() {
  return POST();
}
