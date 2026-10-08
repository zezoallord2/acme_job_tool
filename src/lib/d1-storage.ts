import {
  assertMimeAllowed,
  assertSafeKey,
  assertSizeWithinLimit,
  generateObjectKey,
  safeFileName,
  safeOwnerSegment,
  type PutInput,
  type StorageProvider,
  type StoredObject,
  type StoredObjectScope,
} from "./storage";
import { Errors } from "./errors";

// Structural types keep the local Node build independent of Workers tooling.
export interface D1FileStatement {
  bind(...values: unknown[]): D1FileStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface D1FileDatabase {
  prepare(sql: string): D1FileStatement;
  batch(statements: D1FileStatement[]): Promise<unknown[]>;
}

// Stay comfortably below D1's 2,000,000-byte row/BLOB limit. Keep a complete
// upload in one atomic batch, so a failed write never leaves a readable file.
export const D1_FILE_CHUNK_BYTES = 1_000_000;
const MAX_D1_FILE_BYTES = 5 * 1024 * 1024;
const SCOPES = new Set(["uploads", "exports", "generated", "backups", "logs"]);

function address(scope: StoredObjectScope, key: string, ownerId: string) {
  if (!SCOPES.has(scope)) throw Errors.validation("Invalid storage scope.");
  const owner = safeOwnerSegment(ownerId);
  if (owner !== ownerId) throw Errors.validation("Invalid storage owner.");
  return [scope, owner, assertSafeKey(key)];
}

export class D1StorageProvider implements StorageProvider {
  readonly name = "d1" as const;
  constructor(private readonly database: D1FileDatabase) {}
  isReady() {
    return Boolean(this.database);
  }

  async put(input: PutInput): Promise<StoredObject> {
    assertMimeAllowed(input.mimeType, input.trusted);
    assertSizeWithinLimit(input.buffer.byteLength, input.trusted);
    // Cap generated files too: this free-tier adapter is deliberately bounded.
    if (input.buffer.byteLength > MAX_D1_FILE_BYTES) {
      throw Errors.validation(
        "Cloudflare file storage supports files up to 5 MB.",
      );
    }
    const key = generateObjectKey(input.mimeType);
    const [scope, owner] = address(input.scope, key, input.ownerId);
    const chunks = Math.max(
      1,
      Math.ceil(input.buffer.byteLength / D1_FILE_CHUNK_BYTES),
    );
    const name = safeFileName(input.originalName);
    const statements = [
      this.database
        .prepare(
          'INSERT INTO "CloudFile" (scope,ownerId,key,size,mimeType,originalName,chunkCount,createdAt) VALUES (?,?,?,?,?,?,?,?)',
        )
        .bind(
          scope,
          owner,
          key,
          input.buffer.byteLength,
          input.mimeType,
          name,
          chunks,
          Date.now(),
        ),
    ];
    for (let index = 0; index < chunks; index++) {
      const bytes = Uint8Array.from(
        input.buffer.subarray(
          index * D1_FILE_CHUNK_BYTES,
          (index + 1) * D1_FILE_CHUNK_BYTES,
        ),
      );
      statements.push(
        this.database
          .prepare(
            'INSERT INTO "CloudFileChunk" (scope,ownerId,key,chunkIndex,bytes) VALUES (?,?,?,?,?)',
          )
          .bind(scope, owner, key, index, bytes.buffer),
      );
    }
    await this.database.batch(statements);
    return {
      key,
      path: `d1:${scope}/${owner}/${key}`,
      size: input.buffer.byteLength,
      mimeType: input.mimeType,
      originalName: name,
      ownerId: owner,
      scope: input.scope,
    };
  }

  async get(
    scope: StoredObjectScope,
    key: string,
    ownerId: string,
  ): Promise<Buffer> {
    const params = address(scope, key, ownerId);
    const metadata = await this.database
      .prepare(
        'SELECT size,chunkCount FROM "CloudFile" WHERE scope=? AND ownerId=? AND key=?',
      )
      .bind(...params)
      .first<{ size: number; chunkCount: number }>();
    if (!metadata) throw Errors.notFound("Stored file");
    const { results } = await this.database
      .prepare(
        'SELECT chunkIndex,bytes FROM "CloudFileChunk" WHERE scope=? AND ownerId=? AND key=? ORDER BY chunkIndex',
      )
      .bind(...params)
      .all<{
        chunkIndex: number;
        bytes: ArrayBuffer | number[] | Uint8Array;
      }>();
    if (
      results.length !== metadata.chunkCount ||
      results.some((row, index) => row.chunkIndex !== index)
    ) {
      throw Errors.database("Stored file is incomplete.");
    }
    const bytes = Buffer.concat(
      results.map((row) =>
        Buffer.from(
          row.bytes instanceof ArrayBuffer
            ? new Uint8Array(row.bytes)
            : row.bytes,
        ),
      ),
    );
    if (bytes.byteLength !== metadata.size)
      throw Errors.database("Stored file size does not match.");
    return bytes;
  }

  async delete(
    scope: StoredObjectScope,
    key: string,
    ownerId: string,
  ): Promise<void> {
    await this.database
      .prepare('DELETE FROM "CloudFile" WHERE scope=? AND ownerId=? AND key=?')
      .bind(...address(scope, key, ownerId))
      .run();
  }

  async exists(
    scope: StoredObjectScope,
    key: string,
    ownerId: string,
  ): Promise<boolean> {
    return Boolean(
      await this.database
        .prepare(
          'SELECT key FROM "CloudFile" WHERE scope=? AND ownerId=? AND key=?',
        )
        .bind(...address(scope, key, ownerId))
        .first(),
    );
  }

  async list(scope: StoredObjectScope, ownerId: string): Promise<string[]> {
    const [validatedScope, owner] = address(scope, "list", ownerId);
    const { results } = await this.database
      .prepare(
        'SELECT key FROM "CloudFile" WHERE scope=? AND ownerId=? ORDER BY createdAt,key',
      )
      .bind(validatedScope, owner)
      .all<{ key: string }>();
    return results.map((row) => row.key);
  }
}
