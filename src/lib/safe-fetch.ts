import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Errors } from "@/lib/errors";

/**
 * Fetches a user-supplied public web page as plain text.
 *
 * The URL comes from a user, so this is an SSRF boundary: only http(s), no
 * credentials in the URL, and every hop (including redirects) must resolve to a
 * public address. Loopback, private, link-local and metadata ranges are refused.
 */

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateV6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fc") || v.startsWith("fd")) return true;
  if (
    v.startsWith("fe8") ||
    v.startsWith("fe9") ||
    v.startsWith("fea") ||
    v.startsWith("feb")
  )
    return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateV4(mapped[1]!) : false;
}

export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return !isPrivateV4(ip);
  if (family === 6) return !isPrivateV6(ip);
  return false;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw Errors.validation("That link is not a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw Errors.validation("Only http and https links are supported.");
  }
  if (url.username || url.password) {
    throw Errors.validation("Links with embedded credentials are not allowed.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) {
    throw Errors.validation("That link's website could not be found.");
  }
  if (!addresses.every(isPublicAddress)) {
    throw Errors.validation("That link points to a private network address.");
  }
  return url;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export async function fetchPublicPageText(
  raw: string,
): Promise<{ url: string; title: string; text: string }> {
  let current = await assertPublicUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          accept: "text/html,application/xhtml+xml,text/plain",
          "user-agent":
            "Mozilla/5.0 (compatible; AcmeJobs/1.0; job page reader)",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        if (!next) break;
        current = await assertPublicUrl(new URL(next, current).toString());
        continue;
      }
      if (!res.ok) {
        throw Errors.validation(
          `The job site answered HTTP ${res.status}. Many sites (LinkedIn, Indeed) block automated reading — paste the job text instead.`,
        );
      }
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) {
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }
      const html = Buffer.concat(chunks).toString("utf8");
      const title = htmlToText(
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
      ).slice(0, 200);
      return { url: current.toString(), title, text: htmlToText(html) };
    }
    throw Errors.validation("That link redirected too many times.");
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw Errors.validation(
        "The job page took too long to load. Paste the job text instead.",
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
