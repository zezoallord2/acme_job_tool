import { createReadStream } from "node:fs";
import {
  mkdir,
  writeFile,
  readFile,
  unlink,
  stat,
  readdir,
  rm,
} from "node:fs/promises";
import {
  join,
  resolve,
  extname,
  basename,
  relative,
  isAbsolute,
} from "node:path";
import { randomBytes } from "node:crypto";
import { env, localStoragePath, storageDriver } from "./env";
import { Errors } from "./errors";
import { logWarn, logInfo } from "./logger";
import {
  objectUrl,
  shouldForcePathStyle,
  signRequest,
  type S3EndpointConfig,
} from "./s3-sigv4";

/**
 * Storage abstraction.
 *
 * Two drivers behind one interface:
 *   - local: a confined directory on disk. Default, and correct for development
 *     and for self-hosted servers with a persistent volume. Free.
 *   - s3:    any S3-compatible object store. For ephemeral/serverless hosts
 *            where the filesystem does not survive a redeploy.
 *
 * Safety rules that hold for BOTH drivers, because a storage layer that is only
 * careful in local mode is not careful:
 *
 *   1. A user-supplied filename is never used as a path or an object key. Every
 *      object gets a generated name.
 *   2. MIME type is validated against an allowlist.
 *   3. Size is capped.
 *   4. Keys are validated for traversal before any read or delete.
 *   5. Reads and deletes take an ownerId and refuse cross-owner access.
 */
export interface StoredObject {
  key: string;
  /** Absolute path (local) or public URL (s3). Diagnostics only, never rendered to users. */
  path: string;
  size: number;
  mimeType: string;
  /** Sanitised original name, for display only. */
  originalName: string;
  /** The owner, so a later read can be authorised. */
  ownerId: string;
  scope: StoredObjectScope;
}

export type StoredObjectScope =
  "uploads" | "exports" | "generated" | "backups" | "logs";

export interface PutInput {
  scope: StoredObjectScope;
  ownerId: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  /**
   * Skip the MIME allowlist for internally generated artefacts (PDF exports,
   * logs). External user uploads must always be validated.
   */
  trusted?: boolean;
}

export interface StorageProvider {
  readonly name: "local" | "s3" | "d1";
  /** True when the driver is selected AND configured well enough to be used. */
  isReady(): boolean;
  put(input: PutInput): Promise<StoredObject>;
  /**
   * Reads an object. `ownerId` is required: omitting it would mean scanning
   * every owner's directory, which is how one user reads another's upload.
   */
  get(scope: StoredObjectScope, key: string, ownerId: string): Promise<Buffer>;
  delete(scope: StoredObjectScope, key: string, ownerId: string): Promise<void>;
  exists(
    scope: StoredObjectScope,
    key: string,
    ownerId: string,
  ): Promise<boolean>;
  list(scope: StoredObjectScope, ownerId: string): Promise<string[]>;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "text/csv": ".csv",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export const ALLOWED_UPLOAD_MIME = new Set(Object.keys(MIME_EXTENSIONS));

/** MIME types the app generates internally and may therefore write. */
const TRUSTED_MIME = new Set([
  "application/pdf",
  "text/csv",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function dataRoot(): string {
  return resolve(process.cwd(), localStoragePath());
}

function scopeDir(scope: StoredObjectScope): string {
  return join(dataRoot(), scope);
}

/**
 * Owner segment used in both the local path and the S3 key. Sanitised because it
 * becomes a path component: a userId is normally a cuid, but a key that reaches
 * here from a queue payload must not be trusted to look like one.
 */
export function safeOwnerSegment(ownerId: string): string {
  const clean = String(ownerId ?? "")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 64);
  if (!clean) throw Errors.validation("Invalid storage owner.");
  return clean;
}

/**
 * Validates an object key. Keys are generated internally, so anything with a
 * separator, a traversal segment or a dotfile is rejected rather than cleaned.
 * Cleaning is the wrong tool here: `../../etc/passwd` and `safe` should not both
 * become something that works.
 */
export function assertSafeKey(key: string): string {
  const value = String(key ?? "");
  if (
    !value ||
    value.length > 200 ||
    value.includes("\\") ||
    value.includes("..") ||
    value.startsWith("/") ||
    value.includes("//") ||
    /[A-Za-z]:/.test(value) ||
    value.split("/").some((segment) => !segment || segment.startsWith("."))
  ) {
    throw Errors.validation("Invalid storage key.");
  }
  return value;
}

/**
 * The object name. Generated from time and 16 random bytes, never from the
 * user's filename: two uploads of "resume.pdf" must not collide, and the name
 * must not be attacker-influenced.
 */
export function generateObjectKey(mimeType: string): string {
  const ext = MIME_EXTENSIONS[mimeType] ?? "";
  return `${Date.now()}-${randomBytes(16).toString("hex")}${ext}`;
}

/** Display-safe form of a user-supplied name. Never used as a path. */
export function safeFileName(originalName: string): string {
  const ext = extname(String(originalName ?? "")).toLowerCase();
  const base = basename(String(originalName ?? ""), ext)
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${base || "file"}${ext}`;
}

export function assertMimeAllowed(mimeType: string, trusted = false): void {
  if (trusted) {
    if (!TRUSTED_MIME.has(mimeType)) {
      throw Errors.validation(
        `Refusing to write unsupported type: ${mimeType}.`,
      );
    }
    return;
  }
  if (!ALLOWED_UPLOAD_MIME.has(mimeType)) {
    throw Errors.validation(`Unsupported file type: ${mimeType}.`, {
      allowed: [...ALLOWED_UPLOAD_MIME],
    });
  }
}

export function assertSizeWithinLimit(
  byteLength: number,
  trusted = false,
): void {
  const max = env().MAX_UPLOAD_BYTES;
  if (!trusted && byteLength > max) {
    throw Errors.validation(
      `File is larger than the ${Math.floor(max / 1024 / 1024)} MB limit.`,
      { sizeBytes: byteLength, limit: max },
    );
  }
  // Even internally generated artefacts get a ceiling, so a runaway export
  // cannot fill the disk.
  if (byteLength > max * 20) {
    throw Errors.validation("Generated artefact exceeded the size ceiling.", {
      sizeBytes: byteLength,
    });
  }
}

/**
 * True when `target` is inside `root`. Case-insensitive on Windows, and rejects
 * both traversal (`..`) and sibling-prefix tricks (`/data-evil` vs `/data`).
 */
export function isConfined(target: string, root: string): boolean {
  const resolvedRoot = resolve(root);
  const relativePath = relative(resolvedRoot, resolve(target));
  if (relativePath === "") return true;
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Local driver
// ---------------------------------------------------------------------------

export class LocalFileStorageProvider implements StorageProvider {
  readonly name = "local" as const;

  isReady(): boolean {
    return true;
  }

  async put(input: PutInput): Promise<StoredObject> {
    assertMimeAllowed(input.mimeType, input.trusted === true);
    assertSizeWithinLimit(input.buffer.byteLength, input.trusted === true);

    const owner = safeOwnerSegment(input.ownerId);
    const dir = join(scopeDir(input.scope), owner);
    await mkdir(dir, { recursive: true });

    const key = generateObjectKey(input.mimeType);
    const target = resolve(dir, key);

    // Defence in depth: never write outside the owner directory. `relative` is
    // used because a naive `startsWith` check is wrong on Windows and can be
    // fooled by sibling directories sharing a prefix.
    if (!isConfined(target, dir)) {
      throw Errors.validation("Invalid storage path.");
    }

    await writeFile(target, input.buffer, { mode: 0o600 });
    return {
      key,
      path: target,
      size: input.buffer.byteLength,
      mimeType: input.mimeType,
      originalName: safeFileName(input.originalName),
      ownerId: owner,
      scope: input.scope,
    };
  }

  async get(
    scope: StoredObjectScope,
    key: string,
    ownerId: string,
  ): Promise<Buffer> {
    const target = this.resolveOwned(scope, key, ownerId);
    return readFile(target);
  }

  async delete(
    scope: StoredObjectScope,
    key: string,
    ownerId: string,
  ): Promise<void> {
    const target = this.resolveOwned(scope, key, ownerId);
    await unlink(target).catch(() => undefined);
  }

  async exists(
    scope: StoredObjectScope,
    key: string,
    ownerId: string,
  ): Promise<boolean> {
    let target: string;
    try {
      target = this.resolveOwned(scope, key, ownerId);
    } catch {
      return false;
    }
    // Must actually stat the file. Returning true because a path was merely
    // well-formed would make `exists` lie about objects that are not there.
    try {
      const s = await stat(target);
      return s.isFile();
    } catch {
      return false;
    }
  }

  async list(scope: StoredObjectScope, ownerId: string): Promise<string[]> {
    let dir: string;
    try {
      dir = join(scopeDir(scope), safeOwnerSegment(ownerId));
    } catch {
      return [];
    }
    try {
      return (
        (await readdir(dir))
          .map((f) => basename(f))
          // Never hand out a name that would fail validation on the way back in.
          .filter((f) => {
            try {
              assertSafeKey(f);
              return true;
            } catch {
              return false;
            }
          })
      );
    } catch {
      return [];
    }
  }

  /**
   * Resolves a key to exactly one path, inside the caller's own directory.
   *
   * The previous implementation scanned every owner's directory for a matching
   * key, which meant any user who learned another user's key could read their
   * file. Ownership is now structural rather than incidental: the path is built
   * from the authenticated owner, so another user's directory is never consulted.
   */
  private resolveOwned(
    scope: StoredObjectScope,
    key: string,
    ownerId: string,
  ): string {
    const safeKey = assertSafeKey(key);
    const owner = safeOwnerSegment(ownerId);
    const dir = join(scopeDir(scope), owner);
    const target = resolve(dir, safeKey);
    if (!isConfined(target, dir)) {
      throw Errors.validation("Invalid storage path.");
    }
    return target;
  }
}

// ---------------------------------------------------------------------------
// S3 driver
// ---------------------------------------------------------------------------

export interface S3ProviderOptions {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicBaseUrl?: string;
}

export class S3CompatibleStorageProvider implements StorageProvider {
  readonly name = "s3" as const;
  private readonly config: S3EndpointConfig;
  private readonly publicBaseUrl: string | undefined;

  constructor(private readonly options: S3ProviderOptions) {
    this.config = {
      endpoint: options.endpoint,
      region: options.region,
      bucket: options.bucket,
      forcePathStyle: options.forcePathStyle,
    };
    this.publicBaseUrl = options.publicBaseUrl;
  }

  isReady(): boolean {
    return Boolean(
      this.options.endpoint &&
      this.options.bucket &&
      this.options.accessKeyId &&
      this.options.secretAccessKey,
    );
  }

  /** Builds the provider from configuration, or throws if it is incomplete. */
  static fromEnv(): S3CompatibleStorageProvider {
    const e = env();
    const endpoint = e.S3_ENDPOINT;
    const bucket = e.S3_BUCKET;
    const accessKeyId = e.S3_ACCESS_KEY_ID;
    const secretAccessKey = e.S3_SECRET_ACCESS_KEY;

    const missing: string[] = [];
    if (!endpoint) missing.push("S3_ENDPOINT");
    if (!bucket) missing.push("S3_BUCKET");
    if (!accessKeyId) missing.push("S3_ACCESS_KEY_ID");
    if (!secretAccessKey) missing.push("S3_SECRET_ACCESS_KEY");
    if (missing.length > 0) {
      throw Errors.configuration(
        `S3 storage is selected but incomplete. Missing: ${missing.join(", ")}.`,
        { missing },
      );
    }

    // Narrowed by the check above; asserted once so the types are honest without
    // scattering `!` through the object literal.
    const cfg = {
      endpoint: endpoint as string,
      bucket: bucket as string,
      accessKeyId: accessKeyId as string,
      secretAccessKey: secretAccessKey as string,
    };

    const provider = new S3CompatibleStorageProvider({
      endpoint: cfg.endpoint,
      region: e.S3_REGION || "us-east-1",
      bucket: cfg.bucket,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      forcePathStyle:
        e.S3_FORCE_PATH_STYLE ?? shouldForcePathStyle(cfg.endpoint),
      publicBaseUrl: e.S3_PUBLIC_BASE_URL,
    });
    if (!provider.isReady()) {
      throw Errors.configuration("S3 storage is selected but not ready.");
    }
    return provider;
  }

  private credentials() {
    return {
      accessKeyId: this.options.accessKeyId,
      secretAccessKey: this.options.secretAccessKey,
    };
  }

  private objectKey(scope: StoredObjectScope, ownerId: string, key: string) {
    return `${scope}/${safeOwnerSegment(ownerId)}/${assertSafeKey(key)}`;
  }

  async put(input: PutInput): Promise<StoredObject> {
    assertMimeAllowed(input.mimeType, input.trusted === true);
    assertSizeWithinLimit(input.buffer.byteLength, input.trusted === true);

    const owner = safeOwnerSegment(input.ownerId);
    const key = generateObjectKey(input.mimeType);
    const objectKey = this.objectKey(input.scope, owner, key);

    const signed = signRequest({
      method: "PUT",
      config: this.config,
      credentials: this.credentials(),
      key: objectKey,
      body: input.buffer,
      contentType: input.mimeType,
    });

    const response = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
      // Uint8Array rather than Buffer so the BodyInit overload resolves
      // unambiguously across TypeScript versions.
      body: new Uint8Array(input.buffer),
    });

    if (!response.ok) {
      // The body can echo the key or the bucket, both of which are already known
      // to the operator, so a short form is safe and enough to diagnose with.
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      logWarn({ operation: "storage.s3.put" }, "S3 upload failed", {
        status: response.status,
        key: objectKey,
      });
      throw Errors.external(
        `Object storage rejected the upload (${response.status}).`,
        {
          status: response.status,
          detail,
        },
      );
    }

    return {
      key,
      path: this.publicBaseUrl
        ? `${this.publicBaseUrl.replace(/\/+$/, "")}/${objectKey}`
        : objectUrl(this.config, objectKey),
      size: input.buffer.byteLength,
      mimeType: input.mimeType,
      originalName: safeFileName(input.originalName),
      ownerId: owner,
      scope: input.scope,
    };
  }

  async get(
    scope: StoredObjectScope,
    key: string,
    ownerId: string,
  ): Promise<Buffer> {
    const objectKey = this.objectKey(scope, ownerId, key);
    const signed = signRequest({
      method: "GET",
      config: this.config,
      credentials: this.credentials(),
      key: objectKey,
    });

    const response = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
    });

    if (response.status === 404) {
      // Same error whether the object is missing or owned by someone else.
      throw Errors.notFound("Stored file");
    }
    if (!response.ok) {
      logWarn({ operation: "storage.s3.get" }, "S3 read failed", {
        status: response.status,
        key: objectKey,
      });
      throw Errors.external(`Object storage read failed (${response.status}).`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(
    scope: StoredObjectScope,
    key: string,
    ownerId: string,
  ): Promise<void> {
    const objectKey = this.objectKey(scope, ownerId, key);
    const signed = signRequest({
      method: "DELETE",
      config: this.config,
      credentials: this.credentials(),
      key: objectKey,
    });
    const response = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
    });
    // A missing object is not an error for a delete: the goal state is reached
    // either way, and idempotent deletion avoids spurious failures.
    if (!response.ok && response.status !== 404) {
      logWarn({ operation: "storage.s3.delete" }, "S3 delete failed", {
        status: response.status,
        key: objectKey,
      });
      throw Errors.external(
        `Object storage delete failed (${response.status}).`,
      );
    }
  }

  async exists(
    scope: StoredObjectScope,
    key: string,
    ownerId: string,
  ): Promise<boolean> {
    const objectKey = this.objectKey(scope, ownerId, key);
    const signed = signRequest({
      method: "HEAD",
      config: this.config,
      credentials: this.credentials(),
      key: objectKey,
    });
    const response = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
    });
    return response.ok;
  }

  async list(scope: StoredObjectScope, ownerId: string): Promise<string[]> {
    const owner = safeOwnerSegment(ownerId);
    const prefix = `${scope}/${owner}/`;
    const signed = signRequest({
      method: "GET",
      config: this.config,
      credentials: this.credentials(),
      query: { "list-type": "2", prefix, "max-keys": 1000 },
    });
    const response = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
    });
    if (!response.ok) return [];

    const xml = await response.text();
    // Keys look like <Key>...</Key>. Deliberately not parsed with a full XML
    // library: one field, and a regex cannot execute anything.
    return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)]
      .map((m) => decodeXmlEntities(m[1] ?? ""))
      .map((full) => full.slice(prefix.length))
      .filter((key) => {
        try {
          assertSafeKey(key);
          return true;
        } catch {
          return false;
        }
      });
  }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

let storage: StorageProvider | null = null;

export function storageProvider(): StorageProvider {
  if (storage) return storage;

  const driver = storageDriver();
  if (driver === "s3") {
    storage = S3CompatibleStorageProvider.fromEnv();
    logInfo({ operation: "storage.init" }, "Using S3-compatible storage");
    return storage;
  }

  storage = new LocalFileStorageProvider();
  return storage;
}

/** Drops the cached provider. Tests and the preflight use this after env changes. */
export function resetStorageProvider(): void {
  storage = null;
}

export async function ensureDataDirs(): Promise<void> {
  // Only meaningful for the local driver; S3 has no directories to create.
  if (storageDriver() === "s3") return;
  for (const scope of [
    "uploads",
    "exports",
    "generated",
    "backups",
    "logs",
  ] as const) {
    await mkdir(scopeDir(scope), { recursive: true });
  }
}

/** Retention cleanup for generated/exported artefacts. Local driver only. */
export async function purgeOldArtefacts(maxAgeDays = 30): Promise<number> {
  if (storageDriver() === "s3") {
    logWarn(
      { operation: "storage.purge" },
      "Retention purge is a local-filesystem operation; not applied to S3.",
    );
    return 0;
  }

  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  let removed = 0;
  for (const scope of ["exports", "generated"] as const) {
    const root = scopeDir(scope);
    let owners: string[];
    try {
      owners = (await readdir(root, { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      continue;
    }
    for (const owner of owners) {
      const dir = join(root, owner);
      const files = await readdir(dir).catch(() => [] as string[]);
      for (const f of files) {
        const p = join(dir, f);
        const s = await stat(p).catch(() => null);
        if (s && s.mtimeMs < cutoff) {
          await rm(p, { force: true });
          removed++;
        }
      }
    }
  }
  return removed;
}

export { createReadStream };
