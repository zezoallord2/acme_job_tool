import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { asAppError, userFacingMessage } from "@/lib/errors";
import { listJobs } from "@/services/job-service";
import { getEntitlementState } from "@/services/entitlement-service";
import { searchForYou, type JobsForYouResult } from "@/jobs/discovery";
import { workModeLabel } from "@/jobs/search-profile";
import { providerDisplayName } from "@/jobs/sources/registry";
import { externalSearchLinks } from "@/lib/external-job-search";
import { saveDiscoveredJobAction } from "@/app/actions/job-actions";
import { CvImportCard } from "@/components/cv-import-card";
import {
  Alert,
  Card,
  CardHeader,
  EmptyState,
  FitBadge,
  StatusBadge,
} from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs for You" };

type Params = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 50;

function one(params: Params, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Builds an href that keeps the current controls and applies a patch. */
function hrefWith(params: Params, patch: Record<string, string>): string {
  const next = new URLSearchParams();
  for (const key of ["loose", "area", "work", "mt", "ml", "mw", "show"]) {
    const value = one(params, key);
    if (value) next.set(key, value);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  const query = next.toString();
  return query ? `?${query}` : "?";
}

function fitClass(label: string): string {
  if (label === "Strong Match") return "badge badge-strong";
  if (label === "Good Match") return "badge badge-good";
  if (label === "Possible Match") return "badge badge-partial";
  return "badge badge-missing";
}

function HealthStrip({ health }: { health: JobsForYouResult["health"] }) {
  return (
    <ul
      className="flex flex-wrap gap-1.5 text-xs"
      aria-label="Job sources searched"
      data-testid="provider-health"
    >
      {health.map((h) => {
        const ok = h.status === "ok" || h.status === "empty";
        const mark =
          h.status === "ok"
            ? `✓ ${h.count}`
            : h.status === "empty"
              ? "✓ 0"
              : h.status === "skipped"
                ? `✗ ${h.message ?? "off"}`
                : h.status === "quota"
                  ? "✗ quota reached"
                  : `✗ ${h.message ?? "failed"}`;
        return (
          <li
            key={h.id}
            className={ok ? "badge badge-good" : "badge badge-unknown"}
            title={h.message ?? `${h.count} results in ${h.ms} ms`}
          >
            {h.label} {mark}
          </li>
        );
      })}
    </ul>
  );
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const [savedJobs, entitlement] = await Promise.all([
    listJobs(user.id, 20),
    getEntitlementState(user.id),
  ]);

  const strict = one(params, "loose") !== "1";
  const areaParam = one(params, "area");
  const area =
    areaParam === "country" ? "country" : areaParam === "any" ? "any" : "city";
  const work = (one(params, "work") || one(params, "mw")).toUpperCase();
  const workMode =
    work === "ONSITE" || work === "ON_SITE"
      ? "ONSITE"
      : work === "HYBRID"
        ? "HYBRID"
        : work === "REMOTE"
          ? "REMOTE"
          : work === "ANY"
            ? "ANY"
            : undefined;
  const manualTitle = one(params, "mt") || one(params, "title");
  const manualLocation = one(params, "ml") || one(params, "location");
  const show = Math.max(
    PAGE_SIZE,
    Math.min(1000, Number(one(params, "show")) || PAGE_SIZE),
  );

  let discovery: JobsForYouResult | null = null;
  let failure: string | null = null;
  try {
    discovery = await searchForYou({
      userId: user.id,
      refresh: one(params, "refresh") === "1",
      strictLocation: strict,
      area,
      ...(workMode ? { workMode } : {}),
      ...(manualTitle.trim()
        ? {
            manual: {
              title: manualTitle,
              location: manualLocation || undefined,
              workMode: workMode ?? "ANY",
            },
          }
        : {}),
    });
  } catch (e) {
    failure = userFacingMessage(asAppError(e));
  }

  const profile = discovery?.profile;
  const results = discovery?.results ?? [];
  const visible = results.slice(0, show);
  const showAutomatic = Boolean(profile?.hasEnoughData || manualTitle);
  const preference = discovery?.preference;
  const place = preference
    ? [preference.city, preference.country].filter(Boolean).join(", ")
    : "";
  const primaryQuery =
    discovery?.queries[0]?.title ?? profile?.primaryTargetRoles[0] ?? "";
  const external = externalSearchLinks({
    title: primaryQuery,
    location: manualLocation || place,
    remote: preference?.workMode === "REMOTE",
  });
  const sourcesWithResults = new Set(results.map((r) => r.job.provider)).size;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title text-[var(--text)]">Jobs for You</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            An AI search agent reads your CV, searches every public job source
            it legally can, and ranks the results for you. Every listing is a
            real vacancy with its original link — match labels are guidance,
            never a hiring probability.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={hrefWith(params, { refresh: "1", show: "" })}
            className="btn-secondary"
          >
            Refresh jobs
          </a>
          <a href="#manual-search" className="btn-ghost">
            Search manually
          </a>
        </div>
      </header>

      {one(params, "saveError") ? (
        <Alert tone="error">{one(params, "saveError")}</Alert>
      ) : null}

      {failure ? (
        <Alert tone="error" title="Job search did not run">
          {failure} No fake or demo jobs were substituted.
        </Alert>
      ) : null}

      {discovery?.notice ? (
        <Alert tone="warning" title="Showing your last search">
          {discovery.notice}
        </Alert>
      ) : null}

      {!discovery || !profile ? null : !showAutomatic ? (
        <CvImportCard hasProfile={false} isComplete={entitlement.isComplete} />
      ) : null}

      {discovery && showAutomatic ? (
        <section
          className="card space-y-3 p-4"
          aria-label="How this search ran"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Searched for:</span>
            {discovery.queries.map((q) => (
              <span key={q.title} className="chip" title={q.reason}>
                {q.title}
              </span>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Queries planned by{" "}
            {discovery.plannedBy === "rules"
              ? "rules from your profile"
              : discovery.plannedBy}
            {discovery.rankedBy
              ? ` · ranked by ${discovery.rankedBy}`
              : " · ranked by profile match"}{" "}
            · {sourcesWithResults} sources with results
            {discovery.fromCache ? " · from the last 30 minutes" : ""}
          </p>
          <HealthStrip health={discovery.health} />
        </section>
      ) : null}

      {discovery && showAutomatic ? (
        <section
          className="flex flex-wrap items-center gap-2"
          aria-label="Widen the search"
        >
          <span className="text-sm text-[var(--text-muted)]">
            {area === "any"
              ? "Anywhere, any work style"
              : `${place || "Any location"} · ${workModeLabel(preference!.workMode)}`}
            {strict
              ? " · location confirmed"
              : " · including unclear locations"}
            . Widen:
          </span>
          {area === "city" && preference?.country ? (
            <a
              href={hrefWith(params, { area: "country" })}
              className="btn-ghost"
            >
              All of {preference.country}
            </a>
          ) : null}
          {preference?.workMode !== "REMOTE" && area !== "any" ? (
            <a
              href={hrefWith(params, { work: "REMOTE" })}
              className="btn-ghost"
            >
              Remote
            </a>
          ) : null}
          {preference?.workMode === "ONSITE" ? (
            <a
              href={hrefWith(params, { work: "HYBRID" })}
              className="btn-ghost"
            >
              Include hybrid
            </a>
          ) : null}
          {strict && area !== "any" ? (
            <a href={hrefWith(params, { loose: "1" })} className="btn-ghost">
              Include unclear locations
            </a>
          ) : null}
          {area !== "any" ? (
            <a
              href={hrefWith(params, { area: "any", work: "", loose: "" })}
              className="btn-ghost"
            >
              Anywhere
            </a>
          ) : (
            <a
              href={hrefWith(params, { area: "", work: "" })}
              className="btn-ghost"
            >
              Back to my location
            </a>
          )}
        </section>
      ) : null}

      {external.length ? (
        <section
          className="flex flex-wrap items-center gap-2 text-sm"
          aria-label="Search other sites"
        >
          <span className="text-[var(--text-muted)]">
            Also search &ldquo;{primaryQuery}&rdquo; on:
          </span>
          {external.map((link) => (
            <a
              key={link.site}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              {link.site} ↗
            </a>
          ))}
        </section>
      ) : null}

      {showAutomatic && discovery && results.length === 0 ? (
        <EmptyState
          title="No jobs match this search yet"
          description={
            discovery.rejectedByLocation > 0
              ? `${discovery.rejectedByLocation} real openings were outside your location preference. Use a Widen option above.`
              : "Public job feeds change throughout the day. Widen the search above, or refresh later."
          }
          action={
            <Link href="/app/profile" className="btn-ghost">
              Edit job goals
            </Link>
          }
        />
      ) : null}

      {showAutomatic && visible.length > 0 ? (
        <section aria-labelledby="results-heading">
          <div className="mb-3">
            <h2 id="results-heading" className="section-title">
              {manualTitle ? "Search results" : "Recommended openings"} (
              {results.length})
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {discovery?.rejectedByLocation
                ? `${discovery.rejectedByLocation} outside your location · `
                : ""}
              {discovery?.unclearLocation && strict
                ? `${discovery.unclearLocation} held back as location unclear · `
                : ""}
              Original source links included
            </p>
          </div>
          <ul className="grid gap-3 lg:grid-cols-2" data-testid="job-results">
            {visible.map(({ job, fit, locationMatch, why }) => (
              <li
                key={`${job.provider}:${job.externalId}`}
                className="card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[var(--text)]">
                      {job.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                      {job.company} · {job.location}
                    </p>
                  </div>
                  <span className={fitClass(fit.label)}>{fit.label}</span>
                </div>
                {why ? (
                  <p className="mt-2 text-sm text-[var(--text)]">
                    <span className="font-medium">Why this fits:</span> {why}
                  </p>
                ) : null}
                <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
                  {(why ? fit.reasons.slice(0, 1) : fit.reasons).map(
                    (reason) => (
                      <li key={reason}>✓ {reason}</li>
                    ),
                  )}
                  {fit.gaps.map((gap) => (
                    <li key={gap} className="text-[var(--warning)]">
                      {gap}
                    </li>
                  ))}
                  {locationMatch.status === "UNKNOWN" ? (
                    <li className="text-[var(--warning)]">
                      Location eligibility unclear
                    </li>
                  ) : null}
                </ul>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Source: {providerDisplayName(job.provider)}
                  {job.via ? ` · via ${job.via}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    className="btn-secondary"
                    href={job.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View original job
                  </a>
                  <form action={saveDiscoveredJobAction}>
                    <input type="hidden" name="title" value={job.title} />
                    <input type="hidden" name="company" value={job.company} />
                    <input type="hidden" name="location" value={job.location} />
                    <input
                      type="hidden"
                      name="description"
                      value={job.description.slice(0, 20_000)}
                    />
                    <input
                      type="hidden"
                      name="sourceName"
                      value={providerDisplayName(job.provider)}
                    />
                    <input
                      type="hidden"
                      name="sourceUrl"
                      value={job.sourceUrl}
                    />
                    <button className="btn-primary" type="submit">
                      Save &amp; analyze
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          {results.length > visible.length ? (
            <div className="mt-4 flex justify-center">
              <a
                className="btn-secondary"
                href={hrefWith(params, { show: String(show + PAGE_SIZE) })}
              >
                Load more ({results.length - visible.length} more)
              </a>
            </div>
          ) : null}
        </section>
      ) : null}

      <Card id="manual-search">
        <CardHeader
          title="Search manually"
          description="Type a title and the agent still searches every source and adds close variants."
        />
        <form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="label">Job title</span>
            <input
              className="input"
              name="mt"
              defaultValue={manualTitle}
              placeholder="Product designer"
            />
          </label>
          <label className="space-y-1">
            <span className="label">Location</span>
            <input
              className="input"
              name="ml"
              defaultValue={manualLocation}
              placeholder="Cairo or Remote"
            />
          </label>
          <label className="space-y-1">
            <span className="label">Work style</span>
            <select
              className="input"
              name="mw"
              defaultValue={workMode ?? preference?.workMode ?? "ANY"}
            >
              <option value="ANY">Any</option>
              <option value="REMOTE">Remote</option>
              <option value="HYBRID">Hybrid</option>
              <option value="ONSITE">On-site</option>
            </select>
          </label>
          <button className="btn-primary self-end" type="submit">
            Search
          </button>
        </form>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Your default location and work style come from My Profile.{" "}
          <Link href="/app/profile" className="underline">
            Edit job goals and location
          </Link>
        </p>
      </Card>

      {savedJobs.length > 0 ? (
        <Card>
          <CardHeader
            title="Saved jobs"
            description="Continue jobs you already started."
          />
          <ul
            className="mt-3 divide-y"
            style={{ borderColor: "var(--border)" }}
          >
            {savedJobs.map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/jobs/${job.id}`}
                    className="font-medium underline"
                  >
                    {job.title ?? "Role not set"}
                  </Link>
                  <p className="text-xs text-[var(--text-muted)]">
                    {job.company ?? "Company not set"}
                  </p>
                </div>
                {job.matrices[0] ? (
                  <FitBadge fit={job.matrices[0].fitClassification} />
                ) : null}
                {job.application ? (
                  <StatusBadge status={job.application.status} />
                ) : null}
                {job.application ? (
                  <Link
                    href={`/app/tailor?applicationId=${job.application.id}`}
                    className="btn-ghost"
                  >
                    Tailor resume
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
