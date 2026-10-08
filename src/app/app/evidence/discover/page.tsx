import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasCapability } from "@/services/entitlement-service";
import { listPendingProposals } from "@/services/learning-service";
import {
  AchievementMiningPanel,
  EvidenceExtractionPanel,
} from "@/components/coaching-panels";
import { Alert, Card, CardHeader, Stat } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover evidence" };

/**
 * Turns what the user already knows into ledger material.
 *
 * Both tools here produce PROPOSALS. That is the point: Acme Jobs can surface
 * something you said three months ago, but it cannot decide it is a fact.
 */
export default async function DiscoverEvidencePage() {
  const user = await requireUser();
  const [canMine, pending] = await Promise.all([
    hasCapability(user.id, "ACHIEVEMENT_MINING"),
    listPendingProposals(user.id),
  ]);

  const evidenceCount = await prisma.evidence.count({
    where: { userId: user.id, verificationStatus: { notIn: ["REJECTED"] } },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-[var(--text)]">Discover evidence</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Most people have achievements they never wrote down. Describe the work
          in your own words, or let Acme Jobs ask you about one achievement
          until it can be defended.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="In your ledger" value={evidenceCount} />
        <Stat
          label="Awaiting review"
          value={pending.length}
          tone={pending.length ? "warning" : undefined}
        />
        <Stat
          label="Needs your approval"
          value={pending.length > 0 ? "Yes" : "No"}
          tone={pending.length ? "warning" : "positive"}
        />
      </div>

      {pending.length > 0 ? (
        <Alert tone="info" title={`${pending.length} proposal(s) waiting`}>
          Nothing here has entered My Experience.{" "}
          <Link href="/app/learning">Review the proposals</Link> and accept only
          what you can defend in an interview.
        </Alert>
      ) : null}

      {!canMine ? (
        <Alert tone="info" title="Find My Wins is a Complete Edition feature">
          Starter can still build the ledger by hand with Add evidence. Complete
          Edition adds Evidence Extraction and Find My Wins, which turn what you
          already know into reviewable proposals.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Evidence Extraction"
          description="Paste a description of work you have done. Acme Jobs pulls out discrete, defensible statements — and keeps every number you gave, without adding any."
        />
        {canMine ? (
          <EvidenceExtractionPanel />
        ) : (
          <Link href="/app/settings" className="btn-primary">
            Upgrade to unlock
          </Link>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Find My Wins"
          description="One question at a time until the story holds up: what you did, the problem, the tools, the people, the result, and the number."
        />
        {canMine ? (
          <AchievementMiningPanel />
        ) : (
          <Link href="/app/settings" className="btn-primary">
            Upgrade to unlock
          </Link>
        )}
      </Card>

      <p className="text-xs text-[var(--text-muted)]">
        Use one-click AI when it is available on your plan, or open Manual Mode
        as a no-cost fallback. Acme Jobs validates every response before it is
        stored.
      </p>
    </div>
  );
}
