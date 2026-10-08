import Link from "next/link";
import type { ConsistencyIssue } from "@/domain/readiness";
import { Alert } from "@/components/ui/primitives";

export function ResumeQuickCheck({
  issues,
  canInspect,
}: {
  issues: ConsistencyIssue[];
  canInspect: boolean;
}) {
  const blockers = issues.filter((i) => i.severity === "BLOCKER");
  const warnings = issues.filter((i) => i.severity === "WARNING");

  return (
    <div className="space-y-2">
      <Alert
        tone={
          blockers.length ? "error" : warnings.length ? "warning" : "success"
        }
        title={`Resume Quick Check — ${blockers.length} blocking, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`}
      >
        {blockers.length === 0 && warnings.length === 0
          ? "No contradictions found between this resume and your career records."
          : "Each item below is a specific contradiction between this document and your authoritative records."}
      </Alert>

      {issues.length > 0 ? (
        <ul className="space-y-1.5">
          {issues.map((i) => (
            <li key={i.id} className="card-muted p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    i.severity === "BLOCKER"
                      ? "badge badge-missing"
                      : "badge badge-partial"
                  }
                >
                  {i.type.replace(/_/g, " ").toLowerCase()}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--text)]">{i.message}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {i.suggestion}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {canInspect ? (
        <Link href="/app/claims" className="btn-secondary">
          Open Truth Check
        </Link>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">
          The Truth Check, which lets you fix these at source, is part of
          Complete Edition.
        </p>
      )}
    </div>
  );
}
