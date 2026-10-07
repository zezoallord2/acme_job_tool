import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listJobs } from "@/services/job-service";
import { EmptyState, StatusBadge, FitBadge } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs" };

export default async function JobsPage() {
  const user = await requireUser();
  const jobs = await listJobs(user.id, 100);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
            Jobs
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Every job you have saved, with its evidence coverage and
            recommendation.
          </p>
        </div>
        <Link href="/app/jobs/new" className="btn-primary">
          Analyze a Job
        </Link>
      </header>

      {jobs.length === 0 ? (
        <EmptyState
          title="Your job hunt starts here."
          description="Paste one job description. Acme Jobs extracts the real requirements and shows you which ones you can already prove."
          action={
            <Link href="/app/jobs/new" className="btn-primary">
              Analyze Your First Job
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/app/jobs/${job.id}`}
                className="card block p-4 no-underline transition-colors hover:border-[var(--brand-accent)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-[var(--text)]">
                      {job.company ?? "Company not set"}
                    </h2>
                    <p className="truncate text-sm text-[var(--text-muted)]">
                      {job.title ?? "Role not set"}
                    </p>
                  </div>
                  {job.application ? (
                    <StatusBadge status={job.application.status} />
                  ) : null}
                </div>

                {job.matrices[0] ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <FitBadge fit={job.matrices[0].fitClassification} />
                    <span className="badge badge-unknown">
                      {Math.round(job.matrices[0].coveragePercent * 100)}%
                      weighted coverage
                    </span>
                    <span className="badge badge-unknown">
                      {job.analysis?.mustHaveRequirements.length ?? 0} must-have
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[var(--text-muted)]">
                    Not analysed yet.{" "}
                    <span className="underline">Run the analyzer</span>
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
