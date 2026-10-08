import { describe, expect, it } from "vitest";
import {
  matchJobLocation,
  normalizeJobLocation,
  normalizeTargetLocation,
  type LocationPreference,
  type NormalizedLocation,
} from "@/jobs/location";

function job(input: {
  location: string;
  workArrangement?: string | null;
  tags?: string[];
}): NormalizedLocation {
  return normalizeJobLocation(input);
}

const cairoOnSite: LocationPreference = {
  city: "Cairo",
  region: null,
  country: "Egypt",
  countryCode: "EG",
  workMode: "ONSITE",
};

const cairoHybrid: LocationPreference = { ...cairoOnSite, workMode: "HYBRID" };

const egyptRemote: LocationPreference = {
  city: null,
  region: null,
  country: "Egypt",
  countryCode: "EG",
  workMode: "REMOTE",
};

const anyWhere: LocationPreference = {
  city: "Cairo",
  region: null,
  country: "Egypt",
  countryCode: "EG",
  workMode: "ANY",
};

describe("normalizeTargetLocation", () => {
  it("parses 'Cairo, Egypt' into city + country + ISO code", () => {
    expect(normalizeTargetLocation("Cairo, Egypt")).toEqual({
      city: "Cairo",
      region: null,
      country: "Egypt",
      countryCode: "EG",
    });
  });

  it("parses a bare city", () => {
    expect(normalizeTargetLocation("Cairo").countryCode).toBeNull();
    expect(normalizeTargetLocation("Cairo").city).toBe("Cairo");
  });

  it("handles common aliases", () => {
    expect(normalizeTargetLocation("London, UK").countryCode).toBe("GB");
    expect(normalizeTargetLocation("Berlin, Germany").countryCode).toBe("DE");
    expect(normalizeTargetLocation("Dubai, UAE").countryCode).toBe("AE");
  });

  it("is empty-safe", () => {
    expect(normalizeTargetLocation("")).toEqual({
      city: null,
      region: null,
      country: null,
      countryCode: null,
    });
    expect(normalizeTargetLocation(undefined).city).toBeNull();
  });
});

describe("normalizeJobLocation", () => {
  it("keeps the raw source location and derives structure", () => {
    const normalized = job({
      location: "Cairo Governorate, Egypt",
      workArrangement: "ON_SITE",
    });
    expect(normalized.rawLocation).toBe("Cairo Governorate, Egypt");
    expect(normalized.city).toBe("Cairo");
    expect(normalized.country).toBe("Egypt");
    expect(normalized.countryCode).toBe("EG");
    expect(normalized.remoteType).toBe("ONSITE");
  });

  it("does not confuse short aliases with substrings", () => {
    expect(job({ location: "Sydney, Australia" }).countryCode).toBe("AU");
    expect(job({ location: "Austin, United States" }).countryCode).toBe("US");
    expect(job({ location: "Berlin, Germany" }).countryCode).toBe("DE");
  });

  it("detects a worldwide remote role", () => {
    const normalized = job({ location: "Remote - Worldwide" });
    expect(normalized.remoteType).toBe("REMOTE");
    expect(normalized.remoteScope).toBe("WORLDWIDE");
  });

  it("detects a country-locked remote role", () => {
    const normalized = job({ location: "Remote - Germany only" });
    expect(normalized.remoteScope).toBe("COUNTRY");
    expect(normalized.remoteCountries).toEqual(["DE"]);
  });

  it("detects a region-locked remote role", () => {
    const normalized = job({ location: "Remote - EU only" });
    expect(normalized.remoteScope).toBe("REGION");
    expect(normalized.remoteRegions).toEqual(["EUROPE"]);
  });

  it("treats an unqualified 'Remote' as unknown eligibility", () => {
    const normalized = job({ location: "Remote" });
    expect(normalized.remoteType).toBe("REMOTE");
    expect(normalized.remoteScope).toBe("UNKNOWN");
  });

  it("treats 'Anywhere in Germany' as a Germany-locked remote, not worldwide", () => {
    const normalized = job({ location: "Anywhere in Germany" });
    expect(normalized.remoteType).toBe("REMOTE");
    expect(normalized.remoteScope).toBe("COUNTRY");
    expect(normalized.remoteCountries).toEqual(["DE"]);
    expect(matchJobLocation(normalized, cairoOnSite).status).toBe("REJECTED");
  });
});

describe("hard location filtering - on-site Cairo, Egypt", () => {
  it("includes Cairo", () => {
    const match = matchJobLocation(
      job({ location: "Cairo, Egypt", workArrangement: "ON_SITE" }),
      cairoOnSite,
    );
    expect(match.status).toBe("MATCH");
    expect(match.reason).toContain("Cairo");
  });

  it("includes Cairo Governorate", () => {
    expect(
      matchJobLocation(
        job({ location: "Cairo Governorate, Egypt" }),
        cairoOnSite,
      ).status,
    ).toBe("MATCH");
  });

  it("includes Giza through the documented Greater Cairo rule", () => {
    const match = matchJobLocation(
      job({ location: "Giza, Egypt" }),
      cairoOnSite,
    );
    expect(match.status).toBe("MATCH");
  });

  it("excludes Berlin", () => {
    const match = matchJobLocation(
      job({ location: "Berlin, Germany", workArrangement: "ON_SITE" }),
      cairoOnSite,
    );
    expect(match.status).toBe("REJECTED");
    expect(match.reason).toContain("DE");
  });

  it("excludes London and New York", () => {
    expect(
      matchJobLocation(job({ location: "London, UK" }), cairoOnSite).status,
    ).toBe("REJECTED");
    expect(
      matchJobLocation(
        job({ location: "New York, United States" }),
        cairoOnSite,
      ).status,
    ).toBe("REJECTED");
  });

  it("excludes a remote-only Germany role", () => {
    const match = matchJobLocation(
      job({ location: "Remote - Germany" }),
      cairoOnSite,
    );
    expect(match.status).toBe("REJECTED");
    expect(match.reason.toLowerCase()).toContain("remote");
  });

  it("returns UNKNOWN when the office country is unlisted", () => {
    expect(matchJobLocation(job({ location: "" }), cairoOnSite).status).toBe(
      "UNKNOWN",
    );
    expect(
      matchJobLocation(job({ location: "Egypt" }), cairoOnSite).status,
    ).toBe("UNKNOWN");
  });

  it("does not accept a different Egyptian city as Cairo", () => {
    expect(
      matchJobLocation(job({ location: "Alexandria, Egypt" }), cairoOnSite)
        .status,
    ).toBe("REJECTED");
  });
});

describe("hard location filtering - hybrid Cairo", () => {
  it("accepts a Cairo hybrid role", () => {
    expect(
      matchJobLocation(
        job({ location: "Cairo, Egypt", workArrangement: "HYBRID" }),
        cairoHybrid,
      ).status,
    ).toBe("MATCH");
  });

  it("rejects a hybrid Germany role", () => {
    expect(
      matchJobLocation(
        job({ location: "Berlin, Germany", workArrangement: "HYBRID" }),
        cairoHybrid,
      ).status,
    ).toBe("REJECTED");
  });

  it("rejects a remote-only role for a hybrid request", () => {
    expect(
      matchJobLocation(job({ location: "Remote" }), cairoHybrid).status,
    ).toBe("REJECTED");
  });
});

describe("remote eligibility - remote Egypt", () => {
  it("includes worldwide remote roles", () => {
    const match = matchJobLocation(
      job({ location: "Remote - Worldwide" }),
      egyptRemote,
    );
    expect(match.status).toBe("MATCH");
  });

  it("includes Egypt remote roles", () => {
    expect(
      matchJobLocation(job({ location: "Remote - Egypt" }), egyptRemote).status,
    ).toBe("MATCH");
  });

  it("includes MENA remote roles because Egypt is in MENA", () => {
    expect(
      matchJobLocation(job({ location: "Remote - MENA" }), egyptRemote).status,
    ).toBe("MATCH");
  });

  it("excludes EU-only remote roles", () => {
    const match = matchJobLocation(
      job({ location: "Remote - EU only" }),
      egyptRemote,
    );
    expect(match.status).toBe("REJECTED");
    expect(match.reason).toContain("EUROPE");
  });

  it("excludes US-only and Germany-only remote roles", () => {
    expect(
      matchJobLocation(job({ location: "Remote - US only" }), egyptRemote)
        .status,
    ).toBe("REJECTED");
    expect(
      matchJobLocation(job({ location: "Remote - Germany" }), egyptRemote)
        .status,
    ).toBe("REJECTED");
  });

  it("excludes on-site roles when the user asked for remote", () => {
    expect(
      matchJobLocation(
        job({ location: "Cairo, Egypt", workArrangement: "ON_SITE" }),
        egyptRemote,
      ).status,
    ).toBe("REJECTED");
  });

  it("marks an unqualified remote role as eligibility unknown", () => {
    const match = matchJobLocation(job({ location: "Remote" }), egyptRemote);
    expect(match.status).toBe("UNKNOWN");
    expect(match.reason.toLowerCase()).toContain("eligibility");
  });
});

describe("work mode ANY", () => {
  it("treats location as a ranking signal, never a hard filter", () => {
    expect(
      matchJobLocation(job({ location: "Berlin, Germany" }), anyWhere).status,
    ).toBe("MATCH");
    expect(
      matchJobLocation(job({ location: "Berlin, Germany" }), anyWhere).reason,
    ).toContain("ranking");
  });
});

describe("Arabic location strings (Arbeitnow MENA feed)", () => {
  it("parses Arabic country names", () => {
    const normalized = job({ location: "دبي، الإمارات العربية المتحدة" });
    expect(normalized.countryCode).toBe("AE");
    expect(normalized.remoteType).toBe("UNKNOWN");
  });

  it("parses an Arabic Cairo job as a Cairo match", () => {
    const normalized = job({ location: "القاهرة، مصر" });
    expect(normalized.countryCode).toBe("EG");
    expect(normalized.city).toBe("القاهرة");
    const match = matchJobLocation(normalized, cairoOnSite);
    expect(match.status).toBe("MATCH");
  });

  it("rejects an Arabic Dubai office job for a Cairo target", () => {
    const match = matchJobLocation(job({ location: "دبي دبي" }), cairoOnSite);
    expect(match.status).toBe("REJECTED");
  });

  it("rejects Arabic Germany mentions", () => {
    expect(
      matchJobLocation(job({ location: "برلين، ألمانيا" }), cairoOnSite).status,
    ).toBe("REJECTED");
    expect(
      matchJobLocation(job({ location: "ألمانيا" }), cairoOnSite).status,
    ).toBe("REJECTED");
  });

  it("normalises an Arabic target string", () => {
    const target = normalizeTargetLocation("القاهرة، مصر");
    expect(target.city).toBe("القاهرة");
    expect(target.countryCode).toBe("EG");
  });

  it("only matches a real Arabic Cairo word, not substrings of other words", () => {
    expect(
      matchJobLocation(job({ location: "الناصرية، العراق" }), cairoOnSite)
        .status,
    ).toBe("REJECTED");
  });

  it("repairs UTF-8 Arabic stored as Latin-1 mojibake", () => {
    // "دبي، دبي دبي الإمارات العربية المتحدة" decoded once as Latin-1.
    const mojibake = Buffer.from(
      "دبي، دبي دبي الإمارات العربية المتحدة",
      "utf8",
    ).toString("latin1");
    const normalized = job({ location: mojibake });
    expect(normalized.rawLocation).toContain("دبي");
    expect(normalized.countryCode).toBe("AE");
    expect(matchJobLocation(normalized, cairoOnSite).status).toBe("REJECTED");
  });

  it("does not corrupt plain ASCII or Latin-1 accented text", () => {
    const ascii = job({ location: "Lennestadt" });
    expect(ascii.rawLocation).toBe("Lennestadt");
    const accented = job({ location: "München, Germany" });
    expect(accented.rawLocation).toBe("München, Germany");
    expect(accented.countryCode).toBe("DE");
  });
});
