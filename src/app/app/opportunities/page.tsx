import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { opportunityRows } from "@/services/ask-acme-service";
import { scoreOpportunities } from "@/domain/matching";
import { hasCapability } from "@/services/entitlement-service";
import {
  Card,
  CardHeader,
  EmptyState,
  Alert,
  Stat,
  FitBadge,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Best Jobs" };

export default async function OpportunitiesPage() {
  const user = await requireUser();
  const isComplete = await hasCapability(user.id, "EFFORT_VS_OPPORTUNITY");
  const rows = isComplete ? await opportunityRows(user.id) : [];
  const scored = isComplete ? scoreOpportunities(rows) : [];

  const apply = scored.filter((s) => s.recommendation === "APPLY").length;
  const review = scored.filter((s) => s.recommendation === "REVIEW").length;
  const low = scored.filter((s) => s.recommendation === "LOW_PRIORITY").length;
  const skip = scored.filter((s) => s.recommendation === "SKIP").length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-[var(--text)]">Best Jobs</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Where should you spend your next hour? Ranked by evidence coverage and
          critical gaps against the tailoring effort each role demands. This is
          a prioritisation aid, not a prediction of who will hire you.
        </p>
      </header>

      {!isComplete ? (
        <Alert tone="info" title="Free view">
          The comparison table is part of Complete Edition. Add more roles and
          upgrade to see which hour is best spent.
        </Alert>
      ) : null}

      {isComplete ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Apply" value={apply} tone="positive" />
          <Stat label="Review" value={review} tone="warning" />
          <Stat label="Low priority" value={low} />
          <Stat label="Skip" value={skip} tone="negative" />
        </div>
      ) : null}

      {!isComplete ? (
        <EmptyState
          title="Compare where your next hour is worth the most"
          description="Complete Edition ranks saved roles by evidence coverage, critical gaps, deadlines and tailoring effort."
          action={
            <Link href="/pricing" className="btn-primary">
              Compare plans
            </Link>
          }
        />
      ) : scored.length === 0 ? (
        <EmptyState
          title="Nothing to compare yet"
          description="Add two or more job descriptions and Acme Jobs will rank them by how much opportunity each represents against the work required."
          action={
            <Link href="/app/jobs/new" className="btn-primary">
              Add a job
            </Link>
          }
        />
      ) : (
        <Card>
          <CardHeader
            title="Ranked list"
            description="Highest net value first: opportunity minus effort."
          />
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Company / role</th>
                  <th scope="col">Fit</th>
                  <th scope="col">Coverage</th>
                  <th scope="col">Critical gaps</th>
                  <th scope="col">Tailoring effort</th>
                  <th scope="col">Deadline</th>
                  <th scope="col">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {scored.map((s, i) => (
                  <tr key={s.applicationId}>
                    <td className="tabular-nums">{i + 1}</td>
                    <td>
                      <Link
                        href={`/app/applications/${s.applicationId}`}
                        className="font-medium text-[var(--text)] underline"
                      >
                        {s.company}
                      </Link>
                      <span className="block text-xs text-[var(--text-muted)]">
                        {s.role}
                      </span>
                    </td>
                    <td>
                      <FitBadge fit={s.fitClassification} />
                    </td>
                    <td className="tabular-nums">
                      {Math.round(s.coveragePercent * 100)}%
                    </td>
                    <td className="tabular-nums">{s.criticalGapCount}</td>
                    <td className="capitalize">
                      {s.tailoringEffort.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="text-xs">{formatDate(s.deadline)}</td>
                    <td>
                      <span
                        className={
                          s.recommendation === "APPLY"
                            ? "badge badge-strong"
                            : s.recommendation === "REVIEW"
                              ? "badge badge-partial"
                              : s.recommendation === "LOW_PRIORITY"
                                ? "badge badge-unknown"
                                : "badge badge-missing"
                        }
                      >
                        {s.recommendation.replace(/_/g, " ").toLowerCase()}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                        net value {s.netValue}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {isComplete && scored.length > 0 ? (
        <Card>
          <CardHeader title="How the ranking works" />
          <p className="text-sm text-[var(--text-muted)]">
            Net value = (fit score × 2 + coverage × 3 − critical gaps × 1.5 +
            your priority bonus + deadline proximity) − (tailoring effort × 2).
            Every input is a value already shown in your match breakdown, so you
            can check the arithmetic yourself. No outcome prediction is
            involved.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
