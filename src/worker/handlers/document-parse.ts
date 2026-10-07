/**
 * Local text extraction for PDF, DOCX and TXT uploads.
 *
 * Zero-cost rule: no OCR service and no paid document API. A scanned PDF with no
 * embedded text layer cannot be read here — the handler says so explicitly so
 * the user pastes the text instead, rather than silently producing nothing.
 *
 * DOCX is a ZIP of XML: we read `word/document.xml` and strip tags. No zip
 * library is required because `docx` is already a dependency and Node ships
 * zlib; we use a minimal central-directory reader to avoid another dependency.
 */
import { inflateRawSync } from "node:zlib";
import { storageProvider } from "@/lib/storage";
import { Errors } from "@/lib/errors";
import type { ClaimedJob } from "@/queue/queue";

export async function extractText(
  buffer: Buffer,
  mime: string,
  fileName: string,
): Promise<string> {
  if (
    mime === "text/plain" ||
    mime === "text/markdown" ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md")
  ) {
    return buffer.toString("utf8");
  }
  if (fileName.endsWith(".docx")) return extractDocxText(buffer);
  if (fileName.endsWith(".pdf")) return extractPdfText(buffer);
  throw Errors.validation(`Unsupported file type: ${mime}.`, {
    mime,
    fileName,
  });
}

/** Minimal ZIP entry reader: locates the central directory and inflates entries. */
function readZipEntry(buffer: Buffer, targetName: string): Buffer | null {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 66_000);
    i--
  ) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return null;
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) return null;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (name === targetName) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      return null;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

export function extractDocxText(buffer: Buffer): string {
  const xml = readZipEntry(buffer, "word/document.xml");
  if (!xml) throw Errors.validation("That DOCX file could not be read.");
  return decodeXmlEntities(
    xml
      .toString("utf8")
      // Paragraph, cell and break boundaries become whitespace.
      //
      // These must replace only the *tags*. Matching a whole `<w:p ...>...</w:p>`
      // block and replacing it with a newline looks equivalent but silently
      // deletes every word inside the paragraph, which is what real Word and
      // Google Docs output always uses.
      .replace(/<w:p\b[^>]*>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\b[^>]*\/?>/g, "\t")
      .replace(/<w:br\b[^>]*\/?>/g, "\n")
      .replace(/<\/w:tc>/g, "\t")
      .replace(/<\/w:tr>/g, "\n")
      // Everything else is markup, not content.
      .replace(/<[^>]+>/g, ""),
  );
}

export function extractPdfText(buffer: Buffer): string {
  // Content streams may be Flate-compressed; try each and keep what decodes.
  const chunks: string[] = [];
  const text = buffer.toString("latin1");

  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = streamPattern.exec(text)) !== null) {
    const raw = m[1] ?? "";
    let content = raw;
    const flateStart = text.indexOf("stream", m.index) + 6;
    void flateStart;
    try {
      const inflated = inflateRawSync(Buffer.from(raw, "latin1"));
      content = inflated.toString("latin1");
    } catch {
      content = raw;
    }
    if (!/\bTj|\bTJ/.test(content)) continue;
    const strings = [...content.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g)].map(
      (x) => x[1] ?? "",
    );
    const arrays = [...content.matchAll(/\[([\s\S]*?)\]\s*TJ/g)].flatMap((x) =>
      [...(x[1] ?? "").matchAll(/\(((?:[^()\\]|\\.)*)\)/g)].map(
        (y) => y[1] ?? "",
      ),
    );
    const joined = [...strings, ...arrays].join(" ");
    if (joined.trim()) chunks.push(decodePdfEscapes(joined));
  }

  const result = chunks
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!result) {
    throw Errors.validation(
      "No embedded text was found in that PDF. It is probably a scan. Paste the job description as text instead — Acme Jobs does not use a paid OCR service.",
      { reason: "no_text_layer" },
    );
  }
  return result;
}

function decodePdfEscapes(s: string): string {
  return s
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ");
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parseDocumentText(
  job: ClaimedJob,
): Promise<{ extractedChars: number }> {
  const { key, ownerId, mime, originalName } = job.payload as {
    key: string;
    ownerId: string;
    mime: string;
    originalName: string;
  };
  const provider = storageProvider();
  // Owner-scoped: the worker may only touch the uploading user's own objects.
  const buffer = await provider.get("uploads", key, ownerId);
  const text = await extractText(buffer, mime, originalName);
  if (text.trim().length < 40) {
    throw Errors.validation(
      "That file did not contain enough text to analyse.",
    );
  }

  const { createJob } = await import("@/services/job-service");
  await createJob(ownerId, {
    description: text,
    title: (job.payload as { title?: string }).title,
    company: (job.payload as { company?: string }).company,
    inputSource:
      mime === "application/pdf"
        ? "UPLOAD_PDF"
        : mime.includes("wordprocessing")
          ? "UPLOAD_DOCX"
          : "UPLOAD_TXT",
  });

  await provider.delete("uploads", key, ownerId);
  return { extractedChars: text.length };
}
