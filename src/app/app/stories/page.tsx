import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listStarStories } from "@/services/interview-service";
import { getEntitlementState } from "@/services/entitlement-service";
import {
  Card,
  CardHeader,
  EmptyState,
  Alert,
  Stat,
} from "@/components/ui/primitives";
import { StarStoryForm } from "@/components/star-story-form";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "STAR Stories" };

const CATEGORY_LABELS: Record<string, string> = {
  ACHIEVEMENT: "Achievement",
  LEADERSHIP: "Leadership",
  FAILURE: "Failure",
  CONFLICT: "Conflict",
  TEAMWORK: "Teamwork",
  PROBLEM_SOLVING: "Problem solving",
  DEADLINE: "Deadline",
  CUSTOMER: "Customer",
  LEARNING: "Learning",
  INITIATIVE: "Initiative",
};

export default async function StoriesPage() {
  const user = await requireUser();
  const [stories, state] = await Promise.all([
    listStarStories(user.id),
    getEntitlementState(user.id),
  ]);
  const atLimit = stories.length >= state.limits.starStories;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          STAR Story Bank
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Reusable answers in your own words. Each story links to the evidence
          that supports it, so a weak story is visible before an interview
          rather than after.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat
          label="Stories saved"
          value={stories.length}
          hint={
            state.isComplete
              ? "Unlimited in Complete Edition"
              : `Limit ${state.limits.starStories} on Starter`
          }
        />
        <Stat
          label="Evidence-backed"
          value={stories.filter((s) => s.strength === "STRONG").length}
          tone="positive"
        />
        <Stat
          label="Used in interviews"
          value={stories.reduce((sum, s) => sum + s.usageCount, 0)}
        />
      </div>

      {atLimit ? (
        <Alert tone="warning" title="Starter limit reached">
          The Starter plan includes one STAR story. Complete Edition gives you
          the full bank across ten categories.
        </Alert>
      ) : null}

      {stories.length === 0 ? (
        <EmptyState
          title="No stories yet"
          description="Write one story you could tell out loud tomorrow. Situation, task, action, result — in plain language."
          action={
            <a href="#add" className="btn-primary">
              Add your first story
            </a>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {stories.map((s) => (
            <article key={s.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-unknown">
                  {CATEGORY_LABELS[s.category] ?? s.category}
                </span>
                <span
                  className={
                    s.strength === "STRONG"
                      ? "badge badge-strong"
                      : "badge badge-partial"
                  }
                >
                  {s.strength.toLowerCase()} evidence
                </span>
                {s.usageCount > 0 ? (
                  <span className="badge badge-unknown">
                    used {s.usageCount}×
                  </span>
                ) : null}
              </div>
              <h2 className="mt-2 text-sm font-semibold text-[var(--text)]">
                {s.title}
              </h2>
              <dl className="mt-2 space-y-1.5 text-sm">
                <Row term="Situation" value={s.situation} />
                <Row term="Task" value={s.task} />
                <Row term="Action" value={s.action} />
                <Row term="Result" value={s.result} />
                {s.learning ? <Row term="Learning" value={s.learning} /> : null}
              </dl>
              {s.evidenceIds.length > 0 ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Backed by {s.evidenceIds.length} evidence record
                  {s.evidenceIds.length === 1 ? "" : "s"}.
                </p>
              ) : (
                <p
                  className="mt-2 text-xs"
                  style={{ color: "var(--color-evidence-partial)" }}
                >
                  No evidence linked — this story is your claim, not yet your
                  evidence.
                </p>
              )}
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Updated {formatDate(s.updatedAt)}
              </p>
            </article>
          ))}
        </div>
      )}

      <div id="add">
        <Card>
          <CardHeader
            title="Add a STAR story"
            description="Write it as you would say it. Link evidence ids from your ledger if you have them."
          />
          <StarStoryForm disabled={atLimit} />
        </Card>
      </div>

      <p className="text-sm">
        <Link href="/app/interviews" className="underline">
          Back to interviews
        </Link>
      </p>
    </div>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {term}
      </dt>
      <dd className="text-sm text-[var(--text)]">{value}</dd>
    </div>
  );
}
