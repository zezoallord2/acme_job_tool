import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listEvidence, evidenceStats } from "@/services/evidence-service";
import { hasCapability } from "@/services/entitlement-service";
import {
  Card,
  CardHeader,
  EmptyState,
  VerificationBadge,
  Stat,
  Alert,
} from "@/components/ui/primitives";
import { EvidenceForm } from "@/components/evidence-form";
import { EvidenceVerificationButtons } from "@/components/evidence-verification-buttons";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evidence Ledger" };

export default async function EvidencePage() {
  const user = await requireUser();
  const [evidence, stats, isComplete] = await Promise.all([
    listEvidence(user.id),
    evidenceStats(user.id),
    hasCapability(user.id, "EVIDENCE_LEDGER_FULL"),
  ]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
            Evidence Ledger
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            What is factually true about your career. AI may only use verified
            or user-confirmed records as fact — everything else is surfaced as
            unverified rather than quietly used.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/evidence/discover" className="btn-secondary">
            Discover evidence
          </Link>
          <Link href="/app/evidence/new" className="btn-primary">
            Add evidence
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat
          label="Verified"
          value={stats.counts.VERIFIED ?? 0}
          tone="positive"
        />
        <Stat
          label="Confirmed"
          value={stats.counts.USER_CONFIRMED ?? 0}
          tone="positive"
        />
        <Stat
          label="Unverified"
          value={stats.counts.UNVERIFIED ?? 0}
          tone="warning"
        />
        <Stat
          label="Conflicted"
          value={stats.counts.CONFLICTED ?? 0}
          tone="negative"
        />
        <Stat label="Rejected" value={stats.counts.REJECTED ?? 0} />
      </div>

      {!isComplete ? (
        <Alert tone="info" title="Free ledger">
          You can record, confirm and reject evidence. Complete Edition adds
          Achievement Mining, Target Role Blueprint and evidence-linked resume
          tailoring.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title={`${evidence.length} record${evidence.length === 1 ? "" : "s"}`}
          description="Green means usable as fact. Amber means the system will not use it until you confirm it."
        />
        {evidence.length === 0 ? (
          <EmptyState
            title="No evidence recorded yet"
            description="Start with one thing you did that you could defend in an interview. The more real detail you add, the more useful every later suggestion becomes."
            action={
              <Link href="/app/evidence/new" className="btn-primary">
                Add your first achievement
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {evidence.map((e) => (
              <li key={e.id} className="card-muted p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text)]">{e.statement}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <VerificationBadge status={e.verificationStatus} />
                      <span className="badge badge-unknown">
                        {e.claimType.replace(/_/g, " ").toLowerCase()}
                      </span>
                      <span className="badge badge-unknown">
                        {e.sourceType.replace(/_/g, " ").toLowerCase()}
                      </span>
                      {e.metricValue !== null ? (
                        <span className="badge badge-partial">
                          {e.metricValue} {e.metricUnit} ·{" "}
                          {e.metricStatus.replace(/_/g, " ").toLowerCase()}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                      Source: {e.sourceDescription}
                      {e.lastConfirmedAt
                        ? ` · confirmed ${formatDate(e.lastConfirmedAt)}`
                        : ""}
                    </p>
                  </div>
                  <EvidenceVerificationButtons
                    evidenceId={e.id}
                    current={e.verificationStatus}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isComplete ? (
        <Card>
          <CardHeader
            title="Add evidence"
            description="Record what you did, where it came from, and whether a number is verified or your estimate."
          />
          <EvidenceForm />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Add evidence" />
          <EvidenceForm />
        </Card>
      )}
    </div>
  );
}
