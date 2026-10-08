import type { DiscoveredJob, JobSearchQuery } from "@/jobs/providers";

/**
 * Shared plumbing for job sources: timeouts, one retry on transient failures,
 * typed errors that surface in the provider health strip, HTML cleanup and a
 * small in-process cache so one feed download serves many queries.
 */

export type ProviderErrorKind =
  "KEY_MISSING" | "QUOTA" | "HTTP" | "TIMEOUT" | "PARSE" | "NETWORK";

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly status?: number;
  constructor(kind: ProviderErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
    this.status = status;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** Retries on timeout, network errors and 5xx. Never on 4xx. */
  retries?: number;
}

const DEFAULT_TIMEOUT = 9000;

/** Strips anything that looks like a credential from a message before it is shown. */
export function redact(message: string): string {
  return message
    .replace(/(api_key|app_key|key|token|apikey)=([^&\s]+)/gi, "$1=***")
    .replace(/\/api\/[A-Za-z0-9-]{16,}/g, "/api/***");
}

export async function request(
  url: string,
  opts: RequestOptions = {},
): Promise<Response> {
  const retries = opts.retries ?? 1;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      opts.timeoutMs ?? DEFAULT_TIMEOUT,
    );
    try {
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        headers: opts.headers,
        body: opts.body,
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.status >= 500 && attempt < retries) {
        lastError = new ProviderError("HTTP", `HTTP ${res.status}`, res.status);
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        throw new ProviderError(
          "HTTP",
          `HTTP ${res.status} — key rejected or access blocked`,
          res.status,
        );
      }
      if (res.status === 429) {
        throw new ProviderError("QUOTA", "HTTP 429 — rate limited", 429);
      }
      if (!res.ok) {
        throw new ProviderError("HTTP", `HTTP ${res.status}`, res.status);
      }
      return res;
    } catch (e) {
      if (e instanceof ProviderError) {
        if (e.kind === "HTTP" && (e.status ?? 0) >= 500 && attempt < retries) {
          lastError = e;
          continue;
        }
        throw e;
      }
      const aborted = e instanceof Error && e.name === "AbortError";
      lastError = aborted
        ? new ProviderError("TIMEOUT", "timed out")
        : new ProviderError(
            "NETWORK",
            redact(e instanceof Error ? e.message : "network error"),
          );
      if (attempt >= retries) throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new ProviderError("NETWORK", "request failed");
}

export async function requestJson<T>(
  url: string,
  opts: RequestOptions = {},
): Promise<T> {
  const res = await request(url, {
    ...opts,
    headers: { accept: "application/json", ...(opts.headers ?? {}) },
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderError("PARSE", "response was not JSON");
  }
}

export async function requestText(
  url: string,
  opts: RequestOptions = {},
): Promise<string> {
  const res = await request(url, opts);
  return res.text();
}

// ---------------------------------------------------------------------------
// Cache: one download of a whole feed serves every query for a while.
// ---------------------------------------------------------------------------

const cache = new Map<string, { expiresAt: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = load()
    .then((value) => {
      cache.set(key, { expiresAt: Date.now() + ttlMs, value });
      if (cache.size > 500) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function clearSourceCache(): void {
  cache.clear();
  inflight.clear();
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&amp;/gi, "&");
}

export function plainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** "3 days ago" / "Over 30 days ago" → ISO; unparseable stays null. */
export function parseRelativePosted(
  value: string | undefined | null,
): string | null {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return null;
  const now = Date.now();
  if (/just posted|today|now/.test(text)) return new Date(now).toISOString();
  const units: Record<string, number> = {
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
    year: 31_536_000_000,
  };
  const rel = text.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
  if (!rel) return null;
  const ms = units[rel[2]!];
  if (!ms) return null;
  return new Date(now - Number(rel[1]) * ms).toISOString();
}

export function toIso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number.NaN;
  const date = Number.isFinite(n)
    ? new Date(n < 1e12 ? n * 1000 : n)
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ---------------------------------------------------------------------------
// Relevance for feeds that cannot be searched server-side
// ---------------------------------------------------------------------------

const GENERIC = new Set([
  "senior",
  "sr",
  "junior",
  "jr",
  "lead",
  "principal",
  "staff",
  "mid",
  "level",
  "remote",
  "the",
  "and",
  "of",
  "for",
  "a",
  "an",
  "i",
  "ii",
  "iii",
]);

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length > 1 && !GENERIC.has(t));
}

/**
 * True when the job title covers the query title's meaningful words (at least
 * all but one of them, so "Product Designer" matches "Senior Product Designer"
 * and "Product Designer II" but not "Product Manager").
 */
export function titleMatches(jobTitle: string, queryTitle: string): boolean {
  const want = tokens(queryTitle);
  if (want.length === 0) return false;
  const have = new Set(tokens(jobTitle));
  const hits = want.filter((t) => have.has(t)).length;
  return want.length <= 2 ? hits === want.length : hits >= want.length - 1;
}

/** Filters a whole feed down to the rows that match the query title. */
export function filterByTitle(
  jobs: DiscoveredJob[],
  query: JobSearchQuery,
  limit = 60,
): DiscoveredJob[] {
  return jobs.filter((j) => titleMatches(j.title, query.title)).slice(0, limit);
}

/** Drops rows without the minimum a user needs to act on a listing. */
export function usable(job: DiscoveredJob, minDescription = 0): boolean {
  return Boolean(
    job.title.trim() &&
    job.company.trim() &&
    /^https?:\/\//.test(job.sourceUrl) &&
    job.description.length >= minDescription,
  );
}

export function isRemoteText(value: string): boolean {
  return /\bremote\b|work from home|\bwfh\b|anywhere|distributed/i.test(value);
}
