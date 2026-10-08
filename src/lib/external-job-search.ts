/**
 * Prefilled searches on sites that offer no public job-search API to us.
 *
 * LinkedIn's job APIs are partner-only, Glassdoor closed its API and Indeed
 * retired its Publisher API; scraping any of them breaks their terms. Their
 * listings reach users through Google Jobs / JSearch, and these links open the
 * sites themselves with the user's query already filled in.
 */
export interface ExternalSearchLink {
  site: "LinkedIn" | "Glassdoor" | "Indeed";
  href: string;
}

export function externalSearchLinks(input: {
  title: string;
  location?: string | null;
  remote?: boolean;
}): ExternalSearchLink[] {
  const title = input.title.trim();
  if (!title) return [];
  const location = input.remote ? "Remote" : (input.location ?? "").trim();

  const linkedin = new URL("https://www.linkedin.com/jobs/search/");
  linkedin.searchParams.set("keywords", title);
  if (location) linkedin.searchParams.set("location", location);
  if (input.remote) linkedin.searchParams.set("f_WT", "2");

  const glassdoor = new URL("https://www.glassdoor.com/Job/jobs.htm");
  glassdoor.searchParams.set("sc.keyword", title);
  if (location) glassdoor.searchParams.set("locKeyword", location);

  const indeed = new URL("https://www.indeed.com/jobs");
  indeed.searchParams.set("q", title);
  if (location) indeed.searchParams.set("l", location);

  return [
    { site: "LinkedIn", href: linkedin.toString() },
    { site: "Glassdoor", href: glassdoor.toString() },
    { site: "Indeed", href: indeed.toString() },
  ];
}
