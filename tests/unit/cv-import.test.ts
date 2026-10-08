import { describe, it, expect } from "vitest";
import { parseExtractedProfile } from "@/services/cv-import-service";

/**
 * A model response is untrusted input.
 *
 * These tests cover the ways a response can be malformed or hostile, because the
 * product promise is that a profile contains only what the CV actually said. A
 * hallucinated field that reaches the database is worse than an empty profile:
 * the user cannot tell the difference.
 */
describe("CV import response parsing", () => {
  const complete = JSON.stringify({
    firstName: "Zeyad",
    lastName: "Hussein",
    email: "zeyad@example.com",
    phone: "+20 155 079 8013",
    location: "Cairo, Egypt",
    links: ["https://linkedin.com/in/zeyad", "not-a-url"],
    headline: "Cyber Security | Backend Developer (.NET)",
    summary: "Computer Science graduate.",
    skills: ["CCNA", "SQL", "Python", "Power BI"],
    roles: [
      {
        title: "BI Intern",
        company: "Ibn Sina Pharma",
        start: "Jun 2025",
        end: "Aug 2025",
        bullets: ["Monitored 15 KPIs"],
      },
    ],
    education: [
      {
        institution: "Fayoum University",
        qualification: "Computer Science",
        endYear: "2025",
      },
    ],
    certifications: ["SC-100", "CCNA"],
  });

  it("parses a well-formed response", () => {
    const p = parseExtractedProfile(complete);
    expect(p.firstName).toBe("Zeyad");
    expect(p.skills).toHaveLength(4);
    expect(p.roles[0]?.company).toBe("Ibn Sina Pharma");
    expect(p.certifications).toEqual(["SC-100", "CCNA"]);
  });

  it("unwraps a markdown code fence", () => {
    const p = parseExtractedProfile("```json\n" + complete + "\n```");
    expect(p.firstName).toBe("Zeyad");
  });

  it("recovers JSON wrapped in prose", () => {
    const p = parseExtractedProfile(
      "Here is the profile you asked for:\n" +
        complete +
        "\nLet me know if you need changes.",
    );
    expect(p.firstName).toBe("Zeyad");
  });

  it("drops a malformed email rather than saving it", () => {
    const p = parseExtractedProfile(
      JSON.stringify({ email: "not-an-email", skills: ["SQL"] }),
    );
    // A broken address must never overwrite a working one on the account.
    expect(p.email).toBeNull();
    expect(p.skills).toEqual(["SQL"]);
  });

  it("keeps only links that look like links", () => {
    const p = parseExtractedProfile(complete);
    expect(p.links).toEqual(["https://linkedin.com/in/zeyad"]);
  });

  it("returns nulls rather than throwing on missing fields", () => {
    const p = parseExtractedProfile(JSON.stringify({ skills: ["SQL"] }));
    expect(p.firstName).toBeNull();
    expect(p.summary).toBeNull();
    expect(p.roles).toEqual([]);
    expect(p.education).toEqual([]);
  });

  it("rejects output that is not JSON at all", () => {
    expect(() => parseExtractedProfile("I cannot help with that.")).toThrow();
    expect(() => parseExtractedProfile("")).toThrow();
    expect(() => parseExtractedProfile("{ truncated")).toThrow();
  });

  it("survives wrong types in every field", () => {
    // A model that returns numbers or objects where strings were asked for must
    // not take the import down.
    const p = parseExtractedProfile(
      JSON.stringify({
        firstName: 42,
        skills: ["SQL", { bad: true }, null, 7],
        roles: "not an array",
        education: [null, 3],
        certifications: [{}],
      }),
    );
    expect(p.firstName).toBeNull();
    expect(p.skills).toEqual(["SQL"]);
    expect(p.roles).toEqual([]);
    expect(p.certifications).toEqual([]);
  });

  it("caps array lengths so a runaway response cannot bloat the profile", () => {
    const p = parseExtractedProfile(
      JSON.stringify({
        skills: Array.from({ length: 500 }, (_, i) => `skill-${i}`),
        roles: Array.from({ length: 100 }, () => ({
          title: "t",
          company: "c",
          bullets: ["b"],
        })),
      }),
    );
    expect(p.skills.length).toBeLessThanOrEqual(40);
    expect(p.roles.length).toBeLessThanOrEqual(15);
  });
});
