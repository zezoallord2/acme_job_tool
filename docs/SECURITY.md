# Security

## Threat model

Acme Jobs holds a user's professional history: evidence of work, claim
attribution, interview outcomes, and optionally their AI provider keys. The
assets worth protecting are, in order:

1. Another user's data.
2. The integrity of the evidence ledger and sent versions.
3. User-supplied API keys.
4. Session validity.

## Controls

### Authentication

- Argon2id password hashing with per-user salts.
- Opaque database sessions. There is no JWT to revoke and no signing key that
  turns account deletion into a client-side problem.
- `SESSION_TTL_HOURS` bounds session lifetime; cookies are `httpOnly`, `sameSite=lax`,
  `secure` in production.
- Dev-only magic-link logging is gated behind `DEV_LOG_MAGIC_LINKS` and must be
  off in production.

### Authorization

- Every query filters by `userId` from the session, never from a request
  parameter.
- Paid features are enforced server-side. Hiding a button is a courtesy, not a
  control. `npm run test:security` and `e2e/security.spec.ts` both attempt
  cross-tenant access directly against HTTP endpoints.
- Admin routes require the `ADMIN` entitlement.

### Input handling

- Zod validates every server action and route-handler input at the boundary.
- Prisma parameterizes all queries; there is no string-built SQL anywhere.
- Uploaded files are size-capped by `MAX_UPLOAD_BYTES`, restricted by extension
  and content type, stored outside the web root, and served through a controller
  that resolves paths and rejects anything escaping the data directory.

### Injection and SSRF

- No `dangerouslySetInnerHTML` on user or AI content.
- Outbound requests are restricted by an allowlist. A job URL is never fetched
  blindly; user-supplied URLs cannot reach internal address ranges.

### Secrets

- `AUTH_SECRET` and `KEY_ENCRYPTION_SECRET` are validated on boot and the dev
  placeholders are rejected in production.
- User BYOK keys are encrypted at rest with AES-256-GCM. The UI never returns a
  stored key, only a masked suffix and which provider it belongs to.
- `.env` is gitignored; `.env.example` contains no real value.

### Webhooks

- HMAC signature verification with a constant-time compare.
- Timestamp-based replay rejection.
- Idempotent event handling, so a retried delivery cannot double-grant.

### Auditability

- `SystemTrace` records operation, duration, outcome and affected user.
- `SystemError` records severity and retryability.
- Application state transitions and sent versions are permanent records.

### Honest-failure behaviour

Failed requests produce a typed error, a user-readable message with no internal
detail, and a log entry. They do not leak stack traces, SQL, or file paths to the
client.

## Response headers

Set globally in `next.config.ts` for every route:

| Header                    | Value                                                  |
| ------------------------- | ------------------------------------------------------ |
| `X-Frame-Options`         | `DENY`                                                 |
| `X-Content-Type-Options`  | `nosniff`                                              |
| `Referrer-Policy`         | `strict-origin-when-cross-origin`                      |
| `Permissions-Policy`      | camera, microphone and geolocation disabled            |
| `Content-Security-Policy` | default-src 'self'; no object-src; no external origins |

The CSP uses `'unsafe-inline'` for scripts because Next issues no per-request
nonce. React escaping and the absence of `dangerouslySetInnerHTML` on user or AI
content remain the primary XSS controls; the CSP is defence in depth rather than
the main defence.

## Dependency audit

`npm audit` reports **zero vulnerabilities** in both the production and the full
dependency tree.

This was not always true. `eslint-config-next` pulled
`@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`, and the
advisory on `braces` ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
a stack-exhaustion denial of service) had no patched release: the vulnerable range
is `<=3.0.3` and `3.0.3` is the newest published version, so `npm audit fix`
could not resolve it.

Rather than accept the risk in writing, `eslint-config-next` was removed and its
config rewritten directly in `eslint.config.mjs` on
`typescript-eslint`, `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y`.
That deleted 183 transitive dependencies and took the audit to zero. The rules
that matter for this codebase are preserved:

| Concern                     | Rule source                               |
| --------------------------- | ----------------------------------------- |
| React hooks correctness     | `eslint-plugin-react-hooks` recommended   |
| JSX accessibility           | `eslint-plugin-jsx-a11y` recommended      |
| TypeScript correctness      | `typescript-eslint` recommended           |
| Unused vars, `any`, console | explicit overrides in `eslint.config.mjs` |

Two findings the stricter rules surfaced were fixed rather than suppressed: a
redundant `??` on a `String()` result, and `autoFocus` in the onboarding wizard,
replaced with a focus-on-step-change effect. `react-hooks/purity` is disabled for
`src/app/**/page.tsx` only, because every page in this app is a React Server
Component that renders once per request.

Re-check after any dependency change:

```bash
npm audit --omit=dev     # must stay at zero
npm audit                # must return to zero
```

## Reporting a vulnerability

Do not open a public issue for a security report. Contact the maintainer through
a private channel.

## Security test coverage

`npm run test:security` covers:

- Cross-tenant read and write attempts
- Entitlement bypass attempts against paid routes
- Path traversal in the upload and export controllers
- SQL injection payloads against search and filter inputs
- XSS payloads rendered into AI-generated output
- SSRF attempts through user-supplied URLs
- Session fixation and expiry
- Webhook signature forgery and replay
- Encrypted key round-trip and masking

`e2e/security.spec.ts` repeats the authorization and entitlement checks through a
real browser against a running server, which is where UI-only bypasses would
show up.
