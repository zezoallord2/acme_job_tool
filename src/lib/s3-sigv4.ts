import { createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Minimal AWS Signature Version 4 signer over `fetch`.
 *
 * Deliberately dependency-free and vendor-neutral: the same code signs requests
 * for AWS S3, Cloudflare R2, MinIO, Backblaze B2 and most S3-compatible
 * gateways, because they all implement the same SigV4 specification. Adding a
 * 10 MB AWS SDK to support one adapter would also have tied the domain to one
 * vendor's shape.
 *
 * Only the operations Acme Jobs needs are implemented: PUT, GET, HEAD, DELETE
 * and LIST. No chunked multipart upload, no presigned POST policy, no ACLs.
 */

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional, for providers that support a session token (temporary keys). */
  sessionToken?: string;
}

export interface S3EndpointConfig {
  /** Base endpoint, e.g. `https://s3.eu-west-2.amazonaws.com` or `https://<id>.r2.cloudflarestorage.com`. */
  endpoint: string;
  region: string;
  bucket: string;
  forcePathStyle: boolean;
}

type AwsService = "s3";

function sha256Hex(payload: string | Buffer): string {
  return createHash("sha256").update(payload).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/** RFC 3986 encoding, which is stricter than encodeURIComponent for `!*'()`. */
function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Canonical URI. Each path segment is encoded, but `/` separators are kept. */
function canonicalUri(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => uriEncode(segment))
    .join("/");
}

/**
 * Canonical query string: keys sorted, each encoded. Repeated keys are sorted by
 * value, which is what the specification requires.
 */
function canonicalQueryString(
  params: Record<string, string | number | undefined>,
): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [uriEncode(k), uriEncode(String(v))] as const)
    .sort((a, b) =>
      a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1,
    )
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

function amzDate(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

/**
 * Builds the object URL. Virtual-hosted style is the default because AWS and R2
 * expect it; path style is required by MinIO and most gateways.
 */
export function objectUrl(config: S3EndpointConfig, key: string): string {
  const endpoint = config.endpoint.replace(/\/+$/, "");
  if (config.forcePathStyle) {
    return `${endpoint}/${config.bucket}/${key
      .split("/")
      .map(uriEncode)
      .join("/")}`;
  }
  const url = new URL(endpoint);
  url.hostname = `${config.bucket}.${url.hostname}`;
  return `${url.origin}/${key.split("/").map(uriEncode).join("/")}`;
}

/** Bucket-level URL, used for LIST. */
export function bucketUrl(config: S3EndpointConfig): string {
  const endpoint = config.endpoint.replace(/\/+$/, "");
  if (config.forcePathStyle) return `${endpoint}/${config.bucket}`;
  const url = new URL(endpoint);
  url.hostname = `${config.bucket}.${url.hostname}`;
  return url.origin;
}

export interface SignedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: Buffer;
}

/**
 * Signs a request. `payloadHash` may be UNSIGNED-PAYLOAD, which R2 supports and
 * avoids hashing large uploads twice, but the SHA256 of the body is used because
 * it is universally supported and buffers are already in memory.
 */
export function signRequest(input: {
  method: string;
  config: S3EndpointConfig;
  credentials: S3Credentials;
  /** Object key, or undefined for bucket-level operations. */
  key?: string;
  query?: Record<string, string | number | undefined>;
  body?: Buffer;
  contentType?: string;
  now?: Date;
}): SignedRequest {
  const now = input.now ?? new Date();
  const { amzDate: amzDateStamp, dateStamp } = amzDate(now);
  const payload = input.body ?? Buffer.alloc(0);
  const payloadHash = sha256Hex(payload);
  const service: AwsService = "s3";

  const url =
    input.key === undefined
      ? `${bucketUrl(input.config)}?${canonicalQueryString(input.query ?? {})}`.replace(
          /\?$/,
          "",
        )
      : (() => {
          const base = objectUrl(input.config, input.key);
          const qs = canonicalQueryString(input.query ?? {});
          return qs ? `${base}?${qs}` : base;
        })();

  const parsed = new URL(url);
  const headers: Record<string, string> = {
    host: parsed.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDateStamp,
  };
  if (input.contentType) headers["content-type"] = input.contentType;
  if (input.credentials.sessionToken) {
    headers["x-amz-security-token"] = input.credentials.sessionToken;
  }

  // Only the headers that are signed, sorted, lowercase.
  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${String(headers[name]).trim()}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");

  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalUri(parsed.pathname),
    canonicalQueryString(input.query ?? {}),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${input.config.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDateStamp,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = hmac(
    hmac(
      hmac(
        hmac(`AWS4${input.credentials.secretAccessKey}`, dateStamp),
        input.config.region,
      ),
      service,
    ),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  headers.authorization = `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    method: input.method.toUpperCase(),
    url,
    headers,
    body: input.body,
  };
}

/**
 * Guesses whether a host needs path-style addressing.
 *
 * MinIO and most self-hosted gateways do, because `bucket.host` does not resolve
 * for them. A caller can always override with S3_FORCE_PATH_STYLE.
 */
export function shouldForcePathStyle(endpoint: string): boolean {
  const host = (() => {
    try {
      return new URL(endpoint).hostname;
    } catch {
      return endpoint;
    }
  })().toLowerCase();

  // Real S3/R2/GCS-interop endpoints resolve bucket subdomains.
  const pathStyleHosts = [
    "localhost",
    "127.0.0.1",
    "minio",
    "s3compat",
    "s3.local",
  ];
  if (pathStyleHosts.some((h) => host === h || host.endsWith(`.${h}`)))
    return true;
  // Anything with a bare host:port is almost certainly a local gateway.
  return /:\d+$/.test(endpoint);
}

/** A random object id, used when a caller has no better name. */
export function randomObjectId(): string {
  return randomBytes(16).toString("hex");
}
