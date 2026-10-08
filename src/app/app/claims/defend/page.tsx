import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasCapability } from "@/services/entitlement-service";
import { listUnverifiedClaims } from "@/services/claim-service";
import { ClaimDefensePanel } from "@/components/coaching-panels";
import { Alert, Card, CardHeader, Stat } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claim Defense" };

/**
 * Can you defend this claim?
 *
 * The classifier is allowed to say "overstated". It is not allowed to rewrite
 * the claim so that it passes, and the suggested wording is never applied to
 * anything.
 */
export default async function ClaimDefensePage() {
  const user = await requireUser();
  const [canDefend, unverified] = await Promise.all([
    hasCapability(user.id, "CLAIM_INSPECTOR"),
    listUnverifiedClaims(user.id),
  ]);

  const claimCount = await prisma.generatedClaim.count({
    where: { userId: user.id },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-[var(--text)]">Claim Defense</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Paste a claim from your resume and find out whether you could actually
          defend it in an interview. A bad verdict is more useful than a
          comfortable one.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Claims tracked" value={claimCount} />
        <Stat
          label="Unverified"
          value={unverified.length}
          tone={unverified.length ? "warning" : undefined}
        />
        <Stat
          label="Hand-written proofs"
          value={claimCount > 0 ? "Optional" : "None yet"}
        />
      </div>

      {!canDefend ? (
        <Alert tone="info" title="Claim Defense is a Complete Edition feature">
          Starter still includes the Truth Check, which shows which claims lack
          evidence. Complete Edition adds the interactive defense check.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Test a claim"
          description="Acme Jobs classifies the claim as defensible, partially supported, or overstated, then tells you what you can honestly say instead."
        />
        {canDefend ? (
          <ClaimDefensePanel />
        ) : (
          <Link href="/app/settings" className="btn-primary">
            Upgrade to unlock
          </Link>
        )}
      </Card>

      {canDefend && unverified.length > 0 ? (
        <Card>
          <CardHeader
            title="Claims waiting on you"
            description="Start with the ones your ledger cannot yet support."
          />
          <ul className="space-y-2">
            {unverified.slice(0, 8).map((c) => (
              <li key={c.id} className="card-muted p-3">
                <p className="text-sm text-[var(--text)]">{c.claimText}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {c.verificationState.replace(/_/g, " ").toLowerCase()} ·{" "}
                  {c.riskLevel.toLowerCase()} risk · {c.links.length} linked
                  record
                  {c.links.length === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="text-xs text-[var(--text-muted)]">
        A defense check never edits your resume, your ledger or your claims. It
        reports; you decide.
      </p>
    </div>
  );
}
