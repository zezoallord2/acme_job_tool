import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { trackerRows, applicationFunnel } from "@/services/application-service";
import { hasCapability } from "@/services/entitlement-service";
import {
  Card,
  CardHeader,
  EmptyState,
  StatusBadge,
  FitBadge,
  Alert,
  Stat,
} from "@/components/ui/primitives";
import { TrackerTable } from "@/components/tracker-table";
import { KanbanBoard } from "@/components/kanban-board";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Applications" };

export default async function ApplicationsPage() {
  const user = await requireUser();
  const [rows, funnel, isComplete] = await Promise.all([
    trackerRows(user.id),
    applicationFunnel(user.id),
    hasCapability(user.id, "APPLICATION_TRACKER"),
  ]);

  const needsAction = rows.filter(
    (r) =>
      ["SAVED", "READY_TO_APPLY", "APPLIED", "SCREENING"].includes(r.status) &&
      r.nextAction,
  );
  const interviews = rows.filter((r) => r.interviewDate);
  const offers = rows.filter((r) => r.status === "OFFER");
  const closed = rows.filter((r) =>
    ["REJECTED", "WITHDRAWN", "ARCHIVED"].includes(r.status),
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
            Applications
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Every application keeps a permanent capsule of exactly what you
            sent.
          </p>
        </div>
        <Link href="/app/jobs/new" className="btn-primary">
          Add an application
        </Link>
      </header>

      {!isComplete ? (
        <Alert tone="info" title="Free view">
          You can track {3} saved applications on the Starter plan and use the
          table view. Complete Edition adds the Needs Action and Interviews
          views, the kanban board and unlimited applications.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total" value={rows.length} />
        <Stat
          label="Needs action"
          value={needsAction.length}
          tone={needsAction.length ? "warning" : undefined}
        />
        <Stat label="Interviews" value={interviews.length} />
        <Stat
          label="Offers"
          value={offers.length}
          tone={offers.length ? "positive" : undefined}
        />
        <Stat label="Closed" value={closed.length} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Your job hunt starts here."
          description="Add a job description and Acme Jobs will build the application record, the evidence matrix and the next action for you."
          action={
            <Link href="/app/jobs/new" className="btn-primary">
              Analyze Your First Job
            </Link>
          }
        />
      ) : (
        <Card>
          <CardHeader
            title="Application tracker"
            description="Sortable table. Every row opens the Application Capsule."
          />
          <TrackerTable rows={rows} />
        </Card>
      )}

      {isComplete && rows.length > 0 ? (
        <>
          <Card>
            <CardHeader
              title="Needs action"
              description="Applications with an unfinished next step."
            />
            <ul className="space-y-2">
              {needsAction.length === 0 ? (
                <li className="text-sm text-[var(--text-muted)]">
                  Nothing needs action right now.
                </li>
              ) : (
                needsAction.map((r) => (
                  <li
                    key={r.id}
                    className="card-muted flex flex-wrap items-center gap-3 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/app/applications/${r.id}`}
                        className="text-sm font-medium text-[var(--text)] underline"
                      >
                        {r.company ?? "Company not set"}
                      </Link>
                      <span className="block text-xs text-[var(--text-muted)]">
                        {r.role ?? "Role not set"} · {r.nextAction}
                        {r.nextActionDue
                          ? ` · due ${formatDate(r.nextActionDue)}`
                          : ""}
                      </span>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))
              )}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Kanban"
              description="Drag-free board view by state, for a quick read of where things stand."
            />
            <KanbanBoard
              columns={[
                {
                  label: "Saved",
                  rows: rows.filter((r) => r.status === "SAVED"),
                },
                {
                  label: "Ready to apply",
                  rows: rows.filter((r) => r.status === "READY_TO_APPLY"),
                },
                {
                  label: "Applied",
                  rows: rows.filter((r) => r.status === "APPLIED"),
                },
                {
                  label: "Interview",
                  rows: rows.filter((r) =>
                    ["INTERVIEW", "FINAL_INTERVIEW"].includes(r.status),
                  ),
                },
                { label: "Offer", rows: offers },
              ]}
            />
          </Card>
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["REJECTED", "WITHDRAWN", "ARCHIVED", "OFFER"] as const).map((s) => (
          <Stat
            key={s}
            label={s.replace(/_/g, " ").toLowerCase()}
            value={funnel[s] ?? 0}
          />
        ))}
      </div>

      {isComplete ? (
        <Card>
          <CardHeader
            title="Interviews"
            description="Upcoming and recorded interviews."
          />
          {interviews.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No interviews scheduled yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {interviews.map((r) => (
                <li key={r.id} className="text-sm text-[var(--text-muted)]">
                  {r.company} · {r.role} · {formatDate(r.interviewDate)}
                  {r.evidenceFit ? (
                    <FitBadge fit={r.evidenceFit as never} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
