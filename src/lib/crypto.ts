import {
  randomBytes,
  randomUUID,
  createHash,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import { env } from "./env";

/** Public identifier, safe to show in logs and support tickets. */
export function newTraceId(): string {
  return `tr_${randomBytes(9).toString("hex")}`;
}

export function newRequestId(): string {
  return `req_${randomUUID()}`;
}

export function newIdempotencyKey(prefix = "idem"): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

/** Deterministic content hash used for snapshot immutability and dedupe. */
export function hashContent(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function shortHash(value: string, length = 12): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): string => {
    if (v === null) return "null";
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
    if (typeof v === "boolean" || typeof v === "string")
      return JSON.stringify(v);
    if (typeof v === "bigint") return JSON.stringify(v.toString());
    if (typeof v === "undefined" || typeof v === "function") return "null";
    if (v instanceof Date) return JSON.stringify(v.toISOString());
    if (Array.isArray(v)) return `[${v.map(walk).join(",")}]`;
    if (typeof v === "object") {
      const obj = v as Record<string, unknown>;
      if (seen.has(obj)) return '"[circular]"';
      seen.add(obj);
      const keys = Object.keys(obj).sort();
      const out = keys
        .filter((k) => obj[k] !== undefined)
        .map((k) => `${JSON.stringify(k)}:${walk(obj[k])}`)
        .join(",");
      seen.delete(obj);
      return `{${out}}`;
    }
    return "null";
  };
  return walk(value);
}

const KEY_SALT = "acme-jobs:v1";

export function encryptSecret(plaintext: string): Buffer {
  const secret = env().KEY_ENCRYPTION_SECRET ?? env().AUTH_SECRET;
  const key = createHash("sha256").update(`${KEY_SALT}:${secret}`).digest();
  const iv = randomBytes(12);
  // AES-256-GCM via node:crypto, kept dependency-free.
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

export function decryptSecret(payload: Uint8Array): string {
  const secret = env().KEY_ENCRYPTION_SECRET ?? env().AUTH_SECRET;
  const key = createHash("sha256").update(`${KEY_SALT}:${secret}`).digest();
  const buf = Buffer.from(payload);
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

/** Last 4 characters only, so a key is recognisable but never exposed. */
export function keyHint(plaintext: string): string {
  return `...${plaintext.slice(-4)}`;
}

export function safeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
