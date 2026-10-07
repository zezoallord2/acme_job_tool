import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { NewJobForm } from "@/components/new-job-form";
import { Card, Alert, EmptyState } from "@/components/ui/primitives";
import { listJobs } from "@/services/job-service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analyze a Job" };

export default async function NewJobPage() {
  const user = await requireUser();
  const jobs = await listJobs(user.id, 6);

  const hasExisting = jobs.length > 0;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Analyze a job description
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Paste the description as written. Acme Jobs extracts what the employer
          actually requires and compares it to your evidence. It does not
          produce a score, because no universal score exists.
        </p>
      </header>

      <Alert tone="info" title="Zero-cost mode">
        Analysis works in Manual Mode with no API key: the app builds a complete
        prompt, you paste it into whichever assistant you already use, then
        paste the result back. Acme Jobs validates it and continues. A local AI
        provider or your own API key can be configured in Settings if you prefer
        direct execution.
      </Alert>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <NewJobForm />
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold text-[var(--text)]">
              How input works
            </h2>
            <ul className="mt-2 space-y-2 text-sm text-[var(--text-muted)]">
              <li>
                <strong className="text-[var(--text)]">Paste</strong> — the
                reliable path. Full text, no parsing risk.
              </li>
              <li>
                <strong className="text-[var(--text)]">Upload TXT</strong> —
                plain text, parsed locally.
              </li>
              <li>
                <strong className="text-[var(--text)]">
                  Upload PDF / DOCX
                </strong>{" "}
                — embedded text only. A scanned PDF with no text layer cannot be
                read without OCR; the app will tell you and let you paste
                instead.
              </li>
            </ul>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              No job board scraping. No paid job data API. What you paste is
              what gets analysed.
            </p>
          </Card>

          {hasExisting ? (
            <Card>
              <h2 className="text-sm font-semibold text-[var(--text)]">
                Recent jobs
              </h2>
              <ul className="mt-2 space-y-1.5">
                {jobs.map((j) => (
                  <li key={j.id} className="text-sm">
                    <Link
                      href={`/app/jobs/${j.id}`}
                      className="text-[var(--text)] underline"
                    >
                      {j.company ?? "Unnamed company"}
                    </Link>
                    <span className="block truncate text-xs text-[var(--text-muted)]">
                      {j.title ?? "Role not set"}
                      {j.matrices[0]
                        ? ` · ${j.matrices[0].fitClassification.replace(/_/g, " ").toLowerCase()}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState
              title="Nothing here yet"
              description="Your first job description becomes the basis of an evidence matrix, a recommendation and a tailored resume."
            />
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Jobs are private to your account.{" "}
        <Link href="/app/evidence" className="underline">
          Review your evidence
        </Link>{" "}
        first if you want a better match.
      </p>
    </div>
  );
}
