/**
 * Job location normalisation and hard location filtering.
 *
 * Two responsibilities, deliberately kept apart:
 *
 *  1. Turn whatever a provider returned (a free-text `location` plus an optional
 *     arrangement flag) into a structured record without ever discarding the
 *     original string.
 *  2. Decide, deterministically and before any ranking happens, whether that
 *     job satisfies the user's stated location + work-style preference.
 *
 * No maps API, no network calls, no heuristics that depend on ordering: the
 * same inputs always produce the same decision, so it can be unit tested.
 */

export type WorkMode = "ONSITE" | "HYBRID" | "REMOTE" | "ANY";
export type RemoteType = "ONSITE" | "HYBRID" | "REMOTE" | "UNKNOWN";

/** Where a remote role is actually open to, when the source says so. */
export type RemoteScope = "WORLDWIDE" | "COUNTRY" | "REGION" | "UNKNOWN";

export interface NormalizedLocation {
  /** Original provider string, never rewritten. */
  rawLocation: string;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  remoteType: RemoteType;
  remoteScope: RemoteScope;
  /** ISO-3166 alpha-2 codes when a remote role names specific countries. */
  remoteCountries: string[];
  /** Named regions a remote role restricts itself to (EUROPE, MENA, ...). */
  remoteRegions: string[];
}

export interface LocationPreference {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  workMode: WorkMode;
}

export type LocationMatchStatus = "MATCH" | "REJECTED" | "UNKNOWN";

export interface LocationMatch {
  status: LocationMatchStatus;
  /** Internal diagnostic. Shown to users only through curated copy. */
  reason: string;
}

/**
 * Countries tracked for normalisation: display name, ISO-3166 alpha-2 code and
 * the aliases that actually appear in job feeds ("USA", "UK", "UAE", "KSA"...).
 * Deliberately a fixed table — deterministic, offline, and testable.
 */
interface CountryEntry {
  name: string;
  code: string;
  aliases: string[];
  regions: string[];
}

const COUNTRIES: CountryEntry[] = [
  {
    name: "Egypt",
    code: "EG",
    aliases: ["egypt", "misr", "مصر"],
    regions: ["MENA", "AFRICA", "ARAB"],
  },
  {
    name: "United Arab Emirates",
    code: "AE",
    aliases: [
      "uae",
      "united arab emirates",
      "dubai",
      "abu dhabi",
      "الامارات",
      "الإمارات",
      "دبي",
    ],
    regions: ["MENA", "ARAB"],
  },
  {
    name: "Saudi Arabia",
    code: "SA",
    aliases: ["saudi arabia", "ksa", "saudi", "السعودية", "الرياض"],
    regions: ["MENA", "ARAB"],
  },
  {
    name: "United States",
    code: "US",
    aliases: [
      "united states",
      "united states of america",
      "usa",
      "america",
      "us",
    ],
    regions: ["AMERICAS", "NORTH_AMERICA"],
  },
  {
    name: "United Kingdom",
    code: "GB",
    aliases: [
      "united kingdom",
      "uk",
      "great britain",
      "england",
      "scotland",
      "wales",
      "بريطانيا",
    ],
    regions: ["EUROPE"],
  },
  {
    name: "Germany",
    code: "DE",
    aliases: ["germany", "deutschland", "ألمانيا", "المانيا"],
    regions: ["EUROPE"],
  },
  {
    name: "France",
    code: "FR",
    aliases: ["france", "فرنسا"],
    regions: ["EUROPE"],
  },
  {
    name: "Netherlands",
    code: "NL",
    aliases: ["netherlands", "holland"],
    regions: ["EUROPE"],
  },
  {
    name: "Spain",
    code: "ES",
    aliases: ["spain", "espana"],
    regions: ["EUROPE"],
  },
  {
    name: "Italy",
    code: "IT",
    aliases: ["italy", "italia"],
    regions: ["EUROPE"],
  },
  { name: "Poland", code: "PL", aliases: ["poland"], regions: ["EUROPE"] },
  { name: "Portugal", code: "PT", aliases: ["portugal"], regions: ["EUROPE"] },
  { name: "Ireland", code: "IE", aliases: ["ireland"], regions: ["EUROPE"] },
  {
    name: "Switzerland",
    code: "CH",
    aliases: ["switzerland"],
    regions: ["EUROPE"],
  },
  { name: "Austria", code: "AT", aliases: ["austria"], regions: ["EUROPE"] },
  { name: "Belgium", code: "BE", aliases: ["belgium"], regions: ["EUROPE"] },
  { name: "Sweden", code: "SE", aliases: ["sweden"], regions: ["EUROPE"] },
  { name: "Norway", code: "NO", aliases: ["norway"], regions: ["EUROPE"] },
  { name: "Denmark", code: "DK", aliases: ["denmark"], regions: ["EUROPE"] },
  { name: "Finland", code: "FI", aliases: ["finland"], regions: ["EUROPE"] },
  {
    name: "Czechia",
    code: "CZ",
    aliases: ["czechia", "czech republic"],
    regions: ["EUROPE"],
  },
  { name: "Romania", code: "RO", aliases: ["romania"], regions: ["EUROPE"] },
  { name: "Greece", code: "GR", aliases: ["greece"], regions: ["EUROPE"] },
  {
    name: "Turkey",
    code: "TR",
    aliases: ["turkey", "turkiye"],
    regions: ["EUROPE", "MENA"],
  },
  {
    name: "Canada",
    code: "CA",
    aliases: ["canada"],
    regions: ["AMERICAS", "NORTH_AMERICA"],
  },
  {
    name: "Mexico",
    code: "MX",
    aliases: ["mexico"],
    regions: ["AMERICAS", "NORTH_AMERICA"],
  },
  {
    name: "Brazil",
    code: "BR",
    aliases: ["brazil", "brasil"],
    regions: ["AMERICAS", "SOUTH_AMERICA"],
  },
  {
    name: "Argentina",
    code: "AR",
    aliases: ["argentina"],
    regions: ["AMERICAS", "SOUTH_AMERICA"],
  },
  {
    name: "Australia",
    code: "AU",
    aliases: ["australia"],
    regions: ["APAC", "OCEANIA"],
  },
  {
    name: "New Zealand",
    code: "NZ",
    aliases: ["new zealand"],
    regions: ["APAC", "OCEANIA"],
  },
  { name: "India", code: "IN", aliases: ["india"], regions: ["APAC"] },
  { name: "Singapore", code: "SG", aliases: ["singapore"], regions: ["APAC"] },
  { name: "Japan", code: "JP", aliases: ["japan"], regions: ["APAC"] },
  { name: "China", code: "CN", aliases: ["china"], regions: ["APAC"] },
  {
    name: "South Korea",
    code: "KR",
    aliases: ["south korea", "korea"],
    regions: ["APAC"],
  },
  { name: "Malaysia", code: "MY", aliases: ["malaysia"], regions: ["APAC"] },
  { name: "Indonesia", code: "ID", aliases: ["indonesia"], regions: ["APAC"] },
  {
    name: "Philippines",
    code: "PH",
    aliases: ["philippines"],
    regions: ["APAC"],
  },
  { name: "Pakistan", code: "PK", aliases: ["pakistan"], regions: ["APAC"] },
  { name: "Nigeria", code: "NG", aliases: ["nigeria"], regions: ["AFRICA"] },
  {
    name: "South Africa",
    code: "ZA",
    aliases: ["south africa"],
    regions: ["AFRICA"],
  },
  { name: "Kenya", code: "KE", aliases: ["kenya"], regions: ["AFRICA"] },
  {
    name: "Morocco",
    code: "MA",
    aliases: ["morocco"],
    regions: ["MENA", "AFRICA", "ARAB"],
  },
  {
    name: "Tunisia",
    code: "TN",
    aliases: ["tunisia"],
    regions: ["MENA", "AFRICA", "ARAB"],
  },
  {
    name: "Jordan",
    code: "JO",
    aliases: ["jordan"],
    regions: ["MENA", "ARAB"],
  },
  {
    name: "Lebanon",
    code: "LB",
    aliases: ["lebanon"],
    regions: ["MENA", "ARAB"],
  },
  { name: "Qatar", code: "QA", aliases: ["qatar"], regions: ["MENA", "ARAB"] },
  {
    name: "Kuwait",
    code: "KW",
    aliases: ["kuwait"],
    regions: ["MENA", "ARAB"],
  },
  {
    name: "Bahrain",
    code: "BH",
    aliases: ["bahrain"],
    regions: ["MENA", "ARAB"],
  },
  { name: "Oman", code: "OM", aliases: ["oman"], regions: ["MENA", "ARAB"] },
  { name: "Israel", code: "IL", aliases: ["israel"], regions: ["MENA"] },
  { name: "Iraq", code: "IQ", aliases: ["iraq"], regions: ["MENA", "ARAB"] },
  {
    name: "Liechtenstein",
    code: "LI",
    aliases: ["liechtenstein"],
    regions: ["EUROPE"],
  },
];

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Normalised alias → country, longest alias first so "united states" wins over "us". */
const ALIAS_INDEX: Array<{ alias: string; entry: CountryEntry }> =
  COUNTRIES.flatMap((entry) =>
    [entry.name, ...entry.aliases].map((alias) => ({
      alias: squashTokens(alias).trim(),
      entry,
    })),
  ).sort((a, b) => b.alias.length - a.alias.length);

/**
 * Cities that are treated as the same labour market as their anchor city.
 * This is the documented "Greater Cairo" style rule: it is explicit, finite and
 * covered by tests, never inferred at runtime.
 */
const CITY_AREAS: Record<string, { label: string; cities: string[] }> = {
  cairo: {
    label: "Greater Cairo",
    cities: [
      "cairo",
      "giza",
      "new cairo",
      "6 october",
      "6th of october",
      "october city",
      "helwan",
      "maadi",
      "nasr city",
      "shubra",
      "obour",
      "shorouk",
      "madinaty",
      "badr",
      "10th of ramadan",
      "tanta",
      "mansoura",
      "القاهرة",
      "الجيزة",
      "مدينة نصر",
      "المعادي",
      "شبرا",
      "حلوان",
      "السادس من أكتوبر",
      "الشروق",
    ],
  },
};

const REGION_WORDS: Record<string, string> = {
  worldwide: "WORLDWIDE",
  global: "WORLDWIDE",
  anywhere: "WORLDWIDE",
  europe: "EUROPE",
  "european union": "EUROPE",
  eu: "EUROPE",
  mena: "MENA",
  "middle east": "MENA",
  "north africa": "MENA",
  americas: "AMERICAS",
  "north america": "NORTH_AMERICA",
  "south america": "SOUTH_AMERICA",
  apac: "APAC",
  "asia pacific": "APAC",
};

const REMOTE_WORDS =
  /\b(remote|work from home|wfh|fully distributed|anywhere|home based|distributed team)\b/i;
const HYBRID_WORDS = /\b(hybrid|flexible|blended)\b/i;
const ONSITE_WORDS =
  /\b(onsite|on-site|in-office|in office|office based|on site)\b/i;

function squash(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Lower-case, punctuation-free, space-collapsed text with padding for boundary checks. */
function squashTokens(value: string): string {
  return ` ${squash(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")} `;
}

function findCountry(text: string): CountryEntry | null {
  const hay = squashTokens(text);
  for (const { alias, entry } of ALIAS_INDEX) {
    if (hay.includes(` ${alias} `)) return entry;
  }
  return null;
}

function title(value: string): string {
  return value
    .split(/[\s/|,-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function arrangementOf(workArrangement?: string | null): RemoteType | null {
  switch ((workArrangement ?? "").toUpperCase()) {
    case "REMOTE":
      return "REMOTE";
    case "HYBRID":
      return "HYBRID";
    case "ON_SITE":
    case "ONSITE":
      return "ONSITE";
    default:
      return null;
  }
}

/** Structured view of a provider job's location. `rawLocation` is the source string. */
/** Arbeitnow-origin feeds sometimes hold UTF-8 Arabic decoded as Latin-1 ("Ø¯Ø¨ÙŠ"). Reverse that only when the result is valid UTF-8 that decodes to Arabic script. */
function repairMojibake(value: string): string {
  try {
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.from(value, "latin1"),
    );
    if (/[\u0600-\u06FF]/.test(repaired)) return repaired;
  } catch {
    // Invalid UTF-8 after the round-trip means the string was never mojibake.
  }
  return value;
}

export function normalizeJobLocation(input: {
  location: string;
  workArrangement?: string | null;
  tags?: string[];
  title?: string;
}): NormalizedLocation {
  const raw = (repairMojibake(input.location ?? "") ?? "").trim();
  const text = squash(raw);
  const tagText = squash((input.tags ?? []).join(" "));
  const combined = squash(`${text} ${tagText}`);

  const country = findCountry(text);
  const regionHay = squashTokens(combined);
  const mentionsRegion = Object.keys(REGION_WORDS).find((word) =>
    regionHay.includes(` ${squashTokens(word).trim()} `),
  );

  let remoteType: RemoteType =
    arrangementOf(input.workArrangement) ??
    (REMOTE_WORDS.test(combined) ? "REMOTE" : null) ??
    (HYBRID_WORDS.test(combined) ? "HYBRID" : null) ??
    (ONSITE_WORDS.test(combined) ? "ONSITE" : "UNKNOWN");

  // A source that flags `remote: true` but also prints a city keeps both facts:
  // the office exists, the default working mode is remote.
  if (
    remoteType === "REMOTE" &&
    arrangementOf(input.workArrangement) === null &&
    HYBRID_WORDS.test(combined)
  ) {
    remoteType = "HYBRID";
  }

  let remoteScope: RemoteScope = "UNKNOWN";
  let remoteCountries: string[] = [];
  let remoteRegions: string[] = [];

  if (remoteType === "REMOTE") {
    if (country) {
      // "Anywhere in Germany" is Germany-locked, not worldwide: an explicit
      // country always beats a vague "anywhere"/"worldwide" region word.
      remoteScope = "COUNTRY";
      remoteCountries = [country.code];
    } else if (mentionsRegion && REGION_WORDS[mentionsRegion] === "WORLDWIDE") {
      remoteScope = "WORLDWIDE";
    } else if (mentionsRegion) {
      remoteScope = "REGION";
      remoteRegions = [REGION_WORDS[mentionsRegion]!];
    } else if (text.length === 0 || /remote|anywhere/.test(text)) {
      // "Remote" alone is not a promise of worldwide eligibility.
      remoteScope = "UNKNOWN";
    } else {
      remoteScope = "UNKNOWN";
    }
  }

  // City / region extraction: split the raw string and keep every non-country
  // segment, so "Cairo Governorate, Egypt" yields city "Cairo" + region.
  const parts = raw
    .split(/[,|/،؛•·—–-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);

  let city: string | null = null;
  let region: string | null = null;
  for (const part of parts) {
    if (findCountry(part)) continue;
    if (REMOTE_WORDS.test(part) && parts.length > 1 && !city) continue;
    const cleaned = part
      .replace(/\b(governorate|district|region|area)\b/gi, "")
      .trim();
    if (!cleaned) continue;
    if (!city) city = title(cleaned);
    else if (!region) region = title(cleaned);
  }

  // A bare "Remote" is not a city.
  if (city && REMOTE_WORDS.test(city) && city.split(" ").length <= 2) {
    if (remoteType === "REMOTE") city = null;
  }

  return {
    rawLocation: raw,
    city,
    region,
    country: country?.name ?? null,
    countryCode: country?.code ?? null,
    remoteType,
    remoteScope,
    remoteCountries,
    remoteRegions,
  };
}

/**
 * Deterministic parse of the user's stated preference, e.g. "Cairo, Egypt" →
 * city Cairo / country Egypt / code EG. No geocoder: country codes come from
 * the fixed table above.
 */
export function normalizeTargetLocation(input: string | null | undefined): {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
} {
  const raw = (input ?? "").trim();
  if (!raw)
    return { city: null, region: null, country: null, countryCode: null };

  const parts = raw
    .split(/[,|/،؛]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const countryPart = parts.find((part) => findCountry(part));
  const country = countryPart ? findCountry(countryPart) : null;
  const nonCountry = parts.filter((part) => !findCountry(part));

  let city: string | null = null;
  let region: string | null = null;
  for (const part of nonCountry) {
    const cleaned = part
      .replace(/\b(governorate|district|region|area)\b/gi, "")
      .trim();
    if (!cleaned) continue;
    if (!city) city = title(cleaned);
    else if (!region) region = title(cleaned);
  }

  // A single token that is not a country is a city ("Cairo").
  if (!city && !country && parts.length === 1 && parts[0]) {
    city = title(parts[0].replace(/\b(governorate)\b/gi, "").trim());
  }

  return {
    city,
    region,
    country: country?.name ?? null,
    countryCode: country?.code ?? null,
  };
}

function sameText(a: string, b: string): boolean {
  return squash(a) === squash(b);
}

function cityMatches(
  jobCity: string | null,
  targetCity: string | null,
): boolean {
  if (!jobCity || !targetCity) return false;
  if (sameText(jobCity, targetCity)) return true;
  const key = squash(targetCity).split(" ")[0];
  const area = CITY_AREAS[key];
  if (area) {
    const jobKey = squash(jobCity);
    if (
      area.cities.some((city) => jobKey === city || jobKey.startsWith(city))
    ) {
      return true;
    }
  }
  // "Greater Cairo" style phrasing on the job side.
  if (/greater|metro|metropolitan/.test(squash(jobCity)) && key) {
    return squash(jobCity).includes(key);
  }
  return false;
}

/**
 * Hard location decision. Runs BEFORE match scoring so a Berlin job can never
 * be "ranked lower" for a Cairo search — it never enters the list at all.
 */
export function matchJobLocation(
  job: NormalizedLocation,
  pref: LocationPreference,
): LocationMatch {
  if (pref.workMode === "ANY") {
    return {
      status: "MATCH",
      reason:
        "No strict work-style preference; location is a ranking signal only.",
    };
  }

  const where = job.rawLocation?.trim() || "an unlisted location";

  // --- On-site / hybrid: the office must satisfy the user's geography. ---
  if (pref.workMode === "ONSITE" || pref.workMode === "HYBRID") {
    if (job.remoteType === "REMOTE") {
      return {
        status: "REJECTED",
        reason: `Remote-only role (${where}) conflicts with the requested ${pref.workMode === "ONSITE" ? "on-site" : "hybrid"} location.`,
      };
    }

    const hasAnyGeo = Boolean(job.city || job.country || job.region);
    if (!hasAnyGeo) {
      return {
        status: "UNKNOWN",
        reason:
          "Job does not list an office location, so it cannot be confirmed for on-site work.",
      };
    }

    if (pref.city) {
      if (cityMatches(job.city, pref.city)) {
        return {
          status: "MATCH",
          reason: `Job city ${job.city} matches target city ${pref.city}${pref.countryCode ? ` and country ${pref.countryCode}` : ""}.`,
        };
      }
      // Same country but a different city: allowed only when the user gave no
      // country-wide instruction, and never silently for a named city.
      if (pref.countryCode && job.countryCode === pref.countryCode) {
        if (!job.city) {
          return {
            status: "UNKNOWN",
            reason: `Job lists ${job.country} only, with no city, so it cannot be confirmed for ${pref.city}.`,
          };
        }
        return {
          status: "REJECTED",
          reason: `Job city ${job.city} is outside the requested ${pref.city} area (country ${pref.countryCode} matches).`,
        };
      }
      if (!pref.countryCode) {
        return {
          status: "REJECTED",
          reason: `Job city ${job.city ?? "unlisted"} does not match target city ${pref.city}.`,
        };
      }
      return {
        status: "REJECTED",
        reason: `Job country ${job.country ?? "unlisted"}${job.countryCode ? ` (${job.countryCode})` : ""} conflicts with required country ${pref.country}${pref.countryCode ? ` (${pref.countryCode})` : ""}.`,
      };
    }

    if (pref.countryCode) {
      if (job.countryCode === pref.countryCode) {
        return {
          status: "MATCH",
          reason: `Job country ${job.country} matches required country ${pref.country}.`,
        };
      }
      return {
        status: "REJECTED",
        reason: `Job country ${job.country ?? "unlisted"}${job.countryCode ? ` (${job.countryCode})` : ""} conflicts with required country ${pref.country}${pref.countryCode ? ` (${pref.countryCode})` : ""}.`,
      };
    }

    return {
      status: "UNKNOWN",
      reason:
        "No target location is configured, so the job location cannot be verified.",
    };
  }

  // --- Remote: eligibility, not geography. ---
  if (pref.workMode === "REMOTE") {
    if (job.remoteType !== "REMOTE") {
      return {
        status: "REJECTED",
        reason: `Role is not remote (${where}); a remote position was requested.`,
      };
    }

    if (job.remoteScope === "WORLDWIDE") {
      return {
        status: "MATCH",
        reason: "Remote role is open worldwide.",
      };
    }

    if (job.remoteScope === "COUNTRY") {
      if (pref.countryCode && job.remoteCountries.includes(pref.countryCode)) {
        return {
          status: "MATCH",
          reason: `Remote role explicitly includes ${pref.country}.`,
        };
      }
      return {
        status: "REJECTED",
        reason: `Remote role is restricted to ${job.remoteCountries.join(", ")} and does not include ${pref.countryCode ?? "your location"}.`,
      };
    }

    if (job.remoteScope === "REGION") {
      const region = job.remoteRegions[0];
      const targetCountry = pref.countryCode
        ? COUNTRY_BY_CODE.get(pref.countryCode)
        : null;
      if (targetCountry && region && targetCountry.regions.includes(region)) {
        return {
          status: "MATCH",
          reason: `Remote role covers ${region}, which includes ${pref.country}.`,
        };
      }
      if (region === "MENA" && !targetCountry) {
        return {
          status: "UNKNOWN",
          reason: "Remote role is MENA-only and your country is unset.",
        };
      }
      return {
        status: "REJECTED",
        reason: `Remote role is limited to ${region ?? "an unlisted region"}, which does not include ${pref.country ?? "your location"}.`,
      };
    }

    return {
      status: "UNKNOWN",
      reason:
        "Remote eligibility region is not stated, so it cannot be confirmed.",
    };
  }

  return { status: "UNKNOWN", reason: "Unsupported work mode." };
}

/** Compact, user-safe phrasing for an unknown location state. */
export const LOCATION_UNKNOWN_LABEL = "Location eligibility unclear";
