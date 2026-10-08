import { env } from "@/lib/env";
import {
  ArbeitnowProvider,
  RemoteOkProvider,
  SerpApiGoogleJobsProvider,
  type JobSearchProvider,
} from "@/jobs/providers";
import {
  HackerNewsHiringProvider,
  HimalayasProvider,
  JobicyProvider,
  RemotiveProvider,
  TheMuseProvider,
  WeWorkRemotelyProvider,
} from "./keyless";
import {
  AdzunaProvider,
  JoobleProvider,
  JSearchProvider,
  UsaJobsProvider,
} from "./keyed";
import { AtsBoardsProvider } from "./ats";

/**
 * Every job source, in display order. Keys are read from the validated env
 * once per call, so a changed .env takes effect on restart without code edits.
 * JOB_SEARCH_PROVIDERS (comma separated ids) narrows the list when set.
 */
export function defaultProviders(): JobSearchProvider[] {
  const e = env();
  const all: JobSearchProvider[] = [
    new ArbeitnowProvider(),
    new RemoteOkProvider(),
    new RemotiveProvider(),
    new HimalayasProvider(),
    new JobicyProvider(),
    new WeWorkRemotelyProvider(),
    new HackerNewsHiringProvider(),
    new TheMuseProvider(e.THEMUSE_API_KEY ?? ""),
    new AdzunaProvider(
      e.ADZUNA_APP_ID ?? "",
      e.ADZUNA_APP_KEY ?? "",
      e.ADZUNA_COUNTRIES,
    ),
    new JoobleProvider(e.JOOBLE_API_KEY ?? ""),
    new UsaJobsProvider(e.USAJOBS_API_KEY ?? "", e.USAJOBS_USER_AGENT ?? ""),
    new AtsBoardsProvider("greenhouse"),
    new AtsBoardsProvider("lever"),
    new AtsBoardsProvider("ashby"),
    new SerpApiGoogleJobsProvider(
      e.SERPAPI_API_KEY ?? "",
      undefined,
      undefined,
      e.SERPAPI_PAGES,
    ),
    new JSearchProvider(
      e.JSEARCH_API_KEY ?? "",
      e.RAPIDAPI_KEY ?? "",
      e.JSEARCH_PAGES,
    ),
  ];
  const allow = new Set(e.JOB_SEARCH_PROVIDERS.map((p) => p.toLowerCase()));
  return allow.size ? all.filter((p) => allow.has(p.id)) : all;
}

/** Display label for a provider id, including ids from old cached rows. */
export function providerDisplayName(id: string): string {
  const known: Record<string, string> = {
    "arbeitnow-eu": "Arbeitnow",
    "arbeitnow-uk": "Arbeitnow UK",
    remoteok: "RemoteOK",
    remotive: "Remotive",
    himalayas: "Himalayas",
    jobicy: "Jobicy",
    weworkremotely: "We Work Remotely",
    "hn-whoishiring": "HN Who is hiring",
    themuse: "The Muse",
    adzuna: "Adzuna",
    jooble: "Jooble",
    usajobs: "USAJobs",
    greenhouse: "Company board (Greenhouse)",
    lever: "Company board (Lever)",
    ashby: "Company board (Ashby)",
    "google-jobs": "Google Jobs",
    jsearch: "JSearch",
  };
  return known[id] ?? id;
}
