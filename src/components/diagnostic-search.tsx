import Link from "next/link";
import type { searchByDiagnosticId } from "@/services/debug-service";

export const dynamic = "force-dynamic";

export function DiagnosticSearch({
  result,
}: {
  result: Awaited<ReturnType<typeof searchByDiagnosticId>> | null;
}) {
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold text-[var(--text)]">
        Find a bug report
      </h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Search by diagnostic id, for example <code>ACME-7F92A1</code>.
      </p>
      <form className="mt-2 flex flex-wrap gap-2" action="/admin">
        <input
          name="id"
          className="input max-w-[220px]"
          placeholder="ACME-7F92A1"
          aria-label="Diagnostic id"
        />
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      {result ? (
        <div className="mt-3 card-muted p-3">
          <p className="text-sm font-semibold text-[var(--text)]">
            {result.diagnosticId}
          </p>
          <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="label">Status</dt>
              <dd>{result.status}</dd>
            </div>
            <div>
              <dt className="label">Reproduction</dt>
              <dd>{result.reproductionStatus}</dd>
            </div>
            <div>
              <dt className="label">Root cause</dt>
              <dd>{result.rootCause ?? "Not yet determined"}</dd>
            </div>
            <div>
              <dt className="label">Regression test</dt>
              <dd>{result.regressionTestPath ?? "Not yet added"}</dd>
            </div>
          </dl>
          <p className="mt-2 text-sm text-[var(--text)]">
            {result.whatAttempted}
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {result.whatHappened}
          </p>
          {result.diagnostics ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-[var(--text-muted)]">
                Sanitized reproduction package
              </summary>
              <pre className="code-block mt-1">
                {JSON.stringify(result.diagnostics, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-xs">
        <Link href="/admin/bug-reports" className="underline">
          All bug reports
        </Link>
      </p>
    </section>
  );
}
