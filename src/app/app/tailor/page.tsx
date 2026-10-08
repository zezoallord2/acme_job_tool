import { requireUser } from "@/lib/auth";
import { tailorOptions } from "@/services/tailor-service";
import { TailorWorkspace } from "@/components/tailor-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tailor my resume" };

type Params = Record<string, string | string[] | undefined>;

export default async function TailorPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const requested =
    typeof params.applicationId === "string" ? params.applicationId : null;
  const options = await tailorOptions(user.id);
  const initial =
    requested && options.applications.some((a) => a.id === requested)
      ? requested
      : null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-[var(--text)]">Tailor my resume</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Pick a job and a resume, then get a complete, ATS-friendly version
          tailored to it. Every change is shown side by side so you can accept,
          reject or edit it. Nothing is sent anywhere, and your original stays
          untouched.
        </p>
      </header>
      <TailorWorkspace
        applications={options.applications}
        resumes={options.resumes}
        initialApplicationId={initial}
      />
    </div>
  );
}
