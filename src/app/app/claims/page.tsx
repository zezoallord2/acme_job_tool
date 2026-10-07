import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listUnverifiedClaims } from "@/services/claim-service";
import { hasCapability } from "@/services/entitlement-service";
import {
  Card,
  CardHeader,
  EmptyState,
  ClaimBadge,
  Alert,
} from "@/components/ui/primitives";
import { ClaimActions } from "@/components/claim-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claim Inspector" };

export default async function ClaimsPage() {
  const user = await requireUser();
  const isComplete = await hasCapability(user.id, "CLAIM_INSPECTOR");
  const claims = await listUnverifiedClaims(user.id);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
            Claim Inspector
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Every generated claim, with the evidence behind it and what was
            excluded. Green is supported, amber needs your confirmation, red
            cannot be used as fact.
          </p>
        </div>
        <Link href="/app/claims/defend" className="btn-secondary">
          Claim Defense
        </Link>
      </header>

      {!isComplete ? (
        <Alert tone="info" title="Free view">
          You can see which claims are unverified. The Claim Inspector with
          Confirm / Edit / Remove / Show Evidence / Add Evidence is part of
          Complete Edition.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title={`${claims.length} claim${claims.length === 1 ? "" : "s"} needing attention`}
          description="Nothing here blocks you until you try to send an application — then the Readiness Gate refuses a clean READY."
        />
        {claims.length === 0 ? (
          <EmptyState
            title="Every claim is supported"
            description="Nothing you have generated is currently unverified, unsupported or in conflict with your evidence."
            action={
              <Link href="/app/jobs/new" className="btn-secondary">
                Analyse another job
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {claims.map((c) => (
              <li key={c.id} className="card-muted p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ClaimBadge state={c.verificationState} />
                      <span className="badge badge-unknown">
                        risk: {c.riskLevel.toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-[var(--text)]">
                      {c.claimText}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {c.explanation}
                    </p>

                    {c.links.filter((l) => l.relation === "SUPPORTS").length >
                    0 ? (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-[var(--text)]">
                          Evidence used
                        </p>
                        <ul className="mt-0.5 space-y-0.5">
                          {c.links
                            .filter((l) => l.relation === "SUPPORTS")
                            .map((l) => (
                              <li
                                key={l.id}
                                className="text-xs text-[var(--text-muted)]"
                              >
                                ✓ {l.evidence.statement} (
                                {l.evidence.sourceDescription})
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : (
                      <p
                        className="mt-2 text-xs"
                        style={{ color: "var(--color-evidence-missing)" }}
                      >
                        ✗ No evidence supports this claim.
                      </p>
                    )}

                    {c.links.filter((l) => l.relation === "EXCLUDED").length >
                    0 ? (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-[var(--text)]">
                          Excluded as unusable
                        </p>
                        <ul className="mt-0.5 space-y-0.5">
                          {c.links
                            .filter((l) => l.relation === "EXCLUDED")
                            .map((l) => (
                              <li
                                key={l.id}
                                className="text-xs text-[var(--text-muted)]"
                              >
                                ✗ {l.evidence.statement} (
                                {l.evidence.sourceDescription})
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  {isComplete ? (
                    <ClaimActions claimId={c.id} claimText={c.claimText} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
