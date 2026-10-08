import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  D1StorageProvider,
  D1_FILE_CHUNK_BYTES,
  type D1FileDatabase,
  type D1FileStatement,
} from "../../src/lib/d1-storage";

const connections: DatabaseSync[] = [];
function setup(failBatch = false) {
  const sql = new DatabaseSync(":memory:");
  connections.push(sql);
  sql.exec("PRAGMA foreign_keys=ON");
  sql.exec(readFileSync("cloudflare/d1/0002_file_storage.sql", "utf8"));
  const database: D1FileDatabase = {
    prepare(query) {
      let params: Array<string | number | null | Uint8Array> = [];
      const statement: D1FileStatement = {
        bind(...values) {
          params = values.map((value) =>
            value instanceof ArrayBuffer
              ? new Uint8Array(value)
              : (value as string | number | null | Uint8Array),
          );
          return statement;
        },
        async first<T>() {
          return (sql.prepare(query).get(...params) as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: sql.prepare(query).all(...params) as T[] };
        },
        async run() {
          return sql.prepare(query).run(...params);
        },
      };
      return statement;
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try {
        const results: unknown[] = [];
        for (let index = 0; index < statements.length; index++) {
          if (failBatch && index === 1)
            throw new Error("simulated chunk write failure");
          results.push(await statements[index].run());
        }
        sql.exec("COMMIT");
        return results;
      } catch (error) {
        sql.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { sql, provider: new D1StorageProvider(database) };
}

afterEach(() => {
  for (const sql of connections.splice(0)) sql.close();
});
const upload = (buffer: Buffer) => ({
  scope: "uploads" as const,
  ownerId: "owner-a",
  buffer,
  mimeType: "application/pdf",
  originalName: "resume.pdf",
});

describe("D1 file storage", () => {
  it("round-trips binary files across chunk boundaries and enforces ownership", async () => {
    const { sql, provider } = setup();
    const source = Buffer.alloc(D1_FILE_CHUNK_BYTES * 2 + 17, 0xa7);
    source[0] = 0;
    const file = await provider.put(upload(source));
    expect(await provider.get("uploads", file.key, "owner-a")).toEqual(source);
    expect(await provider.exists("uploads", file.key, "owner-b")).toBe(false);
    expect(await provider.list("uploads", "owner-b")).toEqual([]);
    await expect(
      provider.get("uploads", file.key, "owner-b"),
    ).rejects.toThrow();
    await provider.delete("uploads", file.key, "owner-b");
    expect(await provider.exists("uploads", file.key, "owner-a")).toBe(true);
    await provider.delete("uploads", file.key, "owner-a");
    expect(
      sql.prepare('SELECT count(*) AS n FROM "CloudFileChunk"').get()?.n,
    ).toBe(0);
  });

  it("rolls back metadata when a chunk cannot be written", async () => {
    const { sql, provider } = setup(true);
    await expect(provider.put(upload(Buffer.from("resume")))).rejects.toThrow(
      "simulated",
    );
    expect(sql.prepare('SELECT count(*) AS n FROM "CloudFile"').get()?.n).toBe(
      0,
    );
  });

  it("rejects unsafe keys, unsupported MIME types and oversized files", async () => {
    const { provider } = setup();
    await expect(
      provider.get("uploads", "../resume.pdf", "owner-a"),
    ).rejects.toThrow();
    await expect(
      provider.put({ ...upload(Buffer.from("x")), mimeType: "text/html" }),
    ).rejects.toThrow();
    await expect(
      provider.put({
        ...upload(Buffer.alloc(5 * 1024 * 1024 + 1)),
        trusted: true,
      }),
    ).rejects.toThrow("5 MB");
    await expect(
      provider.put({ ...upload(Buffer.from("x")), ownerId: "owner/a" }),
    ).rejects.toThrow();
  });

  it("supports empty files and rejects missing chunks", async () => {
    const { sql, provider } = setup();
    const file = await provider.put(upload(Buffer.alloc(0)));
    expect(await provider.get("uploads", file.key, "owner-a")).toEqual(
      Buffer.alloc(0),
    );
    sql.prepare('DELETE FROM "CloudFileChunk" WHERE key=?').run(file.key);
    await expect(provider.get("uploads", file.key, "owner-a")).rejects.toThrow(
      "incomplete",
    );
  });
});
