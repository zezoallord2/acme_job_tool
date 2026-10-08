import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  debugCenterData,
  runHealthChecks,
  aiProviderFailures,
  webhookDeliveries,
  searchByDiagnosticId,
} from "@/services/debug-service";
import { prisma } from "@/lib/db";
import { envSummary } from "@/lib/errors";
import { Card, CardHeader, Alert, Stat } from "@/components/ui/primitives";
import { AdminControls } from "@/components/admin-controls";
import { DiagnosticSearch } from "@/components/diagnostic-search";
import { formatDate } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Debug Center" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/app");
  const { id } = await searchParams;

  const [
    data,
    health,
    providerFailures,
    webhooks,
    users,
    bugReport,
    flagsCount,
  ] = await Promise.all([
    debugCenterData(),
    runHealthChecks(),
    aiProviderFailures(),
    webhookDeliveries(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        email: true,
        isAdmin: true,
        createdAt: true,
        entitlements: { select: { plan: true, status: true, source: true } },
        _count: { select: { applications: true, evidence: true } },
      },
    }),
    id ? searchByDiagnosticId(id) : Promise.resolve(null),
    prisma.featureFlag.count(),
  ]);

  const unhealthy = health.filter((h) => h.state !== "HEALTHY");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-[var(--text)]">Debug Center</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Internal tooling. Everything is local: PostgreSQL records and the
          local filesystem. No external observability service is required.
        </p>
      </header>

      {unhealthy.length > 0 ? (
        <Alert
          tone="warning"
          title={`${unhealthy.length} subsystem${unhealthy.length === 1 ? "" : "s"} degraded`}
        >
          {unhealthy.map((h) => `${h.subsystem}: ${h.detail}`).join(" · ")}
        </Alert>
      ) : (
        <Alert tone="success" title="All subsystems healthy">
          {health.map((h) => h.subsystem).join(" · ")}
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat
          label="Errors"
          value={data.errors.length}
          tone={data.errors.length ? "warning" : undefined}
        />
        <Stat
          label="Dead jobs"
          value={data.deadJobs.length}
          tone={data.deadJobs.length ? "negative" : undefined}
        />
        <Stat label="Queued" value={data.queueStats.queued} />
        <Stat label="AI failures" value={providerFailures.length} />
        <Stat label="Bug reports" value={data.bugReports.length} />
        <Stat label="Feature flags" value={flagsCount} />
      </div>

      <Card>
        <CardHeader
          title="System health"
          description="HEALTHY / DEGRADED / UNAVAILABLE per subsystem."
        />
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Subsystem</th>
                <th scope="col">State</th>
                <th scope="col">Detail</th>
                <th scope="col">Duration</th>
              </tr>
            </thead>
            <tbody>
              {health.map((h) => (
                <tr key={h.subsystem}>
                  <td className="font-medium">{h.subsystem}</td>
                  <td>
                    <span
                      className={
                        h.state === "HEALTHY"
                          ? "badge badge-strong"
                          : h.state === "DEGRADED"
                            ? "badge badge-partial"
                            : "badge badge-missing"
                      }
                    >
                      {h.state}
                    </span>
                  </td>
                  <td className="text-xs text-[var(--text-muted)]">
                    {h.detail}
                  </td>
                  <td className="text-xs">
                    {h.durationMs ? `${h.durationMs}ms` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Configuration"
          description="Zero-cost posture at runtime."
        />
        <pre className="code-block">
          {JSON.stringify(envSummary(), null, 2)}
        </pre>
      </Card>

      <DiagnosticSearch result={bugReport} />

      <Card>
        <CardHeader
          title="Recent errors"
          description="Structured SystemError records, sanitized."
        />
        {data.errors.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No errors recorded.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Severity</th>
                  <th scope="col">Code</th>
                  <th scope="col">Category</th>
                  <th scope="col">Workflow</th>
                  <th scope="col">Message</th>
                  <th scope="col">Trace</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {data.errors.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span
                        className={
                          e.severity === "CRITICAL"
                            ? "badge badge-missing"
                            : e.severity === "ERROR"
                              ? "badge badge-partial"
                              : "badge badge-unknown"
                        }
                      >
                        {e.severity}
                      </span>
                    </td>
                    <td className="text-xs">{e.code}</td>
                    <td className="text-xs">{e.category}</td>
                    <td className="text-xs">{e.affectedWorkflow ?? "—"}</td>
                    <td className="max-w-[280px] text-xs">
                      {e.message.slice(0, 160)}
                    </td>
                    <td className="font-mono text-[10px]">
                      {e.traceId?.slice(0, 14) ?? "—"}
                    </td>
                    <td className="text-xs">{formatDate(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Dead-letter queue"
          description="Failed jobs are preserved, never discarded. Requeue or resolve explicitly."
        />
        {data.deadJobs.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Dead-letter queue is empty.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Attempts</th>
                  <th scope="col">Last error</th>
                  <th scope="col">Payload hash</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.deadJobs.map((j) => (
                  <tr key={j.id}>
                    <td className="text-xs">{j.type}</td>
                    <td className="text-xs tabular-nums">
                      {j.attempts}/{j.maxAttempts}
                    </td>
                    <td className="max-w-[280px] text-xs">
                      {j.lastErrorCode}: {j.lastErrorMessage?.slice(0, 120)}
                    </td>
                    <td className="font-mono text-[10px]">
                      {j.payloadHash.slice(0, 12)}
                    </td>
                    <td>
                      <AdminControls jobId={j.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Retry queue"
          description="Jobs that failed and are scheduled for another attempt."
        />
        {data.failedJobs.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No jobs awaiting retry.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
            {data.failedJobs.map((j) => (
              <li key={j.id}>
                {j.type} · attempt {j.attempts} · next{" "}
                {formatDateTime(j.nextRunAt)} ·{" "}
                {j.lastErrorCode ?? "no error recorded"}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="AI provider failures"
            description="Timeout, rate limit, malformed output, refusal."
          />
          {providerFailures.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">None recorded.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
              {providerFailures.map((f) => (
                <li key={f.id}>
                  {f.workflowId} · {f.provider}
                  {f.model ? `/${f.model}` : ""} · {f.errorCode} · retry{" "}
                  {f.retryCount} · {formatDate(f.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Webhook deliveries"
            description="Signature verification, replay protection and idempotency."
            action={
              <Link href="/admin/billing" className="btn-secondary">
                Billing diagnostics
              </Link>
            }
          />
          {webhooks.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No webhook events received.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col">Type</th>
                    <th scope="col">Sig</th>
                    <th scope="col">Replay</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map((w) => (
                    <tr key={w.id}>
                      <td className="font-mono text-[10px]">
                        {w.externalEventId.slice(0, 16)}
                      </td>
                      <td className="text-xs">{w.eventType}</td>
                      <td className="text-xs">
                        {w.signatureValid ? "valid" : "invalid"}
                      </td>
                      <td className="text-xs">
                        {w.replayDetected ? "detected" : "no"}
                      </td>
                      <td className="text-xs">{w.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Slow operations"
            description="p95 above 500 ms from local performance metrics."
          />
          {data.slowOps.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No slow operations recorded.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
              {data.slowOps.map((m) => (
                <li key={m.id}>
                  {m.name} · p50 {m.p50}ms · p95 {m.p95}ms · p99 {m.p99}ms · n=
                  {m.count}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Circuit breakers" />
          {data.circuits.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No circuits have tripped.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
              {data.circuits.map((c) => (
                <li key={c.name}>
                  {c.name} · {c.state} · failures {c.failureCount}
                  {c.nextProbeAt
                    ? ` · probe ${formatDateTime(c.nextProbeAt)}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Prompt versions"
          description="A candidate that measures worse cannot become active by accident."
        />
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Identifier</th>
                <th scope="col">Version</th>
                <th scope="col">Status</th>
                <th scope="col">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {data.promptVersions.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs">{p.identifier}</td>
                  <td className="tabular-nums">v{p.version}</td>
                  <td className="text-xs">{p.status.toLowerCase()}</td>
                  <td className="max-w-[280px] text-xs text-[var(--text-muted)]">
                    {p.rationale ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="AI evaluation status" />
        {data.evaluations.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No evaluation runs yet. Run <code>npm run test:eval</code> to
            evaluate prompt versions against fixtures.
          </p>
        ) : (
          <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
            {data.evaluations.map((e) => (
              <li key={e.id}>
                {e.promptVersion} · {e.fixtureCount} fixtures ·{" "}
                {e.passed ? "passed" : "failed"} · {formatDate(e.createdAt)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Releases" />
        {data.releases.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No release records.
          </p>
        ) : (
          <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
            {data.releases.map((r) => (
              <li key={r.id}>
                v{r.appVersion} · schema {r.schemaVersion} ·{" "}
                {r.status.toLowerCase()}
                {r.codeRevision
                  ? ` · ${r.codeRevision.slice(0, 10)}`
                  : ""} · {formatDate(r.createdAt)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Users"
          description="Private content is not shown here by design."
        />
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Plan</th>
                <th scope="col">Source</th>
                <th scope="col">Applications</th>
                <th scope="col">Evidence</th>
                <th scope="col">Joined</th>
                <th scope="col">Grant</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="text-xs">{u.email}</td>
                  <td className="text-xs">
                    {u.entitlements.some(
                      (e) => e.plan === "COMPLETE" && e.status === "ACTIVE",
                    )
                      ? "COMPLETE"
                      : "FREE"}
                  </td>
                  <td className="text-xs">
                    {u.entitlements[0]?.source ?? "—"}
                  </td>
                  <td className="tabular-nums">{u._count.applications}</td>
                  <td className="tabular-nums">{u._count.evidence}</td>
                  <td className="text-xs">{formatDate(u.createdAt)}</td>
                  <td>
                    <AdminControls userId={u.id} email={u.email} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          <Link href="/admin/bug-reports" className="underline">
            Open the bug knowledge base
          </Link>
        </p>
      </Card>
    </div>
  );
}
