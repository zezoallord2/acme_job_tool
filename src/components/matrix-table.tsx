import type { EvidenceStrength, RequirementPriority } from "@prisma/client";
import { StrengthBadge, PriorityBadge } from "@/components/ui/primitives";

export interface MatrixRow {
  id: string;
  strength: EvidenceStrength;
  priority: RequirementPriority;
  explanation: string;
  recommendedAction: string;
  matchBasis: string;
  isDealBreaker: boolean;
  requirement: { text: string };
  evidence: {
    id: string;
    statement: string;
    sourceDescription: string;
    verificationStatus: string;
  } | null;
}

export function MatrixTable({ matches }: { matches: MatrixRow[] }) {
  if (matches.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No requirements were extracted from this description.
      </p>
    );
  }

  return (
    <>
      {/* Desktop: full table */}
      <div className="table-wrap hidden md:block">
        <table className="data">
          <caption className="sr-only">
            Job requirements compared against your career evidence
          </caption>
          <thead>
            <tr>
              <th scope="col">Requirement</th>
              <th scope="col">Priority</th>
              <th scope="col">Your evidence</th>
              <th scope="col">Strength</th>
              <th scope="col">Recommended action</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.id}>
                <td>
                  <span className="font-medium text-[var(--text)]">
                    {m.requirement.text}
                  </span>
                  {m.isDealBreaker ? (
                    <span className="badge badge-missing ml-1.5">
                      deal breaker
                    </span>
                  ) : null}
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {m.explanation}
                  </p>
                </td>
                <td>
                  <PriorityBadge priority={m.priority} />
                </td>
                <td className="max-w-[280px]">
                  {m.evidence ? (
                    <>
                      <span className="text-sm">{m.evidence.statement}</span>
                      <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                        {m.evidence.sourceDescription} ·{" "}
                        {m.evidence.verificationStatus
                          .replace(/_/g, " ")
                          .toLowerCase()}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-[var(--text-muted)]">
                      No matching evidence found
                    </span>
                  )}
                </td>
                <td>
                  <StrengthBadge strength={m.strength} />
                </td>
                <td className="max-w-[280px] text-sm text-[var(--text-muted)]">
                  {m.recommendedAction}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards, because a 5-column table cannot be usable on a phone */}
      <ul className="space-y-2.5 md:hidden">
        {matches.map((m) => (
          <li key={m.id} className="card-muted p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StrengthBadge strength={m.strength} />
              <PriorityBadge priority={m.priority} />
              {m.isDealBreaker ? (
                <span className="badge badge-missing">deal breaker</span>
              ) : null}
            </div>
            <h3 className="mt-2 text-sm font-semibold text-[var(--text)]">
              {m.requirement.text}
            </h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {m.explanation}
            </p>
            <div className="mt-2">
              <p className="text-xs font-medium text-[var(--text)]">
                Your evidence
              </p>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                {m.evidence
                  ? m.evidence.statement
                  : "No matching evidence found"}
              </p>
            </div>
            <div className="mt-2">
              <p className="text-xs font-medium text-[var(--text)]">Do this</p>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                {m.recommendedAction}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
