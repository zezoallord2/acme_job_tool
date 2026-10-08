import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Tailoring moved to one screen at /app/tailor; keep old links working. */
export default async function LegacyTailorPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  redirect(`/app/tailor?applicationId=${encodeURIComponent(applicationId)}`);
}
