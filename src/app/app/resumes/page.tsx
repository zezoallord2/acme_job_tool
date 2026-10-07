import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  ensureMasterResume,
  listResumes,
  resumeLineage,
} from "@/services/resume-service";
import { hasCapability } from "@/services/entitlement-service";
import {
  Card,
  CardHeader,
  EmptyState,
  Alert,
  Stat,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resumes" };

export default async function ResumesPage() {
  const user = await requireUser();
  const isComplete = await hasCapability(user.id, "RESUME_VERSIONS");

  const master = await ensureMasterResume(user.id);
  const resumes = await listResumes(user.id);
  const lineage = await resumeLineage(user.id, master.id);
  const jobVersions = resumes.filter((r) => !r.isMaster);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Resumes
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          One Master Resume, then a job-specific version per application.
          Lineage is preserved so you always know which version went where.
        </p>
      </header>

      {!isComplete ? (
        <Alert tone="info" title="Free resume support">
          You can maintain one Master Resume and get a Resume Quick Check.
          Complete Edition adds unlimited job-specific versions, lineage,
          advanced tailoring and the Resume Bullet Builder.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Total versions" value={resumes.length} />
        <Stat label="Job-specific" value={jobVersions.length} />
        <Stat label="Master revisions" value={lineage.master.versions.length} />
      </div>

      <Card>
        <CardHeader
          title="Master Resume"
          description="The single source for tailoring. Changing it never alters anything you have already sent."
          action={
            <Link href={`/app/resumes/${master.id}`} className="btn-primary">
              Open
            </Link>
          }
        />
        <p className="text-sm text-[var(--text-muted)]">
          Currently at version {lineage.master.versions[0]?.version ?? 1}, last
          updated {formatDate(master.updatedAt)}.
        </p>
      </Card>

      {jobVersions.length === 0 ? (
        <EmptyState
          title="No job-specific versions yet"
          description="Tailor your Master Resume against a job's Evidence Matrix. Every bullet must cite evidence that supports it."
          action={
            isComplete ? (
              <Link href="/app/jobs" className="btn-primary">
                Choose a job to tailor for
              </Link>
            ) : (
              <Link href="/app/settings" className="btn-primary">
                Upgrade for tailoring
              </Link>
            )
          }
        />
      ) : (
        <Card>
          <CardHeader
            title="Job-specific versions"
            description="Derived from the Master Resume, linked back to lineage."
          />
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Label</th>
                  <th scope="col">Company / role</th>
                  <th scope="col">Template</th>
                  <th scope="col">Version</th>
                  <th scope="col">Sent</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {lineage.children.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link
                        href={`/app/resumes/${r.id}`}
                        className="font-medium text-[var(--text)] underline"
                      >
                        {r.label}
                      </Link>
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">
                      {r.job?.company ?? "—"} {r.job?.title ?? ""}
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">
                      {r.template.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="text-xs">v{r.currentVersion}</td>
                    <td className="text-xs">
                      {r.versions[0]?.isSent ? "Yes" : "No"}
                    </td>
                    <td className="text-xs">{formatDate(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Revision history"
          description="Every saved version of your Master Resume can be restored."
        />
        <ul className="space-y-1.5">
          {lineage.master.versions.slice(0, 10).map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span className="text-[var(--text)]">
                v{v.version} · {v.label ?? "Manual save"} ·{" "}
                {formatDate(v.createdAt)}
              </span>
              <Link
                href={`/app/resumes/${master.id}?version=${v.version}`}
                className="btn-ghost"
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
