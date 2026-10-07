import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listPendingProposals } from "@/services/learning-service";
import {
  Card,
  CardHeader,
  Alert,
  EmptyState,
} from "@/components/ui/primitives";
import { PostReviewForm } from "@/components/post-review-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Post-interview review" };

export default async function InterviewReviewPage({
  params,
}: {
  params: Promise<{ interviewId: string }>;
}) {
  const user = await requireUser();
  const { interviewId } = await params;

  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, userId: user.id },
    select: { id: true, company: true, role: true, postReview: true },
  });
  if (!interview) {
    return (
      <EmptyState
        title="Interview not found"
        description="It may belong to another account, or it may have been deleted."
        action={
          <Link href="/app/interviews" className="btn-primary">
            Back to interviews
          </Link>
        }
      />
    );
  }

  const proposals = await listPendingProposals(user.id);
  const saved = interview.postReview as Record<string, string> | null;

  return (
    <div className="max-w-[760px] space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
        <Link href="/app/interviews" className="underline">
          Interviews
        </Link>{" "}
        /{" "}
        <Link href={`/app/interviews/${interviewId}`} className="underline">
          {interview.company}
        </Link>{" "}
        / Review
      </nav>

      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Post-interview review
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {interview.company} · {interview.role}. This is preserved so future
          applications are better than the last one.
        </p>
      </header>

      <Alert
        tone="info"
        title="Nothing is added to your career facts automatically"
      >
        If you mention something you did that is not yet in your ledger, Acme
        Jobs creates a proposal. You decide whether to add it.
      </Alert>

      {proposals.length > 0 ? (
        <Card>
          <CardHeader
            title={`${proposals.length} pending evidence proposal${proposals.length === 1 ? "" : "s"}`}
            action={
              <Link href="/app/learning" className="btn-secondary">
                Review proposals
              </Link>
            }
          />
          <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
            {proposals.slice(0, 4).map((p) => (
              <li key={p.id}>• {p.proposedStatement}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="What do you remember?"
          description="Answer honestly. This is the raw material for every improvement Acme Jobs makes for you."
        />
        <PostReviewForm interviewId={interviewId} initial={saved} />
      </Card>
    </div>
  );
}
