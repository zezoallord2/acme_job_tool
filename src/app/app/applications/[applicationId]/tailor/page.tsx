import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getApplication } from "@/services/application-service";
import { hasCapability } from "@/services/entitlement-service";
import { STUDIO_WORKFLOWS } from "@/services/studio-service";
import { studioDescriptorAction } from "@/app/actions/studio-actions";
import { StudioSection } from "@/components/studio-section";
import { Alert } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tailor a resume" };

export default async function TailorPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const user = await requireUser();
  const { applicationId } = await params;

  let app: Awaited<ReturnType<typeof getApplication>>;
  try {
    app = await getApplication(user.id, applicationId);
  } catch {
    notFound();
  }

  const workflow = STUDIO_WORKFLOWS.RESUME_TAILORING;
  const can = await hasCapability(user.id, workflow.capability);
  const descriptor =
    can === true ? await studioDescriptorAction(workflow.id) : null;

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
        <Link href="/app/applications" className="underline">
          Applications
        </Link>{" "}
        /{" "}
        <Link href={`/app/applications/${app.id}`} className="underline">
          {app.job?.company ?? "Company not set"}
        </Link>{" "}
        / Tailor resume
      </nav>

      <header>
        <h1 className="page-title text-[var(--text)]">
          Tailor a resume for {app.job?.title ?? "this role"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Built from this job&apos;s requirements and the resume you actually
          sent, so you are never preparing against something the employer never
          saw. Generated text is always a draft — nothing is sent and your main
          resume stays untouched.
        </p>
      </header>

      {can ? (
        descriptor && "fields" in descriptor ? (
          <StudioSection
            workflow={workflow}
            descriptor={descriptor}
            can={can}
            initialValues={{ applicationId: app.id }}
            open
          />
        ) : (
          <Alert tone="error">
            The tailoring tool could not be loaded. Please try again.
          </Alert>
        )
      ) : (
        <Alert tone="info" title="Complete Edition feature">
          Resume tailoring is part of Complete Edition.{" "}
          <Link href="/app/settings" className="underline">
            See your plan
          </Link>
          .
        </Alert>
      )}
    </div>
  );
}
