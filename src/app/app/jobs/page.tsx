import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listJobs } from "@/services/job-service";
import { getEntitlementState } from "@/services/entitlement-service";
import { searchForYou, type JobsForYouResult } from "@/jobs/discovery";
import { workModeLabel } from "@/jobs/search-profile";
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

function one(params: Params, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Builds an href that keeps the current controls and applies a patch. */
function hrefWith(params: Params, patch: Record<string, string>): string {
  const next = new URLSearchParams();
  for (const key of ["strict", "loose", "area", "work", "mt", "ml", "mw"]) {
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

function locationLabel(
  match: JobsForYouResult["results"][number]["locationMatch"],
): string | null {
  if (match.status === "UNKNOWN") return "Location eligibility unclear";
  return null;
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
  const area = one(params, "area") === "country" ? "country" : "city";
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

  let discovery: JobsForYouResult | null = null;
  let failed = false;
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
              location:
                one(params, "ml") || one(params, "location") || undefined,
              workMode: workMode ?? "ANY",
            },
          }
        : {}),
    });
  } catch {
    failed = true;
  }

  const profile = discovery?.profile;
  const results = discovery?.results ?? [];
  const showAutomatic = Boolean(profile?.hasEnoughData);
  const preference = discovery?.preference;
  const hiddenByPlan =
    discovery && discovery.totalMatched > results.length
      ? discovery.totalMatched - results.length
      : 0;

  const chips: string[] = [];
  if (profile?.sources.length) chips.push(profile.sources[0]!);
  if (preference) {
    const place = [preference.city, preference.country]
      .filter(Boolean)
      .join(", ");
    if (place) chips.push(place);
    chips.push(workModeLabel(preference.workMode));
  }
  if (discovery) {
    chips.push(
      `${discovery.queries.length} ${discovery.queries.length === 1 ? "search" : "searches"} from your profile`,
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title text-[var(--text)]">Jobs for You</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Matched using your CV, skills and job preferences. Every listing is
            a real public vacancy with its original link — match labels are
            guidance, never a hiring probability.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={hrefWith(params, { refresh: "1" })}
            className="btn-secondary"
          >
            Refresh jobs
          </a>
          <a href="#preferences" className="btn-ghost">
            Adjust preferences
          </a>
          <a href="#manual-search" className="btn-ghost">
            Search manually
          </a>
        </div>
      </header>

      <ul className="flex flex-wrap gap-2" aria-label="Search settings">
        {chips.map((chip) => (
          <li key={chip} className="chip">
            {chip}
          </li>
        ))}
        <li className="chip">
          Location check: {strict ? "Strict (on)" : "Off"}
        </li>
      </ul>

      {one(params, "saveError") ? (
        <Alert tone="error">{one(params, "saveError")}</Alert>
      ) : null}

      {failed ? (
        <Alert tone="error" title="Job search is temporarily unavailable">
          No fake or demo jobs were substituted. Try again in a moment, or paste
          a job from another site.
        </Alert>
      ) : null}

      {!profile ? null : !showAutomatic ? (
        <CvImportCard hasProfile={false} isComplete={entitlement.isComplete} />
      ) : null}

      {showAutomatic && discovery && results.length === 0 ? (
        <EmptyState
          title="No jobs match this search yet"
          description={
            discovery.rejectedByLocation > 0
              ? `${discovery.rejectedByLocation} real openings were removed because their location does not match your preference. Broaden the search below or refresh later.`
              : "Public job feeds change throughout the day. Broaden the search below or refresh later."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {area === "city" && preference?.country ? (
                <a
                  href={hrefWith(params, { area: "country" })}
                  className="btn-primary"
                >
                  Search all of {preference.country}
                </a>
              ) : null}
              {preference?.workMode === "ONSITE" ? (
                <a
                  href={hrefWith(params, { work: "HYBRID" })}
                  className="btn-secondary"
                >
                  Include hybrid
                </a>
              ) : null}
              {preference?.workMode === "ONSITE" ||
              preference?.workMode === "HYBRID" ? (
                <a
                  href={hrefWith(params, { work: "REMOTE" })}
                  className="btn-secondary"
                >
                  Include remote
                </a>
              ) : null}
              {strict ? (
                <a
                  href={hrefWith(params, { loose: "1" })}
                  className="btn-secondary"
                >
                  Include jobs with an unclear location
                </a>
              ) : null}
              <a
                href={hrefWith(params, { refresh: "1" })}
                className="btn-secondary"
              >
                Refresh jobs
              </a>
              <Link href="/app/profile" className="btn-ghost">
                Edit job goals
              </Link>
            </div>
          }
        />
      ) : null}

      {showAutomatic && results.length > 0 ? (
        <section aria-labelledby="results-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="results-heading" className="section-title">
                {manualTitle ? "Manual search results" : "Recommended openings"}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {discovery?.rejectedByLocation
                  ? `${discovery.rejectedByLocation} listings removed by the location check · `
                  : ""}
                {discovery?.unclearLocation && strict
                  ? `${discovery.unclearLocation} held back as location unclear · `
                  : ""}
                Public feeds via Arbeitnow, RemoteOK
                {process.env.SERPAPI_API_KEY ? " and Google Jobs" : ""} ·
                original source links included
                {discovery?.fromCache ? " · updated 15 min ago" : ""}
              </p>
            </div>
            {hiddenByPlan > 0 ? (
              <Link href="/pricing" className="btn-secondary">
                Unlock {hiddenByPlan} more matches
              </Link>
            ) : null}
          </div>
          <ul className="grid gap-3 lg:grid-cols-2">
            {results.map(({ job, fit, locationMatch }) => {
              const unclear = locationLabel(locationMatch);
              return (
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
                  <ul className="mt-3 space-y-1 text-sm text-[var(--text-muted)]">
                    {fit.reasons.map((reason) => (
                      <li key={reason}>✓ {reason}</li>
                    ))}
                    {fit.gaps.map((gap) => (
                      <li key={gap} className="text-[var(--warning)]">
                        {gap}
                      </li>
                    ))}
                    {unclear ? (
                      <li className="text-[var(--warning)]">{unclear}</li>
                    ) : null}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2">
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
                      <input
                        type="hidden"
                        name="location"
                        value={job.location}
                      />
                      <input
                        type="hidden"
                        name="description"
                        value={job.description}
                      />
                      <input
                        type="hidden"
                        name="sourceName"
                        value={job.provider}
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
              );
            })}
          </ul>
          {!entitlement.isComplete && hiddenByPlan > 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Showing {results.length} of {discovery?.totalMatched} matches on
              the Starter plan.{" "}
              <Link href="/pricing" className="underline">
                See Complete Edition
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      <Card id="preferences">
        <CardHeader
          title="Search preferences"
          description="Strict location filtering is on by default: a job only appears when its location can be confirmed against your target."
        />
        <form method="get" className="grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              name="loose"
              value="1"
              defaultChecked={!strict}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Include jobs with an unclear location
          </label>
          <label className="space-y-1">
            <span className="label">Work style</span>
            <select
              className="input"
              name="work"
              defaultValue={workMode ?? preference?.workMode ?? "ANY"}
            >
              <option value="ANY">Any work style</option>
              <option value="ONSITE">On-site</option>
              <option value="HYBRID">Hybrid</option>
              <option value="REMOTE">Remote</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Search area</span>
            <select className="input" name="area" defaultValue={area}>
              <option value="city">Target city area</option>
              <option value="country">Whole country</option>
            </select>
          </label>
          <div className="md:col-span-3">
            <button className="btn-primary" type="submit">
              Apply preferences
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Your target city comes from My Profile.{" "}
          <Link href="/app/profile" className="underline">
            Edit job goals and location
          </Link>
        </p>
      </Card>

      <Card id="manual-search">
        <CardHeader
          title="Search manually"
          description="Secondary to the automatic search. Use it to check one title or place directly."
        />
        <form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {!strict ? <input type="hidden" name="loose" value="1" /> : null}
          {area !== "city" ? (
            <input type="hidden" name="area" value={area} />
          ) : null}
          <label className="space-y-1">
            <span className="label">Job title</span>
            <input
              className="input"
              name="mt"
              defaultValue={manualTitle}
              placeholder="Data analyst"
            />
          </label>
          <label className="space-y-1">
            <span className="label">Location</span>
            <input
              className="input"
              name="ml"
              defaultValue={one(params, "ml") || one(params, "location")}
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
          <button className="btn-secondary self-end" type="submit">
            Run this search
          </button>
        </form>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Manual searches still pass the same location check — nothing is shown
          that your preference rules out.
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
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
