/**
 * Minimal DOCX writer.
 *
 * A .docx is a ZIP of XML parts. We emit a valid minimal package using Node's
 * built-in zlib, so there is no document-service dependency and nothing to pay
 * for. Only the parts a resume needs are produced.
 */
import { deflateRawSync, crc32 } from "node:zlib";

export interface DocxSpec {
  title: string;
  subtitle?: string;
  contact?: string[];
  sections: Array<{ heading: string; lines: string[] }>;
}

export function buildDocx(spec: DocxSpec): Buffer {
  const body = [
    paragraph(spec.title, { size: 40, bold: true }),
    ...(spec.subtitle
      ? [paragraph(spec.subtitle, { size: 20, color: "118E94" })]
      : []),
    ...(spec.contact ?? []).map((line) =>
      paragraph(line, { size: 18, color: "61728A" }),
    ),
  ].join("");

  const sections = spec.sections
    .map((section) => {
      const heading = paragraph(section.heading.toUpperCase(), {
        size: 24,
        bold: true,
        spacingBefore: 240,
      });
      const lines = section.lines.map((line) =>
        line.startsWith("• ")
          ? paragraph(line.slice(2), { size: 20, bullet: true })
          : paragraph(line, { size: 20 }),
      );
      return heading + lines.join("");
    })
    .join("");

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body}${sections}` +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
    "</w:body></w:document>";

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    "</Types>";

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";

  return buildZip([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rels, "utf8") },
    { name: "word/document.xml", data: Buffer.from(documentXml, "utf8") },
  ]);
}

interface ParagraphOptions {
  size?: number;
  bold?: boolean;
  color?: string;
  bullet?: boolean;
  spacingBefore?: number;
}

function paragraph(text: string, opts: ParagraphOptions = {}): string {
  const props = [
    `<w:spacing w:after="60"${opts.spacingBefore ? ` w:before="${opts.spacingBefore}"` : ""}/>`,
    opts.bullet
      ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
      : "",
    opts.size ? `<w:sz w:val="${opts.size}"/>` : "",
  ].join("");
  const runProps = [
    opts.bold ? "<w:b/>" : "",
    opts.color ? `<w:color w:val="${opts.color}"/>` : "",
  ].join("");
  return `<w:p><w:pPr>${props}</w:pPr><w:r><w:rPr>${runProps}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Minimal ZIP (deflate) writer. */
function buildZip(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, nameBuf, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuf);

    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}
