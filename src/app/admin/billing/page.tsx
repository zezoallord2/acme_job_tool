import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  stateCounts,
  findByState,
  findByExternalEventId,
  findByExternalUserId,
  findByLocalUserId,
} from "@/billing/diagnostics";
import { Card, CardHeader, Alert } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import type { WhopEventState } from "@/billing/diagnostics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing diagnostics" };

/**
 * Whop billing diagnostics.
 *
 * Answers the three questions an operator actually has when a customer says
 * "I paid and nothing happened":
 *
 *   1. Did the webhook arrive, and did the signature verify?
 *   2. Could the account be identified, or is the event still held?
 *   3. Was an entitlement granted?
 *
 * Read-only. Replaying a held event is a separate, explicit action because it
 * changes state, so it lives behind its own control rather than on this page.
 */
const STATE_LABEL: Record<WhopEventState, string> = {
  RECEIVED: "Arrived, signature not verified",
  VERIFIED: "Verified, being processed",
  USER_NOT_LINKED: "Account not identified",
  HELD: "Held pending account link",
  RECONCILED: "Reconciled after linking",
  APPLIED: "Entitlement granted",
  DUPLICATE: "Duplicate, ignored",
  FAILED: "Failed",
};

/**
 * `USER_NOT_LINKED` is the stored error code, but `deriveState` reports those
 * rows as `HELD`. Offering both as tabs would show one of them permanently at
 * zero, so only the derived label is offered as a filter. The alias still works
 * in the query string for links written before this page existed.
 */
const VISIBLE_STATES = Object.keys(STATE_LABEL).filter(
  (s) => s !== "USER_NOT_LINKED",
) as WhopEventState[];

function badgeClass(state: WhopEventState): string {
  if (state === "APPLIED" || state === "RECONCILED")
    return "badge badge-strong";
  if (state === "FAILED" || state === "RECEIVED") return "badge badge-missing";
  if (state === "HELD" || state === "USER_NOT_LINKED")
    return "badge badge-partial";
  return "badge badge-unknown";
}

/** Whop ids and local user ids have recognisable shapes; use them to guess. */
function guessSearchKind(q: string): "event" | "whop" | "local" {
  if (q.startsWith("evt_") || q.startsWith("user_")) return "whop";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(q)) return "local";
  return "event";
}

export default async function BillingDiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; q?: string }>;
}) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/app");

  const params = await searchParams;
  const requested = (params.state ?? "").toUpperCase() as WhopEventState;
  const active = VISIBLE_STATES.includes(requested) ? requested : null;
  const query = (params.q ?? "").trim();

  const [counts, events, searchResult] = await Promise.all([
    stateCounts(),
    active
      ? findByState(active, 50)
      : Promise.resolve([] as Awaited<ReturnType<typeof findByState>>),
    query
      ? (async () => {
          const kind = guessSearchKind(query);
          if (kind === "whop")
            return {
              kind,
              events: await findByExternalUserId(query),
            };
          if (kind === "local") {
            const found = await findByLocalUserId(query);
            return { kind, events: found.events };
          }
          const one = await findByExternalEventId(query);
          return { kind, events: one ? [one] : [] };
        })()
      : Promise.resolve(null),
  ]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Billing diagnostics
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Every Whop webhook this deployment has seen, and what became of it. No
          payment details are stored or shown: only the fields needed to grant
          an entitlement.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Find an event"
          description="Search by Whop event id, Whop user id, or your own user id."
        />
        <form method="get" action="/admin/billing" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="evt_... / user_... / user id"
            aria-label="Search Whop events"
            className="input flex-1"
          />
          <button type="submit" className="btn-primary">
            Search
          </button>
          {query ? (
            <a href="/admin/billing" className="btn-secondary">
              Clear
            </a>
          ) : null}
        </form>

        {searchResult ? (
          searchResult.events.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              No Whop event matches <code>{query}</code>.
            </p>
          ) : (
            <div className="table-wrap mt-3">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Whop event id</th>
                    <th scope="col">Type</th>
                    <th scope="col">State</th>
                    <th scope="col">Received</th>
                    <th scope="col">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResult.events.map((e) => (
                    <tr key={e.id}>
                      <td className="font-mono text-[10px] break-all">
                        {e.externalEventId}
                      </td>
                      <td className="text-xs">{e.eventType}</td>
                      <td className="text-xs">
                        <span className={badgeClass(e.state)}>{e.state}</span>
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        {formatDateTime(e.receivedAt)}
                      </td>
                      <td className="text-xs">
                        {e.errorCode
                          ? `${e.errorCode}: ${e.errorMessage ?? ""}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </Card>

      {total === 0 ? (
        <Alert tone="info" title="No Whop events yet">
          Nothing has arrived from Whop. Check the webhook URL and signing
          secret in the dashboard, and confirm the endpoint is reachable.
        </Alert>
      ) : (
        <Card>
          <CardHeader
            title="Lifecycle"
            description="Select a state to inspect the events behind it."
          />
          <div className="flex flex-wrap gap-2">
            {VISIBLE_STATES.map((state) => (
              <a
                key={state}
                href={
                  active === state
                    ? "/admin/billing"
                    : `/admin/billing?state=${state}`
                }
                className={active === state ? "btn-primary" : "btn-secondary"}
              >
                {STATE_LABEL[state]} ({counts[state]})
              </a>
            ))}
          </div>
        </Card>
      )}

      {active ? (
        <Card>
          <CardHeader
            title={STATE_LABEL[active]}
            description={`${events.length} event(s).`}
          />
          {events.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nothing in this state.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Whop event id</th>
                    <th scope="col">Type</th>
                    <th scope="col">State</th>
                    <th scope="col">Received</th>
                    <th scope="col">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td className="font-mono text-[10px] break-all">
                        {e.externalEventId}
                      </td>
                      <td className="text-xs">{e.eventType}</td>
                      <td className="text-xs">
                        <span className={badgeClass(e.state)}>{e.state}</span>
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        {formatDateTime(e.receivedAt)}
                      </td>
                      <td className="text-xs">
                        {e.errorCode
                          ? `${e.errorCode}: ${e.errorMessage ?? ""}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
