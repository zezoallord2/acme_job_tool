import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { analyticsFor } from "@/services/ask-acme-service";
import { outcomePatterns } from "@/services/learning-service";
import { hasCapability } from "@/services/entitlement-service";
import {
  Card,
  CardHeader,
  EmptyState,
  Alert,
  Stat,
} from "@/components/ui/primitives";
import { OutcomeChart } from "@/components/outcome-chart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const user = await requireUser();
  const isComplete = await hasCapability(user.id, "ANALYTICS");
  const analytics = await analyticsFor(user.id);
  const patterns = await outcomePatterns(user.id);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-[var(--text)]">Analytics</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Honest counts with their formulas. Acme Jobs will not tell you that
          one project raised your interview rate, because it cannot know that.
        </p>
      </header>

      {!isComplete ? (
        <Alert tone="info" title="Free view">
          Counts are visible on Starter. Complete Edition adds the trend chart,
          formula explanations and pattern analysis.
        </Alert>
      ) : null}

      <Alert
        tone={
          analytics.sufficiency.level === "INSUFFICIENT" ? "warning" : "info"
        }
        title={
          analytics.sufficiency.level === "INSUFFICIENT"
            ? "Not enough data yet"
            : analytics.sufficiency.level === "DIRECTIONAL"
              ? "Early results"
              : "Reliable sample"
        }
      >
        {analytics.sufficiency.message}
      </Alert>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Submitted" value={analytics.applicationsSubmitted} />
        <Stat label="Replies" value={analytics.replies} />
        <Stat label="Interviews" value={analytics.interviews} />
        <Stat
          label="Offers"
          value={analytics.offers}
          tone={analytics.offers > 0 ? "positive" : undefined}
        />
        <Stat
          label="Reply rate"
          value={
            analytics.replyRate === null
              ? "—"
              : `${Math.round(analytics.replyRate * 100)}%`
          }
          tone={
            analytics.replyRate !== null && analytics.replyRate >= 0.2
              ? "positive"
              : undefined
          }
        />
        <Stat
          label="Per week"
          value={
            analytics.applicationsPerWeek === null
              ? "—"
              : analytics.applicationsPerWeek.toFixed(1)
          }
        />
      </div>

      {analytics.applicationsSubmitted === 0 ? (
        <EmptyState
          title="No outcomes recorded yet"
          description="Record outcomes on each application. Acme Jobs needs them to show reply rate, response time and honest patterns."
          action={
            <Link href="/app/applications" className="btn-primary">
              Open the tracker
            </Link>
          }
        />
      ) : isComplete ? (
        <Card>
          <CardHeader
            title="Funnel"
            description="Where your applications reached and stopped."
          />
          <OutcomeChart
            data={[
              { label: "Submitted", value: analytics.applicationsSubmitted },
              { label: "Replies", value: analytics.replies },
              { label: "Interviews", value: analytics.interviews },
              { label: "Offers", value: analytics.offers },
            ]}
          />
        </Card>
      ) : null}

      {isComplete ? (
        <Card>
          <CardHeader
            title="Formulas"
            description="Every number above, defined."
          />
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">Formula</th>
                  <th scope="col">Value</th>
                </tr>
              </thead>
              <tbody>
                {analytics.formulas.map((f) => (
                  <tr key={f.name}>
                    <td className="font-medium">{f.name}</td>
                    <td className="text-xs text-[var(--text-muted)]">
                      {f.formula}
                    </td>
                    <td className="tabular-nums">{f.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {isComplete ? (
        <Card>
          <CardHeader
            title="Observed patterns"
            description="Association only. Acme Jobs has no control group, so it never claims causation."
          />
          {patterns.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No patterns yet. Patterns need repeated observations; single data
              points are anecdotes.
            </p>
          ) : (
            <ul className="space-y-2">
              {patterns.map((p) => (
                <li key={p.attributeValue} className="card-muted p-3">
                  <p className="text-sm text-[var(--text)]">{p.statement}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {p.sufficiency.message}
                  </p>
                  <span
                    className={
                      p.sufficiency.level === "RELIABLE"
                        ? "badge badge-strong mt-1.5"
                        : "badge badge-partial mt-1.5"
                    }
                  >
                    {p.sufficiency.level.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {isComplete ? (
        <Card>
          <CardHeader title="Export" />
          <div className="flex flex-wrap gap-2">
            <a href="/api/export/applications.csv" className="btn-secondary">
              Applications CSV
            </a>
            <a href="/api/export/analytics.csv" className="btn-secondary">
              Analytics CSV
            </a>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
