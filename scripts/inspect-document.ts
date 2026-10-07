import { readFileSync } from "node:fs";
import {
  extractDocxText,
  extractPdfText,
  extractText,
} from "../src/worker/handlers/document-parse";

/**
 * Runs a real document through the application's own parser so extraction can be
 * checked against a genuine CV rather than a synthetic fixture.
 *
 * Usage: npx tsx scripts/inspect-document.ts <path>
 */
async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: tsx scripts/inspect-document.ts <path>");
    process.exit(1);
  }

  const buffer = readFileSync(path);
  const lower = path.toLowerCase();
  const mime = lower.endsWith(".pdf")
    ? "application/pdf"
    : lower.endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "text/plain";

  let text: string;
  try {
    // `extractText` is the production entry point the upload worker calls.
    text = await extractText(buffer, mime, path.split(/[\\/]/).pop() ?? path);
  } catch (error) {
    text = "";
    console.log(
      `parser failed: ${error instanceof Error ? error.message : error}`,
    );
  }

  const words = text.split(/\s+/).filter(Boolean);
  console.log(`file: ${path}`);
  console.log(`bytes: ${buffer.length}`);
  console.log(`chars: ${text.length}`);
  console.log(`words: ${words.length}`);
  console.log("--- extracted text ---");
  console.log(text.slice(0, 4000));

  // Keep a direct reference so both exported helpers stay exercised.
  void extractDocxText;
  void extractPdfText;
}

void main();
