import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bug knowledge base" };

export default async function BugReportsPage() {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/app");

  const reports = await prisma.bugReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      diagnosticId: true,
      status: true,
      severity: true,
      category: true,
      rootCause: true,
      rootCauseCategory: true,
      reproductionStatus: true,
      regressionTestPath: true,
      resolutionNote: true,
      whatAttempted: true,
      whatHappened: true,
      createdAt: true,
      resolvedAt: true,
    },
  });

  const open = reports.filter(
    (r) => r.status === "OPEN" || r.status === "TRIAGED",
  );
  const resolved = reports.filter((r) => r.status === "RESOLVED");

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
        <Link href="/admin" className="underline">
          Debug Center
        </Link>{" "}
        / Bug reports
      </nav>

      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Bug knowledge base
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Symptom, root cause, fix and regression test for every reported
          defect. Used to spot recurring problems.
        </p>
      </header>

      {reports.length === 0 ? (
        <EmptyState
          title="No bug reports"
          description="Users can report a problem from Settings. Each report gets a searchable diagnostic id."
        />
      ) : (
        <>
          <Card>
            <CardHeader title={`Open (${open.length})`} />
            {open.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Nothing open.</p>
            ) : (
              <ul className="space-y-2">
                {open.map((r) => (
                  <li key={r.id} className="card-muted p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs">{r.diagnosticId}</code>
                      <span className="badge badge-partial">{r.severity}</span>
                      <span className="badge badge-unknown">{r.status}</span>
                      <span className="badge badge-unknown">
                        {r.reproductionStatus.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--text)]">
                      {r.whatAttempted}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {r.whatHappened}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {formatDate(r.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={`Resolved (${resolved.length})`} />
            {resolved.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                Nothing resolved yet.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th scope="col">Id</th>
                      <th scope="col">Symptom</th>
                      <th scope="col">Root cause</th>
                      <th scope="col">Category</th>
                      <th scope="col">Regression test</th>
                      <th scope="col">Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolved.map((r) => (
                      <tr key={r.id}>
                        <td className="font-mono text-[10px]">
                          {r.diagnosticId}
                        </td>
                        <td className="max-w-[240px] text-xs">
                          {r.whatHappened.slice(0, 140)}
                        </td>
                        <td className="max-w-[240px] text-xs">
                          {r.rootCause ?? "—"}
                        </td>
                        <td className="text-xs">
                          {r.rootCauseCategory ?? "—"}
                        </td>
                        <td className="text-xs">
                          {r.regressionTestPath ?? "—"}
                        </td>
                        <td className="text-xs">
                          {r.resolvedAt ? formatDate(r.resolvedAt) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
