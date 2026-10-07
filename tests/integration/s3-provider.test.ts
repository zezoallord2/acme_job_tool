import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import crypto from "node:crypto";
import { S3CompatibleStorageProvider } from "@/lib/storage";

/**
 * Exercises the S3 provider against a local HTTP server mimicking the slice of
 * the S3 API this project uses, and asserts every request carries a well-formed
 * SigV4 header. No network egress and no S3 account needed.
 */

interface RecordedRequest {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
}

const OWNER = "user-owner-123";

function createFakeS3() {
  const requests: RecordedRequest[] = [];
  const objects = new Map<string, { body: Buffer; type: string }>();

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      requests.push({
        method: req.method ?? "",
        url: req.url ?? "",
        headers: req.headers,
      });

      const key = decodeURIComponent(
        (req.url ?? "").split("?")[0]!.replace(/^\/acme-jobs\//, ""),
      );

      const notFound = () => {
        res.writeHead(404, { "Content-Type": "application/xml" });
        res.end(
          '<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code>' +
            "<Message>The specified key does not exist.</Message></Error>",
        );
      };

      if (req.method === "PUT") {
        objects.set(key, {
          body,
          type: req.headers["content-type"] ?? "application/octet-stream",
        });
        res.writeHead(200, {
          ETag: `"${crypto.createHash("md5").update(body).digest("hex")}"`,
        });
        return res.end();
      }
      if (req.method === "GET") {
        const stored = objects.get(key);
        if (!stored) return notFound();
        res.writeHead(200, {
          "Content-Length": String(stored.body.length),
          "Content-Type": stored.type,
        });
        return res.end(stored.body);
      }
      if (req.method === "HEAD") {
        const stored = objects.get(key);
        if (!stored) return notFound();
        res.writeHead(200, {
          "Content-Length": String(stored.body.length),
          "Content-Type": stored.type,
        });
        return res.end();
      }
      if (req.method === "DELETE") {
        objects.delete(key);
        res.writeHead(204);
        return res.end();
      }
      notFound();
    });
  });

  return {
    requests,
    objects,
    listen: () =>
      new Promise<number>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          resolve(typeof address === "object" && address ? address.port : 0);
        });
      }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe("S3CompatibleStorageProvider against a fake S3", () => {
  let fake: ReturnType<typeof createFakeS3>;
  let provider: S3CompatibleStorageProvider;

  beforeEach(async () => {
    fake = createFakeS3();
    const port = await fake.listen();
    provider = new S3CompatibleStorageProvider({
      endpoint: `http://127.0.0.1:${port}`,
      region: "us-east-1",
      bucket: "acme-jobs",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      // A local gateway only works with path style.
      forcePathStyle: true,
    });
  });

  afterEach(async () => {
    await fake.close();
  });

  it("signs every request with SigV4", async () => {
    const put = await provider.put({
      scope: "uploads",
      ownerId: OWNER,
      buffer: Buffer.from("hello"),
      mimeType: "application/pdf",
      originalName: "resume.pdf",
    });
    await provider.get("uploads", put.key, OWNER);
    await provider.delete("uploads", put.key, OWNER);

    expect(fake.requests.map((r) => r.method)).toEqual([
      "PUT",
      "GET",
      "DELETE",
    ]);
    for (const request of fake.requests) {
      const auth = request.headers.authorization ?? "";
      expect(auth).toMatch(
        /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/\d{8}\/us-east-1\/s3\/aws4_request, SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/,
      );
      expect(request.headers["x-amz-date"]).toMatch(/^\d{8}T\d{6}Z$/);
      expect(request.headers["x-amz-content-sha256"]).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("round-trips an object", async () => {
    const payload = crypto.randomBytes(4096);
    const stored = await provider.put({
      scope: "uploads",
      ownerId: OWNER,
      buffer: payload,
      mimeType: "application/pdf",
      originalName: "resume.pdf",
    });

    const fetched = await provider.get("uploads", stored.key, OWNER);
    expect(Buffer.isBuffer(fetched)).toBe(true);
    expect(Buffer.from(fetched).equals(payload)).toBe(true);
  });

  it("namespaces objects by scope and owner", async () => {
    const stored = await provider.put({
      scope: "uploads",
      ownerId: OWNER,
      buffer: Buffer.from("x"),
      mimeType: "application/pdf",
      originalName: "resume.pdf",
    });

    // `key` is a bare, unguessable handle. The scope and owner live only in the
    // resolved path, so a stored key alone can never be replayed by another user.
    expect(stored.key).toMatch(/^\d{13}-[0-9a-f]{32}\.pdf$/);
    expect(stored.key).not.toContain(OWNER);
    expect(stored.path).toContain(`uploads/${OWNER}/`);

    expect(stored.ownerId).toBe(OWNER);
    expect(stored.scope).toBe("uploads");
    expect(stored.size).toBe(1);
    expect(stored.mimeType).toBe("application/pdf");

    // The wire path is path style against the local gateway.
    expect(
      fake.requests[0]!.url.startsWith(`/acme-jobs/uploads/${OWNER}/`),
    ).toBe(true);
  });

  it("deletes an object and then reports it missing", async () => {
    const stored = await provider.put({
      scope: "uploads",
      ownerId: OWNER,
      buffer: Buffer.from("bye"),
      mimeType: "text/plain",
      originalName: "notes.txt",
    });

    expect(await provider.exists("uploads", stored.key, OWNER)).toBe(true);
    await provider.delete("uploads", stored.key, OWNER);
    expect(await provider.exists("uploads", stored.key, OWNER)).toBe(false);
  });

  it("surfaces a missing key as an error, not empty content", async () => {
    await expect(
      provider.get("uploads", "uploads/never-written.pdf", OWNER),
    ).rejects.toThrow();
  });

  it("rejects a disallowed upload type before touching the network", async () => {
    await expect(
      provider.put({
        scope: "uploads",
        ownerId: OWNER,
        buffer: Buffer.from("<script>"),
        mimeType: "text/html",
        originalName: "evil.html",
      }),
    ).rejects.toThrow();
    expect(fake.requests).toHaveLength(0);
  });

  it("keeps uploads under distinct keys so identical names cannot collide", async () => {
    const a = await provider.put({
      scope: "uploads",
      ownerId: OWNER,
      buffer: Buffer.from("one"),
      mimeType: "application/pdf",
      originalName: "resume.pdf",
    });
    const b = await provider.put({
      scope: "uploads",
      ownerId: OWNER,
      buffer: Buffer.from("two"),
      mimeType: "application/pdf",
      originalName: "resume.pdf",
    });

    expect(a.key).not.toBe(b.key);
    // The original name is metadata, never the path, so it cannot be spoofed.
    expect(a.key).not.toContain("resume");
    expect(a.originalName).toBe("resume.pdf");
  });

  it("isolates one owner's objects from another", async () => {
    const stored = await provider.put({
      scope: "uploads",
      ownerId: OWNER,
      buffer: Buffer.from("private"),
      mimeType: "application/pdf",
      originalName: "resume.pdf",
    });

    // A different owner cannot read it, because the key they would have to guess
    // does not exist under their namespace.
    await expect(
      provider.get("uploads", stored.key, "someone-else-entirely"),
    ).rejects.toThrow();
  });
});
