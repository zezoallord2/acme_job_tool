import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getJob, getEvidenceMatrix } from "@/services/job-service";
import { buildManualPrompt } from "@/ai/providers/manual";
import { activePromptVersion } from "@/ai/workflow-ids";
import { hasCapability } from "@/services/entitlement-service";
import { JobAnalysisPanel } from "@/components/job-analysis-panel";
import { RebuildMatrixButton } from "@/components/rebuild-matrix-button";
import { MatrixTable } from "@/components/matrix-table";
import {
  Card,
  CardHeader,
  EmptyState,
  FitBadge,
  StrengthBadge,
  Alert,
  Stat,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job" };

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ analyze?: string }>;
}) {
  const user = await requireUser();
  const { jobId } = await params;
  const { analyze } = await searchParams;

  const job = await getJob(user.id, jobId);
  const [application, isComplete] = await Promise.all([
    prisma.application.findFirst({
      where: { userId: user.id, jobId },
      select: { id: true, status: true },
    }),
    hasCapability(user.id, "EVIDENCE_MATRIX_FULL"),
  ]);

  const career = await prisma.careerMasterProfile.findUnique({
    where: { userId: user.id },
    select: { targetRolePrimary: true },
  });

  const prompt = buildManualPrompt(
    "JOB_ANALYSIS",
    {
      description: job.rawDescription,
      targetRole: career?.targetRolePrimary ?? "not specified",
    },
    activePromptVersion("JOB_ANALYSIS"),
  );

  const matrix = job.analysis
    ? await getEvidenceMatrix(user.id, jobId).catch(() => null)
    : null;

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
        <Link href="/app/jobs" className="underline">
          Jobs
        </Link>{" "}
        / {job.company ?? "Unnamed company"}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
            {job.title ?? "Role not set"}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {job.company ?? "Company not set"}
            {job.location ? ` · ${job.location}` : ""}
            {job.deadlineAt ? ` · deadline ${formatDate(job.deadlineAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {application ? (
            <Link
              href={`/app/applications/${application.id}`}
              className="btn-secondary"
            >
              Open application
            </Link>
          ) : null}
          {isComplete ? (
            <Link
              href={`/app/applications/${application?.id ?? ""}/tailor?jobId=${job.id}`}
              className="btn-primary"
            >
              Tailor resume
            </Link>
          ) : (
            <Link href="/app/settings" className="btn-primary">
              Upgrade to tailor
            </Link>
          )}
        </div>
      </header>

      {!job.analysis ? (
        <Card>
          <CardHeader
            title="Analyze this description"
            description="Runs in Manual Mode by default: no API key, no cost. Paste the prompt into any assistant, then paste the result back."
          />
          <JobAnalysisPanel jobId={job.id} prompt={prompt} />
        </Card>
      ) : analyze === "1" ? (
        <Card>
          <CardHeader
            title="Re-run the analyzer"
            description={`Prompt version ${job.analysis.promptVersion}. Re-running replaces the stored analysis.`}
          />
          <JobAnalysisPanel jobId={job.id} prompt={prompt} />
        </Card>
      ) : null}

      {job.analysis ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Must-have requirements"
              value={job.analysis.mustHaveRequirements.length}
            />
            <Stat
              label="Preferred requirements"
              value={job.analysis.preferredRequirements.length}
            />
            <Stat
              label="Hard skills detected"
              value={job.analysis.hardSkills.length}
            />
            <Stat label="Tools detected" value={job.analysis.tools.length} />
          </div>

          {matrix ? (
            <Card>
              <CardHeader
                title="Evidence matrix"
                description="Each requirement compared against your evidence. Nothing here is a probability."
                action={<RebuildMatrixButton jobId={job.id} />}
              />
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <FitBadge fit={matrix.fitClassification} />
                <span className="badge badge-unknown">
                  Recommendation: {matrix.recommendation}
                </span>
                <span className="badge badge-unknown">
                  Tailoring effort:{" "}
                  {matrix.tailoringEffort.replace(/_/g, " ").toLowerCase()}
                </span>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat
                  label="Strong"
                  value={matrix.coverageStrong}
                  tone="positive"
                />
                <Stat
                  label="Partial"
                  value={matrix.coveragePartial}
                  tone="warning"
                />
                <Stat
                  label="Missing"
                  value={matrix.coverageMissing}
                  tone="negative"
                />
                <Stat label="Unknown" value={matrix.coverageUnknown} />
              </div>

              {isComplete ? (
                <Alert tone="info" title={matrix.explanation}>
                  {matrix.criticalGaps.length
                    ? ` Critical gaps: ${matrix.criticalGaps.join("; ")}.`
                    : ""}
                </Alert>
              ) : (
                <Alert tone="info" title="Free view">
                  You can see coverage counts. Complete Edition shows the full
                  requirement-by-requirement table with the recommended action
                  for each row and the Apply / Review / Skip reasoning.
                </Alert>
              )}

              {isComplete ? <MatrixTable matches={matrix.matches} /> : null}
            </Card>
          ) : (
            <EmptyState
              title="No evidence matrix yet"
              description="Build it to see which requirements you can already prove and which are gaps."
              action={
                <RebuildMatrixButton
                  jobId={job.id}
                  label="Build evidence matrix"
                />
              }
            />
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Requirements the employer states" />
              <TwoColumnList
                title="Must have"
                items={job.analysis.mustHaveRequirements}
                badge="badge-missing"
              />
              <div className="mt-4">
                <TwoColumnList
                  title="Preferred"
                  items={job.analysis.preferredRequirements}
                  badge="badge-partial"
                />
              </div>
              {job.analysis.dealBreakers.length ? (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-[var(--text)]">
                    Deal breakers
                  </h3>
                  <ul className="mt-1.5 space-y-1 text-sm text-[var(--text-muted)]">
                    {job.analysis.dealBreakers.map((d) => (
                      <li key={d}>• {d}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>

            <Card>
              <CardHeader title="What to emphasise" />
              <h3 className="text-sm font-semibold text-[var(--text)]">
                Repeated themes
              </h3>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {job.analysis.repeatedThemes.length === 0 ? (
                  <li className="text-sm text-[var(--text-muted)]">
                    None detected.
                  </li>
                ) : (
                  job.analysis.repeatedThemes.map((t) => (
                    <li key={t} className="badge badge-unknown">
                      {t}
                    </li>
                  ))
                )}
              </ul>

              <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">
                Language to reuse
              </h3>
              <ul className="mt-1.5 space-y-1 text-sm text-[var(--text-muted)]">
                {job.analysis.importantLanguage.length === 0 ? (
                  <li>None extracted.</li>
                ) : (
                  job.analysis.importantLanguage
                    .slice(0, 8)
                    .map((t) => <li key={t}>• {t}</li>)
                )}
              </ul>

              <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">
                Analysis provenance
              </h3>
              <dl className="mt-1.5 space-y-0.5 text-xs text-[var(--text-muted)]">
                <div>
                  Prompt: <code>{job.analysis.promptVersion}</code>
                </div>
                <div>
                  Validator: <code>{job.analysis.validatorVersion}</code>
                </div>
                <div>
                  Mode:{" "}
                  {job.analysis.manualMode
                    ? "Manual (pasted response)"
                    : "Direct provider"}
                </div>
              </dl>
            </Card>
          </div>
        </>
      ) : null}

      <Card>
        <CardHeader
          title="Original job description"
          description="Stored verbatim. It becomes part of the immutable Application Capsule when you apply."
        />
        <pre
          className="code-block"
          style={{ maxHeight: 320, overflow: "auto" }}
        >
          {job.rawDescription}
        </pre>
      </Card>

      <div className="flex flex-wrap gap-2">
        <StrengthBadge strength="UNKNOWN" />
        <Link href={`/app/jobs/${job.id}?analyze=1`} className="btn-secondary">
          Re-run analysis
        </Link>
      </div>
    </div>
  );
}

function TwoColumnList({
  title,
  items,
  badge,
}: {
  title: string;
  items: string[];
  badge: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--text-muted)]">None extracted.</p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {items.map((r) => (
            <li key={r} className="flex gap-2 text-sm text-[var(--text-muted)]">
              <span className={badge} aria-hidden>
                •
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
