import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayPriorities } from "@/services/ask-acme-service";
import { applicationFunnel } from "@/services/application-service";
import { evidenceStats } from "@/services/evidence-service";
import { listPendingProposals } from "@/services/learning-service";
import { getEntitlementState } from "@/services/entitlement-service";
import { UpgradePanel } from "@/components/upgrade-panel";
import { AiStatusBanner } from "@/components/ai-status-banner";
import { aiAvailability } from "@/ai/router";
import { computeCompleteness } from "@/app/actions/onboarding-actions";
import {
  Card,
  CardHeader,
  Stat,
  EmptyState,
  StatusBadge,
  FitBadge,
  Alert,
  ProgressBar,
} from "@/components/ui/primitives";
import { PriorityList } from "@/components/priority-list";
import { FunnelBar } from "@/components/funnel-bar";
import { aiAssistUsageToday } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const FUNNEL_STAGES = [
  { key: "SAVED", label: "Saved" },
  { key: "APPLIED", label: "Applied" },
  { key: "SCREENING", label: "Screening" },
  { key: "INTERVIEW", label: "Interview" },
  { key: "FINAL_INTERVIEW", label: "Final" },
  { key: "OFFER", label: "Offer" },
  { key: "REJECTED", label: "Rejected" },
] as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const entitlement = await getEntitlementState(user.id);
  const aiStatus = await aiAvailability();
  const now = new Date();
  const in24h = new Date(now.getTime() + 86_400_000);

  const [
    priorities,
    funnel,
    completeness,
    evidence,
    recent,
    interviews,
    followUpsDue,
    proposals,
    claimsNeedingAttention,
    storyCount,
    resumeCount,
    aiAssistUsage,
  ] = await Promise.all([
    entitlement.isComplete ? todayPriorities(user.id) : Promise.resolve([]),
    applicationFunnel(user.id),
    computeCompleteness(user.id),
    evidenceStats(user.id),
    prisma.application.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        job: { select: { company: true, title: true } },
        matrix: { select: { fitClassification: true } },
      },
    }),
    prisma.interview.findMany({
      where: { userId: user.id, scheduledAt: { gte: now, lte: in24h } },
      orderBy: { scheduledAt: "asc" },
      include: { application: { select: { id: true } } },
    }),
    prisma.followUp.count({
      where: { userId: user.id, status: "DRAFT", scheduledFor: { lte: now } },
    }),
    listPendingProposals(user.id),
    prisma.generatedClaim.count({
      where: {
        userId: user.id,
        verificationState: {
          in: ["UNSUPPORTED", "NEEDS_CONFIRMATION", "CONFLICTED"],
        },
      },
    }),
    prisma.starStory.count({ where: { userId: user.id } }),
    prisma.resumeVersion.count({
      where: { resume: { userId: user.id } },
    }),
    entitlement.isComplete ? Promise.resolve(0) : aiAssistUsageToday(user.id),
  ]);

  const activeCount = [
    "SAVED",
    "ANALYZING",
    "READY_TO_APPLY",
    "APPLIED",
    "SCREENING",
    "INTERVIEW",
    "FINAL_INTERVIEW",
  ].reduce((sum, s) => sum + (funnel[s as keyof typeof funnel] ?? 0), 0);
  const offers = funnel.OFFER ?? 0;
  const offerCount = offers;

  const firstRun = recent.length === 0 && completeness < 30;

  // Only shown to Free accounts: telling a paying customer what they are missing
  // would be nonsense.
  const freeUsage = entitlement.isComplete
    ? null
    : [
        {
          label: "Saved applications",
          used: recent.length,
          limit: entitlement.limits.savedApplications,
          hint: "Applications you are actively tracking.",
        },
        {
          label: "Resume versions",
          used: resumeCount,
          limit: entitlement.limits.resumeVersions,
          hint: "One tailored version per job keeps your CV honest.",
        },
        {
          label: "STAR stories",
          used: storyCount,
          limit: entitlement.limits.starStories,
          hint: "Reusable interview answers built from your evidence.",
        },
        {
          label: "Mock interview questions",
          used: 0,
          limit: entitlement.limits.mockInterviewQuestions,
          hint: "Practice questions per session.",
        },
        {
          label: "AI-assisted actions per day",
          used: Math.min(aiAssistUsage, entitlement.limits.aiAssistCallsPerDay),
          limit: entitlement.limits.aiAssistCallsPerDay,
          hint: "Resets at midnight, your local time.",
        },
      ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
            {user.name
              ? `Welcome back, ${user.name.split(" ")[0]}`
              : "Welcome back"}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            Your experience. AI-assisted. Never invented.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/jobs/new" className="btn-primary">
            Analyze a Job
          </Link>
          <Link href="/app/applications" className="btn-secondary">
            Continue Your Application
          </Link>
        </div>
      </header>

      {firstRun ? (
        <Alert tone="info" title="Your job hunt starts here.">
          Add what you have actually done, then paste one job description. Acme
          Jobs will tell you which requirements you can already prove — and
          which you cannot.
        </Alert>
      ) : null}

      {/* The AI state is shown because a broken API key used to look exactly like
          "the AI is bad": everything silently fell back to Manual Mode. */}
      {aiStatus.available ? (
        <AiStatusBanner
          available
          providerLabel={aiStatus.label}
          reason=""
          fix=""
        />
      ) : (
        <AiStatusBanner
          available={false}
          providerLabel=""
          reason={aiStatus.reason}
          fix={aiStatus.fix}
        />
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <Stat label="Active applications" value={activeCount} />
        <Stat
          label="Interviews"
          value={interviews.length}
          tone={interviews.length > 0 ? "warning" : undefined}
          hint={interviews.length > 0 ? "next 24 hours" : "none scheduled"}
        />
        <Stat
          label="Offers"
          value={offerCount}
          tone={offerCount > 0 ? "positive" : undefined}
        />
        <Stat
          label="Follow-ups due"
          value={followUpsDue}
          tone={followUpsDue > 0 ? "warning" : undefined}
        />
        <div className="card-muted px-3 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Profile completeness
          </div>
          <div className="mt-2">
            <ProgressBar value={completeness / 100} label="" />
          </div>
          <Link
            href="/app/career"
            className="mt-2 inline-block text-xs underline"
          >
            Improve my profile
          </Link>
        </div>
      </div>

      {claimsNeedingAttention > 0 ? (
        <Alert
          tone="warning"
          title={`${claimsNeedingAttention} generated claim${claimsNeedingAttention === 1 ? "" : "s"} need your decision`}
          action={
            <Link href="/app/claims" className="btn-secondary">
              Open Claim Inspector
            </Link>
          }
        >
          Unsupported claims block a clean READY status. Confirm, edit or remove
          them.
        </Alert>
      ) : null}

      {proposals.length > 0 ? (
        <Alert
          tone="info"
          title={`${proposals.length} evidence proposal${proposals.length === 1 ? "" : "s"} waiting for you`}
          action={
            <Link href="/app/learning" className="btn-secondary">
              Review
            </Link>
          }
        >
          Acme Jobs noticed something you mentioned. Nothing has been added to
          your career facts until you accept it.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Today's priorities"
            description={
              entitlement.isComplete
                ? "Ranked by your real deadlines: interview proximity, follow-up dates, unfinished work and your goal."
                : "Complete Edition ranks your real deadlines, unfinished work and highest-value next action."
            }
          />
          {entitlement.isComplete ? (
            <PriorityList items={priorities} />
          ) : (
            <Alert
              tone="info"
              title="Daily Priority Engine"
              action={
                <Link href="/pricing" className="btn-secondary">
                  Compare plans
                </Link>
              }
            >
              Your dashboard and existing work stay available. Upgrade when you
              want Acme Jobs to rank the next best action across your whole
              search.
            </Alert>
          )}
        </Card>

        <Card>
          <CardHeader title="Quick actions" />
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/app/jobs/new", label: "Analyze Job" },
              { href: "/app/resumes", label: "Tailor Resume" },
              { href: "/app/evidence/new", label: "Add Achievement" },
              { href: "/app/interviews/practice", label: "Practice Interview" },
              { href: "/app/applications", label: "Add Application" },
              { href: "/app/stories", label: "Add STAR Story" },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="btn-secondary"
                style={{ justifyContent: "flex-start", textDecoration: "none" }}
              >
                {a.label}
              </Link>
            ))}
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-[var(--text)]">
              Evidence ledger
            </h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {evidence.total} record{evidence.total === 1 ? "" : "s"} ·{" "}
              {evidence.counts.VERIFIED ?? 0} verified ·{" "}
              {evidence.counts.USER_CONFIRMED ?? 0} confirmed ·{" "}
              {evidence.counts.UNVERIFIED ?? 0} unverified
            </p>
            <Link href="/app/evidence" className="btn-ghost mt-2">
              Open the ledger
            </Link>
          </div>
        </Card>
      </div>

      {freeUsage ? (
        <UpgradePanel
          usage={freeUsage}
          paidCheckout={process.env.WHOP_PAID_CHECKOUT_URL ?? null}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent applications"
            description="Newest first. Open one to continue where you left off."
            action={
              <Link href="/app/applications" className="btn-ghost">
                View all
              </Link>
            }
          />
          {recent.length === 0 ? (
            <EmptyState
              title="Your job hunt starts here."
              description="Paste a job description and Acme Jobs will build the evidence matrix, so you know before you spend an hour tailoring."
              action={
                <Link href="/app/jobs/new" className="btn-primary">
                  Analyze Your First Job
                </Link>
              }
            />
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {recent.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/app/applications/${a.id}`}
                      className="text-sm font-medium text-[var(--text)] underline"
                    >
                      {a.job?.company ?? "Company not set"}
                    </Link>
                    <span className="block truncate text-xs text-[var(--text-muted)]">
                      {a.job?.title ?? "Role not set"}
                      {a.nextAction ? ` · ${a.nextAction}` : ""}
                    </span>
                  </div>
                  {a.matrix?.fitClassification ? (
                    <FitBadge fit={a.matrix.fitClassification} />
                  ) : null}
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Application funnel"
            description="Where your applications currently sit."
          />
          <FunnelBar
            stages={FUNNEL_STAGES.map((s) => ({
              label: s.label,
              value: funnel[s.key] ?? 0,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
