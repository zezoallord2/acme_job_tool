import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runHealthChecks } from "@/services/debug-service";
import { assertBootReady, readinessSummary } from "@/lib/boot-readiness";

export const dynamic = "force-dynamic";

/**
 * Readiness and liveness endpoint.
 *
 * Most hosts gate traffic on a health path, restart the process when it fails,
 * or refuse to route to a container that is not ready. This one is built for
 * that:
 *
 *  - `GET /api/health` returns 200 with per-subsystem detail.
 *  - It never returns secrets, connection strings, file paths or user data.
 *    Only subsystem names, states and author-written detail strings.
 *  - `?strict=1` turns a degraded subsystem into a 503, which is what a host
 *    should poll before sending real traffic. Without it the endpoint stays 200
 *    so monitoring can still read the detail while something is broken.
 */

/**
 * Readiness endpoints are normally public, so detail strings are scrubbed before
 * they leave. The underlying health checks embed real filesystem paths (useful
 * in the admin Debug Center, not useful to a stranger) and could in principle
 * interpolate a configured value, so path-shaped substrings are redacted here
 * rather than trusted to be safe.
 */
function redactDetail(detail: string): string {
  return (
    detail
      // A drive-letter path, including spaces in folder names. Runs to the end
      // of the path or up to a sentence break, so "A:\my folder\data" is removed
      // whole rather than leaving the tail behind.
      .replace(/[A-Za-z]:\\[^"]*?(?=\.\s|$)/g, "<path>")
      // Any other drive-letter path with no spaces.
      .replace(/[A-Za-z]:\\[^\s;,"')]+/g, "<path>")
      .replace(/(?:^|[\s("'=])\/(?:[\w.@ -]+\/)+[\w.@ -]*/g, (m) =>
        m.replace(/\/.*$/, "/<path>"),
      )
      // Anything that looks like a URL or connection string.
      .replace(/\b[a-z+]+:\/\/[^\s;,"')]+/gi, "<url>")
      .slice(0, 300)
  );
}

export async function GET(request: Request) {
  const strict = new URL(request.url).searchParams.get("strict") === "1";

  // The database is the one dependency that must work. Check it first and
  // cheaply so an unreachable database returns fast instead of timing out.
  const started = Date.now();
  let database: { ok: boolean; detail: string };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true, detail: `reachable in ${Date.now() - started}ms` };
  } catch {
    database = { ok: false, detail: "unreachable" };
  }

  const subsystems = database.ok
    ? await runHealthChecks()
        .then((checks) =>
          checks.map((c) => ({
            subsystem: c.subsystem,
            state: c.state,
            durationMs: c.durationMs ?? null,
            // Scrubbed: see redactDetail above.
            detail: redactDetail(c.detail),
          })),
        )
        .catch(() => [])
    : [];

  const notHealthy = subsystems.filter((s) => s.state !== "HEALTHY");

  // A host that started the app without migrating must fail readiness, not serve
  // traffic that will 500 on the first query.
  const readiness = database.ok
    ? await assertBootReady().catch(() => null)
    : null;

  const bootBlockers = readiness
    ? readiness.fatalFailures
    : ["database unreachable"];
  const healthy =
    database.ok && notHealthy.length === 0 && bootBlockers.length === 0;

  return NextResponse.json(
    {
      ok: healthy,
      // Spelled out so a host can match on a readable string.
      status: healthy ? "healthy" : "degraded",
      // A stable token so two polls can be compared without reading the body.
      readiness: readinessSummary(
        readiness ?? {
          ready: false,
          fatalFailures: bootBlockers,
          warnings: [],
          checks: [],
        },
      ),
      database,
      migrations: readiness
        ? {
            ready: readiness.ready,
            // Names a missing table or column and the exact command to fix it.
            blockers: readiness.fatalFailures,
            warnings: readiness.warnings,
          }
        : { ready: false, blockers: bootBlockers, warnings: [] },
      subsystems,
      degraded: notHealthy.map((s) => s.subsystem),
      version: process.env.APP_VERSION ?? "1.0.0",
      zeroCostMode: process.env.ZERO_COST_MODE !== "false",
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy || !strict ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
