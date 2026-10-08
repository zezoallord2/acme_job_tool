import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  listLearningEvents,
  listPendingProposals,
  globalProductInsights,
} from "@/services/learning-service";
import { prisma } from "@/lib/db";
import {
  Card,
  CardHeader,
  EmptyState,
  Alert,
  Stat,
} from "@/components/ui/primitives";
import { ProposalActions } from "@/components/proposal-actions";
import { formatDate } from "@/lib/utils";
import { hasCapability } from "@/services/entitlement-service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Learning" };

const EVENT_LABELS: Record<string, string> = {
  NEW_EVIDENCE_DISCOVERED: "New evidence discovered",
  INTERVIEW_GAP_DISCOVERED: "Interview gap discovered",
  STRONG_STORY_IDENTIFIED: "Strong story identified",
  REPEATED_REJECTION_PATTERN: "Repeated rejection pattern",
  POSITIVE_RESPONSE_PATTERN: "Positive response pattern",
  MISSING_SKILL_PATTERN: "Missing skill pattern",
  USER_FEEDBACK: "User feedback",
  WORKFLOW_FAILURE: "Workflow event",
  OUTCOME_RECORDED: "Outcome recorded",
  USER_PREFERENCE_SIGNAL: "Preference signal",
};

export default async function LearningPage() {
  const user = await requireUser();
  const [events, proposals, feedback, insights, canReview] = await Promise.all([
    listLearningEvents(user.id, 50),
    listPendingProposals(user.id),
    prisma.aIInteractionFeedback.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { interaction: { select: { workflowId: true } } },
    }),
    globalProductInsights(),
    hasCapability(user.id, "CAREER_LEARNING"),
  ]);

  const accepted = events.filter((e) => e.actionStatus === "ACCEPTED").length;
  const ignored = events.filter((e) => e.actionStatus === "IGNORED").length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-[var(--text)]">Learning</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          What Acme Jobs has noticed about your search. Observations never
          become career facts without your confirmation, and no pattern is ever
          described as a cause.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Observations" value={events.length} />
        <Stat
          label="Proposals pending"
          value={proposals.length}
          tone={proposals.length ? "warning" : undefined}
        />
        <Stat label="Accepted" value={accepted} tone="positive" />
        <Stat label="Ignored" value={ignored} />
      </div>

      <Alert tone="info" title="Nothing is changed silently">
        When Acme Jobs infers something, it creates a proposal with Add / Review
        / Ignore. Career facts are only ever changed by an explicit action from
        you.
      </Alert>

      {!canReview ? (
        <Alert
          tone="info"
          title="Career Learning Review is a Complete Edition feature"
        >
          Your existing observations stay visible. Complete Edition lets you
          review proposals and turn approved discoveries into evidence.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Evidence proposals"
          description="Suggested additions to My Experience, discovered from what you described in interviews."
        />
        {proposals.length === 0 ? (
          <EmptyState
            title="No proposals right now"
            description="After a post-interview review, anything you described that is not yet in your ledger appears here for confirmation."
            action={
              <Link href="/app/interviews" className="btn-primary">
                Review an interview
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {proposals.map((p) => (
              <li key={p.id} className="card-muted p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text)]">
                      {p.proposedStatement}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {p.sourceDescription} · confidence{" "}
                      {p.confidence.toLowerCase()}
                    </p>
                  </div>
                  {canReview ? <ProposalActions proposalId={p.id} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Observations"
          description="Raw signals with their occurrence count. Repeated observations consolidate instead of duplicating."
        />
        {events.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No observations recorded yet.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Observation</th>
                  <th scope="col">Seen</th>
                  <th scope="col">Confidence</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="text-xs">
                      {EVENT_LABELS[e.eventType] ?? e.eventType}
                    </td>
                    <td className="text-sm">{e.observation}</td>
                    <td className="tabular-nums">{e.occurrenceCount}×</td>
                    <td className="text-xs">
                      {e.confidenceCategory.toLowerCase()}
                    </td>
                    <td className="text-xs">
                      {e.acceptedByUser
                        ? "accepted"
                        : e.actionStatus.toLowerCase()}
                    </td>
                    <td className="text-xs">{formatDate(e.lastObservedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {feedback.length > 0 ? (
        <Card>
          <CardHeader
            title="Your feedback"
            description="Recorded to improve future prompt versions."
          />
          <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
            {feedback.map((f) => (
              <li key={f.id}>
                {f.vote === "HELPFUL" ? "👍" : "👎"} {f.interaction.workflowId}{" "}
                — {f.reasons.join(", ") || "no reason given"}
                {f.comment ? ` — ${f.comment}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Product-wide signals"
          description="Aggregated and anonymised. Acme Jobs does not learn individual private facts globally."
        />
        <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
          {insights.map((i) => (
            <li key={i.metric}>
              <strong className="text-[var(--text)]">
                {i.metric.replace(/_/g, " ")}:
              </strong>{" "}
              {i.value} — {i.note}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
