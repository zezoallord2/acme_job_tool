import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getResume, RESUME_CONTENT_SCHEMA } from "@/services/resume-service";
import { hasCapability } from "@/services/entitlement-service";
import {
  Card,
  CardHeader,
  Alert,
  SaveIndicator,
} from "@/components/ui/primitives";
import {
  ResumeEditor,
  type ResumeEditorValue,
} from "@/components/resume-editor";
import { ResumeQuickCheck } from "@/components/resume-quick-check";
import { checkConsistency } from "@/domain/readiness";
import { flattenResumeText } from "@/services/resume-service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resume" };

export default async function ResumeDetailPage({
  params,
}: {
  params: Promise<{ resumeId: string }>;
}) {
  const user = await requireUser();
  const { resumeId } = await params;

  const resume = await getResume(user.id, resumeId);
  const isComplete = await hasCapability(user.id, "CLAIM_INSPECTOR");

  const latest = resume.versions[0];
  const content = RESUME_CONTENT_SCHEMA.parse(latest?.content ?? {});

  const employments = await prisma.employmentRecord.findMany({
    where: { userId: user.id },
  });
  const skills = await prisma.skill.findMany({ where: { userId: user.id } });
  const evidence = await prisma.evidence.findMany({
    where: {
      userId: user.id,
      verificationStatus: { in: ["VERIFIED", "USER_CONFIRMED"] },
    },
    select: { id: true, statement: true, metricValue: true, tags: true },
  });

  const consistencyIssues = checkConsistency({
    profile: {
      jobTitles: employments.map((e) => e.jobTitle),
      employers: employments.map((e) => e.companyName),
      education: [],
      tools: skills.map((s) => s.name),
    },
    documents: [
      { id: resume.id, type: "RESUME", text: flattenResumeText(content) },
    ],
    evidence: evidence.map((e) => ({
      id: e.id,
      statement: e.statement,
      metricValue: e.metricValue,
      employmentStart: null,
      employmentEnd: null,
      employer: null,
      jobTitle: null,
      tools: e.tags,
    })),
    employmentDates: employments.map((e) => ({
      employer: e.companyName,
      jobTitle: e.jobTitle,
      startDate: e.startDate,
      endDate: e.endDate,
    })),
  });

  const initialValue: ResumeEditorValue = {
    contact: content.contact,
    summary: content.summary,
    skills: content.skills,
    experiences: content.experiences,
    projects: content.projects,
    education: content.education,
    certifications: content.certifications,
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
        <Link href="/app/resumes" className="underline">
          Resumes
        </Link>{" "}
        / {resume.label}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title text-[var(--text)]">{resume.label}</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {resume.template.replace(/_/g, " ").toLowerCase()} · version{" "}
            {resume.currentVersion}
            {resume.job
              ? ` · ${resume.job.company ?? ""} ${resume.job.title ?? ""}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/resumes/${resume.id}/pdf`} className="btn-secondary">
            Export PDF
          </a>
          <a href={`/api/resumes/${resume.id}/docx`} className="btn-secondary">
            Export DOCX
          </a>
        </div>
      </header>

      <Alert tone="info" title="Autosave is on">
        Edits save automatically. A stale save is refused rather than
        overwriting newer work, so concurrent edits never silently win.
      </Alert>

      {consistencyIssues.length > 0 ? (
        <ResumeQuickCheck issues={consistencyIssues} canInspect={isComplete} />
      ) : (
        <div className="card p-3">
          <p className="text-sm text-[var(--text-muted)]">
            Resume Quick Check: no date, title, metric or tool conflicts found
            against your career records.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Content"
              description="ATS-friendly structure. No photos, charts, skill bars or scores."
            />
            <ResumeEditor
              resumeId={resume.id}
              currentVersion={resume.currentVersion}
              initial={initialValue}
            />
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Revision history"
            description="Restore any previous version."
          />
          <ul className="space-y-1.5">
            {resume.versions.slice(0, 12).map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="text-[var(--text-muted)]">
                  v{v.version} · {v.label ?? "save"}
                  {v.isSent ? " · sent" : ""}
                </span>
                <Link
                  href={`/app/resumes/${resume.id}?version=${v.version}`}
                  className="btn-ghost"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
          <SaveIndicator state="idle" />
        </Card>
      </div>
    </div>
  );
}
