import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeCompleteness } from "@/app/actions/onboarding-actions";
import { hasCapability } from "@/services/entitlement-service";
import {
  Card,
  CardHeader,
  Alert,
  ProgressBar,
  Stat,
  EmptyState,
} from "@/components/ui/primitives";
import { CareerProfileForm } from "@/components/career-profile-form";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Career Profile" };

export default async function CareerPage() {
  const user = await requireUser();
  const isComplete = await hasCapability(user.id, "CAREER_MASTER_PROFILE");

  const [
    career,
    profile,
    employments,
    education,
    skills,
    certifications,
    projects,
    completeness,
  ] = await Promise.all([
    prisma.careerMasterProfile.findUnique({ where: { userId: user.id } }),
    prisma.userProfile.findUnique({ where: { userId: user.id } }),
    prisma.employmentRecord.findMany({
      where: { userId: user.id },
      orderBy: [{ startDate: "desc" }],
    }),
    prisma.educationRecord.findMany({ where: { userId: user.id } }),
    prisma.skill.findMany({
      where: { userId: user.id },
      orderBy: [{ isCore: "desc" }, { name: "asc" }],
    }),
    prisma.certification.findMany({ where: { userId: user.id } }),
    prisma.project.findMany({ where: { userId: user.id } }),
    computeCompleteness(user.id),
  ]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
            {isComplete ? "Career Master Profile" : "Career Snapshot"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            What is factually true about you. Every suggestion in Acme Jobs is
            built from this and your Evidence Ledger — never from guesswork.
          </p>
        </div>
        <div className="w-full max-w-[220px]">
          <ProgressBar
            value={completeness / 100}
            label="Profile completeness"
          />
        </div>
      </header>

      {!isComplete ? (
        <Alert tone="info" title="Starter snapshot">
          The Starter plan keeps a Career Snapshot. Complete Edition unlocks the
          full Career Master Profile, Target Role Blueprint, Achievement Mining
          and the Career Narrative Engine for career changers.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Roles" value={employments.length} />
        <Stat label="Education" value={education.length} />
        <Stat label="Skills" value={skills.length} />
        <Stat label="Certifications" value={certifications.length} />
        <Stat label="Projects" value={projects.length} />
      </div>

      <Card>
        <CardHeader title="Personal and target" />
        <CareerProfileForm
          career={{
            targetRolePrimary: career?.targetRolePrimary ?? "",
            targetRoleSecondary: career?.targetRoleSecondary ?? "",
            targetIndustry: career?.targetIndustry ?? "",
            isCareerChanger: career?.isCareerChanger ?? false,
            careerChangeFrom: career?.careerChangeFrom ?? "",
            careerChangeTo: career?.careerChangeTo ?? "",
            currentSituation: career?.currentSituation ?? "",
            primaryGoal: career?.primaryGoal ?? "FULL_SYSTEM",
            professionalSummary: career?.professionalSummary ?? "",
            headline: career?.headline ?? "",
          }}
          profile={{
            firstName: profile?.firstName ?? "",
            lastName: profile?.lastName ?? "",
            email: profile?.email ?? user.email,
            phone: profile?.phone ?? "",
            locationCity: profile?.locationCity ?? "",
            linkedinUrl: profile?.linkedinUrl ?? "",
          }}
        />
      </Card>

      <Card>
        <CardHeader
          title="Employment"
          description="Titles and dates here are what consistency checking compares documents against."
          action={
            isComplete ? (
              <Link href="/app/career/employment/new" className="btn-secondary">
                Add a role
              </Link>
            ) : (
              <Link href="/pricing" className="btn-ghost">
                Unlock full profile
              </Link>
            )
          }
        />
        {employments.length === 0 ? (
          <EmptyState
            title="No employment recorded"
            description="Add at least one role, even an internship. It is the strongest evidence source in the ledger."
          />
        ) : (
          <ul className="space-y-2">
            {employments.map((e) => (
              <li key={e.id} className="card-muted p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {e.jobTitle}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {e.companyName}
                      {e.startDate
                        ? ` · ${formatDate(e.startDate, { month: "short", year: "numeric" })}`
                        : ""}
                      {e.isCurrent
                        ? " · present"
                        : e.endDate
                          ? ` – ${formatDate(e.endDate, { month: "short", year: "numeric" })}`
                          : ""}
                    </p>
                  </div>
                  <span className="badge badge-unknown">
                    {e.verification.replace(/_/g, " ").toLowerCase()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Education" />
          {education.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nothing recorded.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
              {education.map((e) => (
                <li key={e.id}>
                  {[e.degree, e.fieldOfStudy, e.institution]
                    .filter(Boolean)
                    .join(" — ")}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Skills" />
          {skills.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No skills recorded.{" "}
              {isComplete ? (
                <>
                  <Link href="/app/career/skills/new" className="underline">
                    Add skills
                  </Link>{" "}
                  so the evidence matrix can match them.
                </>
              ) : (
                "Complete Edition unlocks the full skills inventory."
              )}
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <li
                  key={s.id}
                  className={
                    s.isCore ? "badge badge-strong" : "badge badge-unknown"
                  }
                >
                  {s.name}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Certifications" />
          {certifications.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              None. A mandatory certification gap is a strong signal to skip a
              role — recording yours either way makes that detection honest.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
              {certifications.map((c) => (
                <li key={c.id}>
                  {c.name} {c.issuer ? `— ${c.issuer}` : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Projects" />
          {projects.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">None recorded.</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
              {projects.map((p) => (
                <li key={p.id}>
                  {p.name}
                  {p.techStack.length ? ` — ${p.techStack.join(", ")}` : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
