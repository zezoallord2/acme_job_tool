"use client";

import Link from "next/link";
import { Alert, Card, CardHeader } from "@/components/ui/primitives";

export interface UsageRow {
  label: string;
  used: number;
  limit: number;
  hint: string;
}

/**
 * Shows a Free account exactly where it stands against its real limits, and what
 * Complete Edition changes.
 *
 * The point is honesty over pressure: every number is the server-side limit the
 * user will actually hit, so the upgrade reason is concrete rather than a
 * marketing claim.
 */
export function UpgradePanel({
  usage,
  paidCheckout,
}: {
  usage: UsageRow[];
  paidCheckout: string | null;
}) {
  const exhausted = usage.filter(
    (u) => u.limit !== Infinity && u.used >= u.limit,
  );
  const atRisk = usage.filter(
    (u) => u.limit !== Infinity && u.used < u.limit && u.used >= u.limit * 0.8,
  );

  return (
    <Card>
      <CardHeader
        title="Your Free plan"
        description="Free is a real product, not a trial. These are the exact limits you are working within."
      />

      {exhausted.length > 0 ? (
        <Alert tone="warning" title="You have hit a limit">
          {exhausted.map((u) => u.label).join(", ")} —{" "}
          {exhausted.length === 1 ? "this is" : "these are"} now capped.
          Complete Edition removes{" "}
          {exhausted.length === 1 ? "it" : "all of them"}.
        </Alert>
      ) : atRisk.length > 0 ? (
        <Alert tone="info" title="Getting close to a limit">
          {atRisk.map((u) => `${u.label} (${u.used} of ${u.limit})`).join(", ")}
          .
        </Alert>
      ) : null}

      <ul className="mt-3 space-y-2">
        {usage.map((u) => {
          const unlimited = u.limit === Infinity;
          const ratio = unlimited
            ? 0
            : Math.min(1, u.used / Math.max(1, u.limit));
          const hit = !unlimited && u.used >= u.limit;
          return (
            <li key={u.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-[var(--text)]">{u.label}</span>
                <span
                  className={hit ? "font-medium" : "text-[var(--text-muted)]"}
                  style={
                    hit ? { color: "var(--color-evidence-missing)" } : undefined
                  }
                >
                  {unlimited ? "Unlimited" : `${u.used} / ${u.limit}`}
                </span>
              </div>
              {!unlimited ? (
                <div
                  className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--color-surface-raised)" }}
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(ratio * 100)}%`,
                      background: hit
                        ? "var(--color-evidence-missing)"
                        : "var(--brand-accent)",
                    }}
                  />
                </div>
              ) : null}
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {u.hint}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 rounded-lg border border-[var(--color-border)] p-3">
        <h3 className="text-sm font-semibold text-[var(--text)]">
          What Complete Edition adds
        </h3>
        <ul className="mt-1.5 space-y-1 text-sm text-[var(--text-muted)]">
          {[
            "Unlimited applications, resume versions and STAR stories",
            "Master Resume plus advanced tailoring and a bullet builder",
            "Cover letters, LinkedIn rewrite, application answer builder",
            "Achievement Mining: turn a job description into a story you forgot",
            "Claim Inspector and Readiness Gate for interview defence",
            "Interview Command Center, application tracker and analytics",
            "Daily Priority Engine and Effort vs Opportunity",
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden style={{ color: "var(--brand-accent)" }}>
                +
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {paidCheckout ? (
            <a
              href={paidCheckout}
              className="btn-primary"
              rel="noopener noreferrer"
            >
              Upgrade to Complete
            </a>
          ) : (
            <Link href="/pricing" className="btn-primary">
              See pricing
            </Link>
          )}
          <Link href="/app/settings" className="btn-secondary">
            Your plan
          </Link>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          One-off payment. No subscription, and the free plan never expires.
        </p>
      </div>
    </Card>
  );
}
