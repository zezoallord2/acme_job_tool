import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  listUnverifiedClaims,
  evaluateApplicationReadiness,
} from "@/services/claim-service";
import { getApplication as getApp } from "@/services/application-service";
import { hasCapability } from "@/services/entitlement-service";
import { allowedTransitions, STATUS_LABELS } from "@/domain/application-state";
import {
  Card,
  CardHeader,
  StatusBadge,
  FitBadge,
  ReadinessBadge,
  Alert,
  EmptyState,
  ClaimBadge,
} from "@/components/ui/primitives";
import { TransitionButtons } from "@/components/transition-buttons";
import { OutcomeButtons } from "@/components/outcome-buttons";
import { formatDate } from "@/lib/utils";
import type { ApplicationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Application" };

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const user = await requireUser();
  const { applicationId } = await params;

  let app: Awaited<ReturnType<typeof getApp>>;
  try {
    app = await getApp(user.id, applicationId);
  } catch {
    // A missing or foreign id must return 404, never a 500 and never any hint
    // about whether the object exists.
    notFound();
  }
  const isComplete = await hasCapability(user.id, "APPLICATION_CAPSULE");

  const readiness = await evaluateApplicationReadiness({
    userId: user.id,
    applicationId,
  }).catch(() => null);
  const claims = await listUnverifiedClaims(user.id);
  const snapshot = app.snapshots[0];

  const allowed = allowedTransitions(app.status);

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
        <Link href="/app/applications" className="underline">
          Applications
        </Link>{" "}
        / {app.job?.company ?? "Company not set"}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title text-[var(--text)]">
            {app.job?.title ?? "Role not set"}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {app.job?.company ?? "Company not set"}
            {app.job?.location ? ` · ${app.job.location}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={app.status} />
            {app.fitClassification ? (
              <FitBadge fit={app.fitClassification} />
            ) : null}
            {app.appliedAt ? (
              <span className="badge badge-unknown">
                applied {formatDate(app.appliedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {app.job ? (
            <Link href={`/app/jobs/${app.jobId}`} className="btn-secondary">
              View job analysis
            </Link>
          ) : null}
          <Link
            href={`/app/applications/${app.id}/capsule`}
            className="btn-secondary"
          >
            Application Details
          </Link>
        </div>
      </header>

      {!isComplete ? (
        <Alert tone="info" title="Free view">
          You can move applications through states and record outcomes. Complete
          Edition adds Ready to Apply?, immutable Sent Versions, the full
          Application Details and interview prep.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Move this application forward"
            description="Only valid transitions are offered. Invalid moves are rejected atomically and recorded as errors."
          />
          <TransitionButtons
            applicationId={app.id}
            status={app.status}
            allowed={allowed as ApplicationStatus[]}
          />
          {app.nextAction ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Next action:{" "}
              <strong className="text-[var(--text)]">{app.nextAction}</strong>
              {app.nextActionDue
                ? ` (due ${formatDate(app.nextActionDue)})`
                : ""}
            </p>
          ) : null}
        </Card>

        <Card>
          <CardHeader
            title="Record an outcome"
            description="Outcomes feed analytics and learning."
          />
          <OutcomeButtons applicationId={app.id} />
        </Card>
      </div>

      {readiness && isComplete ? (
        <Card>
          <CardHeader
            title="Ready to Apply?"
            description="Not an ATS score. These are the concrete conditions checked before you send."
            action={<ReadinessBadge status={readiness.status} />}
          />
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            {readiness.summary}
          </p>
          <ul className="space-y-2">
            {readiness.checks.map((c) => (
              <li key={c.category} className="card-muted p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--text)]">
                    {c.label}
                  </span>
                  <span
                    className={
                      c.status === "BLOCKER"
                        ? "badge badge-missing"
                        : c.status === "WARNING"
                          ? "badge badge-partial"
                          : "badge badge-strong"
                    }
                  >
                    {c.status === "BLOCKER"
                      ? "Blocking"
                      : c.status === "WARNING"
                        ? "Warning"
                        : "Pass"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {c.detail}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {claims.length > 0 && isComplete ? (
        <Card>
          <CardHeader
            title="Claims needing your decision"
            description="These block a clean READY status until confirmed, edited or removed."
            action={
              <Link href="/app/claims" className="btn-secondary">
                Open Truth Check
              </Link>
            }
          />
          <ul className="space-y-2">
            {claims.slice(0, 5).map((c) => (
              <li key={c.id} className="card-muted p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ClaimBadge state={c.verificationState} />
                  <span className="text-sm text-[var(--text)]">
                    {c.claimText}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {c.explanation}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Resume and documents" />
          {app.resumes.length === 0 ? (
            <EmptyState
              title="No resume attached"
              description="Tailor one from your main resume. Acme Jobs will only use evidence that supports each bullet."
              action={
                isComplete ? (
                  <Link
                    href={`/app/applications/${app.id}/tailor`}
                    className="btn-primary"
                  >
                    Tailor resume
                  </Link>
                ) : (
                  <Link href="/app/settings" className="btn-primary">
                    Upgrade to tailor
                  </Link>
                )
              }
            />
          ) : (
            <ul className="space-y-2">
              {app.resumes.map((r) => (
                <li key={r.id} className="card-muted p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text)]">
                      {r.label}
                    </span>
                    {r.isMaster ? (
                      <span className="badge badge-unknown">master</span>
                    ) : null}
                    <span className="badge badge-unknown">
                      v{r.currentVersion}
                    </span>
                  </div>
                  <Link
                    href={`/app/resumes/${r.id}`}
                    className="mt-1 inline-block text-xs underline"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {app.coverLetters.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-[var(--text)]">
                Cover letter
              </h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {app.coverLetters[0]!.body.slice(0, 200)}…
              </p>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader
            title="History"
            description="Every state change is recorded."
          />
          <ol className="space-y-2">
            {app.statusEvents.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="text-[var(--text)]">
                  {e.fromStatus
                    ? `${STATUS_LABELS[e.fromStatus]} → `
                    : "Created → "}
                  {STATUS_LABELS[e.toStatus]}
                </span>
                <span className="ml-2 text-xs text-[var(--text-muted)]">
                  {formatDate(e.createdAt)}
                </span>
                {e.reason ? (
                  <span className="block text-xs text-[var(--text-muted)]">
                    {e.reason}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>

          {snapshot ? (
            <div className="mt-4 card-muted p-3">
              <h3 className="text-sm font-semibold text-[var(--text)]">
                Sent snapshot sealed
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Sealed {formatDate(snapshot.sealedAt)}. This record is immutable
                — later edits to your main resume do not change it.
              </p>
            </div>
          ) : null}

          {app.notes.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-[var(--text)]">
                Notes
              </h3>
              <ul className="mt-1 space-y-1">
                {app.notes.slice(0, 5).map((n) => (
                  <li key={n.id} className="text-sm text-[var(--text-muted)]">
                    {n.body}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>

      {app.interviews.length > 0 ? (
        <Card>
          <CardHeader title="Interviews" />
          <ul className="space-y-2">
            {app.interviews.map((i) => (
              <li key={i.id} className="text-sm text-[var(--text-muted)]">
                {i.company} · {i.role} · {formatDate(i.scheduledAt)}{" "}
                <Link href={`/app/interviews/${i.id}`} className="underline">
                  Interview Prep
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {app.followUps.length > 0 ? (
        <Card>
          <CardHeader title="Follow-ups" />
          <ul className="space-y-2">
            {app.followUps.map((f) => (
              <li key={f.id} className="card-muted p-3 text-sm">
                <span className="badge badge-unknown">
                  {f.type.replace(/_/g, " ").toLowerCase()}
                </span>{" "}
                <span className="text-[var(--text)]">
                  {f.subject ?? f.body.slice(0, 60)}
                </span>
                <span className="block text-xs text-[var(--text-muted)]">
                  {f.status.toLowerCase()} · {formatDate(f.scheduledFor)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {app.outcomes.length > 0 ? (
        <Card>
          <CardHeader title="Recorded outcomes" />
          <ul className="space-y-1 text-sm text-[var(--text-muted)]">
            {app.outcomes.map((o) => (
              <li key={o.id}>
                {o.type.replace(/_/g, " ").toLowerCase()} ·{" "}
                {formatDate(o.occurredAt)}
                {o.detail ? ` — ${o.detail}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
