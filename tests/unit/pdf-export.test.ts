import { describe, expect, it } from "vitest";
import { buildPdf } from "@/lib/export";

describe("PDF text encoding", () => {
  it("encodes bullets, accented names and typographic punctuation for WinAnsi fonts", () => {
    const pdf = buildPdf({
      title: "José’s resume",
      sections: [
        {
          heading: "Skills",
          lines: ["• Python", "• C++", "2024–2026 — Engineering"],
        },
      ],
    }).toString("latin1");
    expect(pdf).toContain("(\\225 Python)");
    expect(pdf).toContain("(\\225 C++)");
    expect(pdf).toContain("Jos\\351\\222s resume");
    expect(pdf).toContain("2024\\2262026 \\227 Engineering");
    expect(pdf).not.toContain("(? Python)");
  });

  it("escapes PDF syntax without truncating long text", () => {
    const title = "A (B) \\ C " + "x".repeat(260);
    const pdf = buildPdf({ title, sections: [] }).toString("latin1");
    expect(pdf).toContain("A \\(B\\) \\\\ C ");
    expect(pdf).toContain("x".repeat(260));
  });
});
