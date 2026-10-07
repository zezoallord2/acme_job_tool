import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { aiCostSummary, resolveProvider } from "@/ai/router";
import { getEntitlementState } from "@/services/entitlement-service";
import { Card, CardHeader, Alert, Stat } from "@/components/ui/primitives";
import { SettingsForm } from "@/components/settings-form";
import { ApiKeyForm } from "@/components/api-key-form";
import { ReportProblemForm } from "@/components/report-problem-form";
import { BillingLinkPanel } from "@/components/billing-link-panel";
import { formatDate } from "@/lib/utils";
import { LocalAIProvider } from "@/ai/providers/local";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const billingToken =
    typeof params.token === "string" && params.token.length > 8
      ? params.token
      : null;
  const [settings, entitlement, keys, cost] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
    getEntitlementState(user.id),
    prisma.userApiKey.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        provider: true,
        keyHint: true,
        label: true,
        createdAt: true,
        keyStatus: true,
      },
    }),
    Promise.resolve(aiCostSummary()),
  ]);

  const localHealth = await new LocalAIProvider().health();
  const resolution = await resolveProvider({
    preferManual: settings?.aiProvider === "MANUAL",
  }).catch(() => null);
  const providerCosts = cost.map((item) =>
    item.provider.startsWith("Local AI")
      ? { ...item, available: localHealth.ok }
      : item,
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Your data, your AI configuration, your plan. Everything here runs on
          your own machine.
        </p>
      </header>

      {billingToken ? <BillingLinkPanel token={billingToken} /> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Plan"
          value={entitlement.isComplete ? "Complete" : "Starter"}
          hint={
            entitlement.source === "none"
              ? "free forever"
              : `via ${entitlement.source}`
          }
        />
        <Stat
          label="AI mode"
          value={
            resolution?.provider.costLabel.split("—")[0]?.trim() ?? "Manual"
          }
        />
        <Stat label="Keys stored" value={keys.length} />
        <Stat
          label="Capabilities"
          value={entitlement.capabilities.length}
          hint={entitlement.isComplete ? "all" : "starter set"}
        />
      </div>

      <Card>
        <CardHeader
          title="AI provider and cost"
          description="Cost responsibility is stated exactly. Acme Jobs does not pay for your AI usage and will not claim otherwise."
        />
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Available</th>
                <th scope="col">Cost responsibility</th>
              </tr>
            </thead>
            <tbody>
              {providerCosts.map((c) => (
                <tr key={c.provider}>
                  <td className="font-medium">{c.provider}</td>
                  <td>
                    <span
                      className={
                        c.available
                          ? "badge badge-strong"
                          : "badge badge-unknown"
                      }
                    >
                      {c.available ? "Available" : "Not configured"}
                    </span>
                  </td>
                  <td className="text-sm text-[var(--text-muted)]">
                    {c.label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Alert
          tone={localHealth.ok ? "success" : "info"}
          title={localHealth.ok ? "Local AI is ready" : "Local AI setup needed"}
        >
          {localHealth.ok
            ? `${localHealth.detail}. Workflows can now run without copying prompts to another site.`
            : `${localHealth.detail}. Install Ollama, then run \`npm run ai:local:setup\`. Manual Mode remains available until the local model responds.`}
        </Alert>
      </Card>

      <Card>
        <CardHeader
          title="Your API keys (BYOK)"
          description="Stored encrypted in your database. Never returned to the browser, never logged. Removable at any time."
        />
        {keys.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No keys stored. Manual Mode works without one.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-2">
                <span className="badge badge-unknown">{k.provider}</span>
                <code>{k.keyHint}</code>
                <span>added {formatDate(k.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <ApiKeyForm existing={keys.map((k) => k.id)} />
      </Card>

      <Card>
        <CardHeader
          title="Preferences"
          description="Theme, notifications and product learning."
        />
        <SettingsForm
          localAI={{ ok: localHealth.ok, detail: localHealth.detail }}
          settings={{
            theme: settings?.theme ?? "SYSTEM",
            aiProvider: settings?.aiProvider ?? "MANUAL",
            productLearningEnabled: settings?.productLearningEnabled ?? true,
            analyticsEnabled: settings?.analyticsEnabled ?? false,
            notifyInterviews: settings?.notifyInterviews ?? true,
            notifyFollowUps: settings?.notifyFollowUps ?? true,
            notifyDeadlines: settings?.notifyDeadlines ?? true,
            notifyDrafts: settings?.notifyDrafts ?? false,
          }}
        />
      </Card>

      <Card>
        <CardHeader
          title="Privacy and data"
          description="Acme Jobs never requires government ID, birthdate, precise home address or sensitive demographics."
        />
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/career.json" className="btn-secondary">
            Export career data (JSON)
          </a>
          {entitlement.isComplete ? (
            <a href="/api/export/applications.csv" className="btn-secondary">
              Export applications (CSV)
            </a>
          ) : null}
          <a href="/api/export/resume.docx" className="btn-secondary">
            Export master resume (DOCX)
          </a>
        </div>
        <DeleteAccountForm email={user.email} />
      </Card>

      <Card>
        <CardHeader
          title="Report a problem"
          description="You get a reference code such as ACME-7F92A1. Technical diagnostics are opt-in and never include your career content."
        />
        <ReportProblemForm />
      </Card>

      <Card>
        <CardHeader title="Plan and upgrade" />
        {entitlement.isComplete ? (
          <Alert tone="success" title="You have Complete Edition">
            Granted via {entitlement.source}
            {entitlement.expiresAt
              ? `, expires ${formatDate(entitlement.expiresAt)}`
              : " (no expiry)"}
            .
          </Alert>
        ) : (
          <>
            <p className="text-sm text-[var(--text-muted)]">
              You are on the Starter plan. Complete Edition unlocks the Claim
              Inspector, Readiness Gate, immutable sent versions, interview
              command centre, analytics and the daily priority engine.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/pricing" className="btn-primary">
                Upgrade — launch $9.99
              </Link>
              {user.isAdmin ? (
                <Link href="/admin" className="btn-secondary">
                  Grant manually (admin)
                </Link>
              ) : null}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function DeleteAccountForm({ email }: { email: string }) {
  return (
    <details className="mt-4">
      <summary
        className="cursor-pointer text-sm font-semibold"
        style={{ color: "var(--color-evidence-missing)" }}
      >
        Delete my account
      </summary>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        This permanently removes your profile, evidence, resumes, applications,
        interviews and analytics. Type your email to confirm.
      </p>
      <DeleteForm email={email} />
    </details>
  );
}

function DeleteForm({ email }: { email: string }) {
  return (
    <form
      action="/api/account/delete"
      method="post"
      className="mt-2 flex flex-wrap gap-2"
    >
      <input type="hidden" name="confirm" value="" />
      <input
        name="typedEmail"
        className="input"
        placeholder={email}
        aria-label="Type your email to confirm deletion"
        required
      />
      <button type="submit" className="btn-danger">
        Delete permanently
      </button>
    </form>
  );
}
