/**
 * Minimal, dependency-free PDF writer.
 *
 * Uses only the PDF standard-14 fonts, so nothing needs embedding and no
 * document service (Adobe, CloudConvert, Google, Microsoft) is involved. This
 * keeps exports free and offline.
 */
export interface PdfSection {
  heading: string;
  lines: string[];
}

export interface PdfSpec {
  title: string;
  subtitle?: string;
  contact?: string[];
  sections: PdfSection[];
  footer?: string;
}

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;

const COLORS = {
  navy: [0.043, 0.176, 0.302] as const,
  teal: [0.067, 0.557, 0.58] as const,
  ink: [0.125, 0.188, 0.251] as const,
  muted: [0.38, 0.447, 0.541] as const,
  line: [0.851, 0.902, 0.91] as const,
};

interface Layout {
  ops: string[];
  y: number;
}

export function buildPdf(spec: PdfSpec): Buffer {
  const pages: string[] = [];
  let layout: Layout = { ops: [], y: PAGE_HEIGHT - MARGIN };

  const newPage = (): void => {
    if (layout.ops.length > 0) pages.push(layout.ops.join("\n"));
    layout = { ops: [], y: PAGE_HEIGHT - MARGIN };
  };

  const ensureRoom = (needed: number): void => {
    if (layout.y - needed < MARGIN + 24) newPage();
  };

  const text = (
    value: string,
    opts: {
      size: number;
      color: readonly number[];
      x?: number;
      bold?: boolean;
    },
  ): void => {
    ensureRoom(opts.size + 4);
    const x = opts.x ?? MARGIN;
    const font = opts.bold ? "/F2" : "/F1";
    layout.ops.push(
      `BT ${font} ${opts.size} Tf ${opts.color[0]} ${opts.color[1]} ${opts.color[2]} rg 1 0 0 1 ${x.toFixed(2)} ${layout.y.toFixed(2)} Tm (${escapePdfText(value)}) Tj ET`,
    );
    layout.y -= opts.size + 4;
  };

  const rule = (): void => {
    ensureRoom(8);
    layout.ops.push(
      `${COLORS.line[0]} ${COLORS.line[1]} ${COLORS.line[2]} RG 0.8 w ${MARGIN} ${layout.y.toFixed(2)} m ${(PAGE_WIDTH - MARGIN).toFixed(2)} ${layout.y.toFixed(2)} l S`,
    );
    layout.y -= 14;
  };

  // Header
  text(spec.title, { size: 19, color: COLORS.navy, bold: true });
  if (spec.subtitle) text(spec.subtitle, { size: 9.5, color: COLORS.teal });
  for (const line of spec.contact ?? [])
    text(line, { size: 8.5, color: COLORS.muted });
  layout.y -= 6;
  rule();

  // Sections
  for (const section of spec.sections) {
    layout.y -= 10;
    text(section.heading.toUpperCase(), {
      size: 11,
      color: COLORS.navy,
      bold: true,
    });
    for (const line of section.lines) {
      if (line === "") {
        layout.y -= 6;
        continue;
      }
      const wrapped = wrapText(
        line,
        Math.floor((PAGE_WIDTH - MARGIN * 2) / 4.8),
      );
      const bullet = line.startsWith("• ");
      for (const part of wrapped) {
        text(part, {
          size: 9,
          color: COLORS.ink,
          x: bullet ? MARGIN + 10 : MARGIN,
        });
      }
    }
  }

  newPage();

  const footer = spec.footer;
  const pageCount = pages.length;

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const fontRegularId = 3;
  const fontBoldId = 4;
  let nextId = 5;

  const addObject = (body: string): number => {
    objects[nextId] = body;
    return nextId++;
  };

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [PLACEHOLDER] /Count 0 >>";
  objects[fontRegularId] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[fontBoldId] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  for (let i = 0; i < pageCount; i++) {
    const contentId = nextId;
    const pageId = nextId + 1;
    const stream = [
      pages[i]!,
      footer
        ? `BT /F1 7.5 Tf ${COLORS.muted[0]} ${COLORS.muted[1]} ${COLORS.muted[2]} rg 1 0 0 1 ${MARGIN} 28 Tm (${escapePdfText(footer)}) Tj ET`
        : "",
      "",
    ].join("\n");

    addObject(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    );
    addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageObjectIds.push(pageId);
  }

  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  const chunks: Buffer[] = [];
  chunks.push(Buffer.from("%PDF-1.4\n", "latin1"));
  const offsets: number[] = [];
  let position = chunks[0]!.length;

  for (let id = 1; id < nextId; id++) {
    const body = objects[id];
    if (body === undefined) continue;
    const header = `${id} 0 obj\n`;
    const footerStr = `\nendobj\n`;
    const buf = Buffer.from(header + body + footerStr, "latin1");
    offsets[id] = position;
    chunks.push(buf);
    position += buf.length;
  }

  const maxId = nextId - 1;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    xref += `${(offsets[id] ?? 0).toString().padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${position}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "latin1"));

  return Buffer.concat(chunks);
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?")
    .slice(0, 250);
}

/** Word wrap tuned for the standard-14 font metrics. */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0]!;
  for (const word of words.slice(1)) {
    if ((current + " " + word).length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current += ` ${word}`;
    }
  }
  lines.push(current);
  return lines;
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export function pdfResponse(filename: string, buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export function jsonResponse(body: unknown, filename?: string): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(filename
        ? { "content-disposition": `attachment; filename="${filename}"` }
        : {}),
      "cache-control": "no-store",
    },
  });
}
