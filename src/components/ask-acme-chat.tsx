import Link from "next/link";
import type { AskAcmeAnswer } from "@/services/ask-acme-service";

export function AskAcmeChat({
  question,
  answer,
  citations,
  dataGaps,
  suggestedActions,
}: {
  question: string;
  answer: string;
  citations: AskAcmeAnswer["citations"];
  dataGaps: string[];
  suggestedActions: AskAcmeAnswer["suggestedActions"];
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-lg px-3 py-2 text-sm"
          style={{
            background: "var(--brand-accent-soft)",
            color: "var(--text)",
          }}
        >
          {question}
        </div>
      </div>

      <div className="flex justify-start">
        <div
          className="card-muted max-w-[92%] p-3 text-sm"
          style={{ whiteSpace: "pre-wrap" }}
        >
          {answer}
        </div>
      </div>

      {citations.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Sources
          </h3>
          <ul className="mt-1.5 space-y-1 text-sm">
            {citations.map((c, i) => (
              <li key={`${c.kind}-${i}`} className="text-[var(--text-muted)]">
                • {c.label} <span className="text-xs">({c.kind})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dataGaps.length > 0 ? (
        <div className="card-muted p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Data I do not have
          </h3>
          <ul className="mt-1.5 space-y-1 text-sm text-[var(--text-muted)]">
            {dataGaps.map((g) => (
              <li key={g}>• {g}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {suggestedActions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestedActions.map((a) => (
            <Link key={a.href} href={a.href} className="btn-secondary">
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
