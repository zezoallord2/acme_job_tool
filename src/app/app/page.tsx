import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayPriorities } from "@/services/ask-acme-service";
import { listApplications } from "@/services/application-service";
import { getEntitlementState } from "@/services/entitlement-service";
import { computeCompleteness } from "@/app/actions/onboarding-actions";
import { aiAvailability } from "@/ai/router";
import { searchForYou, type JobsForYouResult } from "@/jobs/discovery";
import { CvImportCard } from "@/components/cv-import-card";
import { AiStatusBanner } from "@/components/ai-status-banner";
import { PriorityList } from "@/components/priority-list";
import {
  Card,
  CardHeader,
  EmptyState,
  ProgressBar,
  StatusBadge,
} from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Home" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [
    entitlement,
    priorities,
    applications,
    completeness,
    aiStatus,
    profile,
    skills,
  ] = await Promise.all([
    getEntitlementState(user.id),
    todayPriorities(user.id),
    listApplications(user.id),
    computeCompleteness(user.id),
    aiAvailability(),
    prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { firstName: true, locationCity: true, workArrangement: true },
    }),
    prisma.skill.findMany({
      where: { userId: user.id },
      orderBy: [{ isCore: "desc" }, { sortOrder: "asc" }],
      take: 20,
      select: { name: true },
    }),
  ]);

  // Same service, same pipeline and same limits as the Jobs for You page.
  const jobsDiscovery: JobsForYouResult | null = await searchForYou({
    userId: user.id,
    maxResults: entitlement.isComplete ? 4 : 2,
  }).catch(() => null);
  const jobsForYou = jobsDiscovery?.results ?? [];
  const jobsGoal = jobsDiscovery?.profile.primaryTargetRoles[0] ?? null;
  const active = applications.filter(
    (application) =>
      !["OFFER", "REJECTED", "WITHDRAWN", "ARCHIVED"].includes(
        application.status,
      ),
  );

  return (
    <div className="dashboard-page space-y-7">
      <header className="dashboard-hero border-b border-[var(--border)] pb-7 pt-4">
        <p className="text-sm font-medium text-[var(--text-muted)]">
          {entitlement.isComplete ? "Complete plan" : "Starter plan"}
        </p>
        <h1 className="page-title mt-2">
          {profile?.firstName
            ? `Welcome back, ${profile.firstName}`
            : "Welcome back"}
        </h1>
        <p className="lede mt-2">What would you like to do today?</p>
      </header>

      <section
        aria-label="Quick actions"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            href: "/app/jobs",
            title: "Find Jobs",
            detail: "See openings matched to your profile",
          },
          {
            href: "/app/tailor",
            title: "Tailor Resume",
            detail: "Adapt your resume for one job",
          },
          {
            href: "/app/interviews/practice",
            title: "Practice Interview",
            detail: "Get role-specific questions",
          },
          {
            href: "/app/profile",
            title: "Update Profile",
            detail: "Add skills, wins or a new CV",
          },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="quick-action card block p-4 no-underline"
          >
            <h2 className="font-semibold text-[var(--text)]">{action.title}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {action.detail}
            </p>
          </Link>
        ))}
      </section>

      {!aiStatus.available ? (
        <AiStatusBanner
          available={false}
          providerLabel=""
          reason={aiStatus.reason}
          fix={aiStatus.fix}
        />
      ) : null}
      {completeness < 35 ? (
        <CvImportCard
          hasProfile={completeness > 0}
          isComplete={entitlement.isComplete}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Today's Tasks"
            description="Based on real dates, unfinished applications and your profile—not generic advice."
          />
          <PriorityList items={priorities.slice(0, 5)} />
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader
            title="Profile setup"
            description={
              completeness >= 80
                ? "Your profile has enough detail for useful matching."
                : "More detail makes job matching and tailoring more useful."
            }
          />
          <ProgressBar
            value={completeness / 100}
            label={`${completeness}% complete`}
          />
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            {skills.length < 5
              ? `Add ${5 - skills.length} more skill${5 - skills.length === 1 ? "" : "s"} to improve matching.`
              : "Add work achievements with real examples to make tailoring stronger."}
          </p>
          <Link href="/app/profile" className="btn-secondary mt-4">
            Improve My Profile
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Jobs for You"
            description={
              jobsGoal
                ? `Matched using your CV and "${jobsGoal}"`
                : "Add a job goal to start matching."
            }
            action={
              <Link href="/app/jobs" className="btn-ghost">
                See all
              </Link>
            }
          />
          {jobsForYou.length === 0 ? (
            <EmptyState
              title={
                jobsGoal ? "No matches found right now" : "Add your job goal"
              }
              description={
                jobsGoal
                  ? "Refresh Jobs for You, or relax the location check there."
                  : "Tell Acme what role you want so it can search real public listings."
              }
              action={
                <Link
                  href={jobsGoal ? "/app/jobs" : "/app/profile"}
                  className="btn-primary"
                >
                  {jobsGoal ? "Open Jobs for You" : "Set job goal"}
                </Link>
              }
            />
          ) : (
            <ul
              className="mt-2 divide-y"
              style={{ borderColor: "var(--border)" }}
            >
              {jobsForYou.map(({ job, fit }) => (
                <li key={`${job.provider}:${job.externalId}`} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <a
                        href={job.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium underline"
                      >
                        {job.title}
                      </a>
                      <p className="text-xs text-[var(--text-muted)]">
                        {job.company} · {job.location}
                      </p>
                    </div>
                    <span
                      className={
                        fit.label === "Strong Match"
                          ? "badge badge-strong"
                          : fit.label === "Good Match"
                            ? "badge badge-good"
                            : fit.label === "Possible Match"
                              ? "badge badge-partial"
                              : "badge badge-missing"
                      }
                    >
                      {fit.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {fit.reasons[0]}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {!entitlement.isComplete &&
          jobsDiscovery &&
          jobsDiscovery.totalMatched > jobsForYou.length ? (
            <Link
              href="/pricing"
              className="mt-3 inline-block text-sm underline"
            >
              Unlock {jobsDiscovery.totalMatched - jobsForYou.length} more
              matches
            </Link>
          ) : null}
        </Card>

        <Card>
          <CardHeader
            title="My Applications"
            description={`${active.length} active · ${applications.length} total`}
            action={
              <Link href="/app/applications" className="btn-ghost">
                Open board
              </Link>
            }
          />
          {applications.length === 0 ? (
            <EmptyState
              title="No applications yet"
              description="Save a job and Acme will keep the next step, resume and interview work together."
              action={
                <Link href="/app/jobs" className="btn-primary">
                  Find a job
                </Link>
              }
            />
          ) : (
            <ul
              className="mt-2 divide-y"
              style={{ borderColor: "var(--border)" }}
            >
              {applications.slice(0, 5).map((application) => (
                <li
                  key={application.id}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/app/applications/${application.id}`}
                      className="font-medium underline"
                    >
                      {application.job?.title ?? "Untitled role"}
                    </Link>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {application.job?.company ?? "Company not set"}
                      {application.nextAction
                        ? ` · ${application.nextAction}`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge status={application.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
