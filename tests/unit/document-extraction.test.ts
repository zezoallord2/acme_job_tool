import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import {
  extractDocxText,
  extractPdfText,
} from "@/worker/handlers/document-parse";

/**
 * Builds a DOCX-shaped ZIP in memory.
 *
 * The regression this guards is subtle: a fixture whose `word/document.xml`
 * contains bare text with no `<w:p>` wrappers will pass an extractor that
 * swallows whole paragraph blocks, because there are no paragraphs to swallow.
 * Real Word and Google Docs output always wraps runs in `<w:p><w:r><w:t>`, so
 * the fixture has to look like the real thing.
 */
function buildDocx(documentXml: string): Buffer {
  const name = "word/document.xml";
  const content = Buffer.from(documentXml, "utf8");
  const deflated = deflateRawSync(content);
  const crc = crc32(content);

  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0, 6); // flags
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(0, 10); // time
  local.writeUInt16LE(0, 12); // date
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  local.write(name, 30);

  const cdOffset = local.length + deflated.length;
  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(deflated.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42);
  central.write(name, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([local, deflated, central, eocd]);
}

let CRC_TABLE: number[] | null = null;
function crc32(buffer: Buffer): number {
  if (!CRC_TABLE) {
    CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
  }
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const REALISTIC_CV = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Zeyad Ahmed Hussein</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Cyber Security | Backend Developer (.NET)</w:t></w:r></w:p>
    <w:p><w:r><w:t>Cairo, Egypt | zeyadahmed20042020@gmail.com</w:t></w:r></w:p>
    <w:p><w:r><w:t>Engineered 5 automated Python ETL pipelines processing 8 datasets, saving 10 hrs/week.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Line one</w:t></w:r><w:r><w:t xml:space="preserve"> continued</w:t></w:r></w:p>
    <w:p><w:r><w:t>Tabbed item</w:t></w:r><w:r><w:tab/><w:t>after tab</w:t></w:r></w:p>
    <w:tbl>
      <w:tr><w:tc><w:p><w:r><w:t>Skill</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Level</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>
    <w:p><w:r><w:t>R&amp;D lead &amp; architect</w:t></w:r></w:p>
  </w:body>
</w:document>`;

describe("DOCX text extraction", () => {
  it("keeps paragraph content instead of swallowing it", () => {
    const text = extractDocxText(buildDocx(REALISTIC_CV));

    // The regression: this was 0 characters for every real DOCX.
    expect(text.length).toBeGreaterThan(100);
    expect(text).toContain("Zeyad Ahmed Hussein");
    expect(text).toContain("Cyber Security | Backend Developer (.NET)");
    expect(text).toContain("zeyadahmed20042020@gmail.com");
    expect(text).toContain(
      "Engineered 5 automated Python ETL pipelines processing 8 datasets, saving 10 hrs/week.",
    );
  });

  it("does not lose words when a line is split across runs", () => {
    const text = extractDocxText(buildDocx(REALISTIC_CV));
    expect(text).toContain("Line one continued");
  });

  it("renders tabs, table cells and XML entities", () => {
    const text = extractDocxText(buildDocx(REALISTIC_CV));
    expect(text).toContain("\t");
    expect(text).toContain("Skill");
    expect(text).toContain("Level");
    // Entities must be decoded, not left as markup.
    expect(text).toContain("R&D lead & architect");
    expect(text).not.toContain("&amp;");
  });

  it("separates paragraphs with newlines so lines stay readable", () => {
    const text = extractDocxText(buildDocx(REALISTIC_CV));
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines[0]).toBe("Zeyad Ahmed Hussein");
    expect(lines.length).toBeGreaterThan(4);
  });

  it("rejects a file that is not a readable DOCX", () => {
    expect(() => extractDocxText(Buffer.from("not a zip at all"))).toThrow();
  });
});

describe("PDF text extraction", () => {
  it("reads text out of an uncompressed content stream", () => {
    // A minimal but structurally valid PDF content stream using Tj operators.
    const body = [
      "%PDF-1.4",
      "1 0 obj",
      "<< /Length 60 >>",
      "stream",
      "BT /F1 12 Tf 72 700 Td (Zeyad Ahmed Hussein) Tj ET",
      "endstream",
      "endobj",
      "trailer",
      "<< /Root 1 0 R >>",
    ].join("\n");
    const text = extractPdfText(Buffer.from(body, "latin1"));
    expect(text).toContain("Zeyad");
  });

  it("reports unreadable text rather than returning empty content", () => {
    // The contract that matters: a failure is surfaced, never silently blank.
    expect(() =>
      extractPdfText(Buffer.from("%PDF-1.4\nno text here\n")),
    ).toThrow();
  });
});
