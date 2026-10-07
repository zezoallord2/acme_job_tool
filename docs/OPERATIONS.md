# Operations

## Requirements

- Node.js 20.11 or newer
- PostgreSQL 16
- No other paid dependency

## Local development

```bash
npm install
cp .env.example .env
npm run db:deploy
npm run db:seed
npm run dev
```

Run the worker in a second terminal with `npm run worker`, or leave
`RUN_WORKER_INLINE=true` and let the web process execute jobs.

## Docker

```bash
docker compose up --build
```

Four services:

| Service    | Role                                                |
| ---------- | --------------------------------------------------- |
| `postgres` | PostgreSQL 16 with a named volume and a healthcheck |
| `migrate`  | Runs `prisma migrate deploy`, then exits            |
| `app`      | Next.js standalone server                           |
| `worker`   | Background worker                                   |

`app` waits for `migrate` to complete successfully, so migrations always land
before traffic.

`next.config.ts` sets `output: "standalone"`, so the runtime image carries its
own server bundle. The worker is compiled to plain JavaScript with esbuild in the
build stage, so the runtime image needs no TypeScript toolchain.

Set real secrets before exposing the stack:

```bash
echo "AUTH_SECRET=$(openssl rand -hex 32)" > .env
echo "KEY_ENCRYPTION_SECRET=$(openssl rand -hex 32)" >> .env
```

## Configuration

`ZERO_COST_MODE=true` is the safe default and rejects any configuration that
would send a request to an Acme-funded provider. The variables that matter most:

| Variable                   | Default                                           | Notes                                |
| -------------------------- | ------------------------------------------------- | ------------------------------------ |
| `DATABASE_URL`             | local                                             | Required                             |
| `AUTH_SECRET`              | dev value                                         | Must be replaced outside development |
| `KEY_ENCRYPTION_SECRET`    | dev value                                         | Encrypts user-supplied BYOK keys     |
| `SESSION_TTL_HOURS`        | `336`                                             | 14 days                              |
| `ZERO_COST_MODE`           | `true`                                            | Do not disable in production         |
| `DEFAULT_AI_PROVIDER`      | `local`                                           | Ollama first, Manual Mode fallback   |
| `AI_MODE_PRIORITY`         | `local,gemini,openrouter,openai,anthropic,manual` | Order of fallback                    |
| `QUEUE_POLL_INTERVAL_MS`   | `2000`                                            | Worker poll interval                 |
| `QUEUE_LOCK_TIMEOUT_MS`    | `120000`                                          | When a locked job is reclaimed       |
| `MAX_UPLOAD_BYTES`         | `5242880`                                         | Upload ceiling                       |
| `ALLOW_AUTO_REPAIR_IN_ENV` | `local_dev`                                       | Set to `none` in containers          |

`DEV_LOG_MAGIC_LINKS=true` is development-only. It must be `false` in production.

## Backups

```bash
npm run backup
```

Writes to `data/backups/`:

- `acme-<timestamp>.dump` — `pg_dump` custom format, restorable table by table
- `data-<timestamp>.tar.gz` — uploads, exports, generated files, logs
- `MANIFEST-<timestamp>.txt` — checksums and row counts

The ten newest database dumps are retained.

A backup nobody has restored is not a backup, so verify it:

```bash
npm run backup:verify data/backups/acme-<timestamp>.dump
```

This restores into a throwaway database, asserts that every critical table
exists, prints row counts, checks for orphaned foreign keys, then drops the
scratch database. It exits non-zero if the dump is truncated or inconsistent.

## Restore

```bash
npm run restore data/backups/acme-<timestamp>.dump data/data-<timestamp>.tar.gz
```

Drops and recreates the public schema, restores the dump, and optionally unpacks
the file archive. You must type `RESTORE` to confirm.

## Migrations

```bash
npm run db:migrate      # create and apply a migration in development
npm run db:deploy       # apply existing migrations (production)
npm run db:status       # confirm the database matches the repo
```

Never use `prisma db push` against production. Schema changes must arrive as
committed migrations.

## Monitoring

Health, queue depth, dead jobs, circuit-breaker state, error rates and integrity
results are visible in the admin Debug Center at `/admin`, with bug reports at
`/admin/bug-reports`. Both require the `ADMIN` entitlement.

For scripted checks, use the integrity CLI rather than an HTTP endpoint:

```bash
npm run integrity:check    # exits non-zero on ERROR or CRITICAL issues
npm run db:status          # exits non-zero when migrations are pending
```

Read-only exports are available for a signed-in user at
`/api/export/career.json`, `/api/export/applications.csv` and
`/api/export/analytics.csv`. Each one filters by the session's `userId`; there is
no admin-wide data export route, by design.

## Incident playbook

**Dead queue items.** Open the Debug Center, inspect the last error, fix the root
cause, then requeue. Dead items are never retried automatically because
retrying a deterministic failure just burns attempts.

**Circuit breaker open.** The provider is failing. Manual Mode is unaffected.
Fix the provider, or leave it disabled; the router falls back to Manual Mode.

**Integrity issues.** Run `npm run integrity:check`. It is read-only. Repair is
deliberately refused outside `local_dev`, so a production fix is a deliberate,
reviewed action rather than an automatic rewrite.

**Suspected credential exposure.** Rotate `AUTH_SECRET` to invalidate every
session, then rotate `KEY_ENCRYPTION_SECRET` and ask users to re-enter their
BYOK keys. Stored keys are encrypted with that secret.

## Scaling

The web process is stateless and can be replicated. The worker is safe to run in
multiple replicas because queue claims use `FOR UPDATE SKIP LOCKED`. The database
is the shared bottleneck; read replicas for analytics are the usual next step and
need no paid service.
