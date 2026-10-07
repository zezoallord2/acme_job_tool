# Hosting Acme Jobs

This document is the operational contract. Acme Jobs is a Next.js application, so
it runs anywhere Node.js runs. This page covers what a host must provide, what
the app already handles for you, and the exact steps for a Whop go-live.

It is deliberately written so you can hand it to a host, an operator, or yourself
in six months.

---

## The one thing to understand first

There is no single binary. Acme Jobs is three processes that talk to one
database:

| Process    | What it does                          | Can it scale to zero? |
| ---------- | ------------------------------------- | --------------------- |
| `app`      | Serves HTTP, runs migrations checks   | No                    |
| `worker`   | Background jobs: uploads, AI, exports | Yes, briefly          |
| `postgres` | All durable state                     | No                    |

Hosts that only run a web process still work, because `RUN_WORKER_INLINE=true`
executes jobs inside the request process. That is fine for light traffic and
wrong for a real launch, so the recommendation is: **run the worker as a second
service.**

---

## What a host must provide

### Required

| Requirement     | Notes                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| Node.js 20.11+  | `node --version` must satisfy this or the build fails.                    |
| PostgreSQL 16+  | Any managed Postgres works: RDS, Neon, Supabase, Fly, Railway.            |
| A build command | `npm ci && npm run build`                                                 |
| A start command | `npm run start`                                                           |
| A health path   | `/api/health`                                                             |
| Persistent disk | Only if `STORAGE_DRIVER=local`. Not required if you use S3.               |
| HTTPS           | Cookies are `secure` in production, so plain HTTP will not log anyone in. |

### Not required

No Redis, no paid AI provider, no paid auth, no email service, no error-tracking
vendor, no CDN. Manual AI Mode is the default and needs no credential at all. See
[ZERO_COST_MODE.md](ZERO_COST_MODE.md).

---

## Deployment steps, in order

Do these in this order. Skipping step 2 is the single most common cause of a
site that boots and then 500s on every page.

### 1. Provision the database

Create an empty PostgreSQL database and copy the connection string into
`DATABASE_URL`. Also set `DIRECT_URL` to the same value. `DIRECT_URL` is used for
migrations, which lets you point it at a direct connection while the app uses a
pooler.

### 2. Run migrations — every deploy

```bash
npx prisma migrate deploy
```

Not `migrate dev`, and never `db push`. `migrate deploy` applies committed
migrations and does nothing when the database is already current, so it is safe
to run on every single deploy.

Run it as a **release/pre-deploy command**, before the new version starts
serving. Do not run it inside application startup: two instances starting at once
would race, and a migration that fails halfway with live traffic is worse than a
clean refusal to start.

### 3. Set the secrets

```bash
AUTH_SECRET=$(openssl rand -hex 32)             # 64 hex chars
KEY_ENCRYPTION_SECRET=$(openssl rand -hex 32)   # 64 hex chars, never change it
BILLING_LINK_SECRET=$(openssl rand -hex 32)     # 64 hex chars
```

`KEY_ENCRYPTION_SECRET` encrypts user-supplied AI keys. If you change it after
launch, every stored key becomes unreadable and users must re-enter them.

The development placeholders are rejected in production, so a deploy with the
stock `.env` fails loudly rather than running insecure.

### 4. Point the app at the worker

```bash
RUN_WORKER_INLINE=false     # if you run a separate worker process
```

### 5. Deploy and verify

```bash
curl -s https://your-host/api/health
```

A healthy deployment returns `200` with `"status": "healthy"`. See the next
section for what to do when it does not.

---

## The health endpoint

```
GET /api/health          always 200 unless you ask otherwise, with full detail
GET /api/health?strict=1 503 when anything is degraded — poll this one
```

It is designed for host readiness probes and returns:

| Field        | Meaning                                                           |
| ------------ | ----------------------------------------------------------------- |
| `status`     | `healthy` or `degraded`                                           |
| `readiness`  | A stable token, so two polls can be compared without parsing JSON |
| `database`   | Whether the database answered `SELECT 1`, and how long it took    |
| `migrations` | Whether required tables and columns exist, with the fix command   |
| `subsystems` | Per-subsystem health from the internal health checks              |
| `degraded`   | Names of the subsystems that are not healthy                      |

It never returns secrets, connection strings, file paths or user data. This
matters because readiness endpoints are usually public.

### When it reports `degraded`

| Message                                        | Cause                             | Fix                                                  |
| ---------------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| `missing: <Table>. Run: prisma migrate deploy` | Host started without migrating    | Run step 2, then redeploy                            |
| `missing columns: <Table>.<col>`               | A migration failed partway        | Investigate the failed migration before re-running   |
| `database: unreachable`                        | Wrong `DATABASE_URL`, or firewall | Verify the string and that the host can reach the DB |
| `data directory not writable`                  | Read-only or ephemeral filesystem | Mount a volume, or set `STORAGE_DRIVER=s3`           |

The `migrations.blockers` array is written for a human: it names the missing
table or column and the exact command to run.

---

## Storage on ephemeral hosts

Platforms like Vercel and Cloudflare give you a filesystem that disappears on
every deploy. Acme Jobs stores uploads, exports and logs on disk by default, so on
those platforms you must either:

**Option A — mount a volume.** Best on Fly.io, Render, Railway, or any VPS.

```
DATA_DIR=/data          # point at the mounted volume
```

**Option B — use S3-compatible storage.** Set `STORAGE_DRIVER=s3` (the legacy
`STORAGE_PROVIDER=s3` alias is also honored) and the `S3_*` variables. Upload
keys are randomised, ownership is required on every read, and every request is
signed with SigV4. It is covered by unit tests and by an in-process fake S3
server, but it has not been validated against a live bucket, so run one real
upload through your chosen provider before large customers do (see
[SMOKE_TEST.md](SMOKE_TEST.md)).

**Option C — accept the limitation.** If your users never upload files, disk
loss is harmless; the health endpoint reports a non-fatal warning rather than
failing readiness, and the app keeps working.

---

## Paid hosting, ranked by how little they will hurt you

| Host                | Database included | Disk           | Good fit                            |
| ------------------- | ----------------- | -------------- | ----------------------------------- |
| Railway             | yes               | volume         | Easiest; app + worker + Postgres    |
| Render              | yes               | volume         | Same, free tier to start            |
| Fly.io              | attach any        | volume per app | Best control, cheapest scale        |
| Neon + Vercel       | yes               | none           | Only if uploads are unused          |
| A VPS (Hetzner, DO) | self-hosted       | full disk      | Cheapest at real traffic, most work |

Vercel works for the web process but has no durable filesystem and no long-lived
worker, so it needs option A or B above and a separate worker host.

### Recommended staged launch

For a private, non-commercial beta, the lowest-cost stack is Vercel Hobby,
Neon Free Postgres, Whop checkout and Gemini's free API allowance. Customer
phones run only the browser UI. Local Ollama is for development and private
self-hosting; it must never route public traffic through a developer computer.

Before accepting paid subscriptions, move the web app to a plan that permits
commercial use. Vercel's Hobby terms restrict it to non-commercial personal
use; Vercel Pro is currently $20/month. Neon can remain on Free until its limits
or required reliability justify Launch. Whop has no fixed monthly hosting fee,
but deducts transaction/payment fees from sales.

The recommended one-click AI configuration is:

```bash
ACME_AI_ENABLED=true
AI_MODE_PRIORITY=gemini,openrouter,openai,anthropic,manual
DEFAULT_AI_PROVIDER=gemini
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=<server-side-key>
```

The key belongs only in the hosting provider's encrypted environment variables,
never in browser JavaScript. Plan quotas and the hourly abuse limiter still
apply. Manual Mode remains the outage fallback, not the primary paid-user
experience.

---

## Whop go-live

This is the part that breaks silently, so read it fully.

### The problem

A payment platform knows a customer by **its own id**, not by your email. When
`subscription.created` arrives, there is no way to tell which Acme Jobs account
it belongs to. Get this wrong and the customer pays, the webhook fails, and
nobody notices until they complain.

### The flow

```
Customer buys on Whop
  -> Whop calls POST /api/webhooks/billing     (we cannot identify them yet)
       event recorded as USER_NOT_LINKED, nothing lost
  -> Customer returns to /api/billing/link?token=...
       token is signed by BILLING_LINK_SECRET
  -> We create the UserIntegration row and replay the held event
  -> Entitlement granted
```

The webhook almost always arrives **before** the customer comes back. That is why
`src/billing/reconcile.ts` exists: it replays every held event once the account
is known, guarded by a per-user check so one customer's event can never grant
another customer access.

### Configuration

```bash
BILLING_PROVIDER=whop
WHOP_WEBHOOK_SECRET=<from the Whop dashboard>
WHOP_PRODUCT_ID=<the product being sold>
BILLING_LINK_SECRET=<openssl rand -hex 32>
```

### In the Whop dashboard

1. Add a webhook pointing at `https://your-host/api/webhooks/billing`.
2. Subscribe to `subscription.created` and `subscription.cancelled`.
3. Copy the signing secret into `WHOP_WEBHOOK_SECRET`.
4. Set the post-purchase redirect to `/app/settings`.

### Wiring the redirect

After a successful purchase, send the customer to:

```
https://your-host/api/billing/link?token=<token>
```

Mint the token server-side:

```bash
curl -X PUT https://your-host/api/billing/link \
  -H "Authorization: Bearer $BILLING_LINK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"externalUserId":"whop_abc123","email":"buyer@example.com"}'
```

The response includes both a `token` and a ready-made `linkUrl`. Minting requires
the bearer token, so a visitor can never forge one.

The user must be signed in when they follow the link. If they are not, the app
sends them to sign in and the link still works afterwards — the token lives 24
hours.

### Verifying it worked

```bash
curl -s https://your-host/api/health | jq '.status'
```

Then check that a purchase shows up:

```sql
SELECT "provider", "eventType", "status", "errorCode", "receivedAt"
FROM "WebhookEvent" ORDER BY "receivedAt" DESC LIMIT 10;
```

`status = SUCCEEDED` means the entitlement was granted. `errorCode =
USER_NOT_LINKED` with `status = FAILED` means the customer has not returned to
finish linking yet — expected, and it resolves itself when they do.

---

## Deploy checklist

Copy this into your host's notes.

**Before the first deploy**

- [ ] `DATABASE_URL` and `DIRECT_URL` set to the same database
- [ ] `AUTH_SECRET`, `KEY_ENCRYPTION_SECRET`, `BILLING_LINK_SECRET` all 64 hex chars
- [ ] `ZERO_COST_MODE=true`
- [ ] `DEV_LOG_MAGIC_LINKS=false`
- [ ] `NODE_ENV=production`
- [ ] `APP_URL` set to the public origin, no trailing slash
- [ ] Release command: `npx prisma migrate deploy`
- [ ] Start command: `npm run start`
- [ ] Health path: `/api/health?strict=1`
- [ ] Worker running, or `RUN_WORKER_INLINE=true`
- [ ] `DATA_DIR` on a persistent volume, or uploads disabled

**After deploying**

- [ ] `curl /api/health` returns `"status": "healthy"`
- [ ] Sign up, sign in, add a job, analyse it in Manual Mode
- [ ] Upload a TXT job description and confirm the job appears
- [ ] `/api/webhooks/billing` returns 503 while Whop is unconfigured, 401 on a bad signature, 200 on a valid one

**Before taking payments**

- [ ] `BILLING_PROVIDER=whop` and the three Whop variables set
- [ ] A real purchase grants Complete Edition
- [ ] Cancelling revokes it
- [ ] Delivering the same webhook twice does not grant twice

---

## Troubleshooting

**Every page 500s after deploy, health is unreachable.** Migrations did not run.
Check `migrations.blockers` on the health endpoint and run
`npx prisma migrate deploy`.

**Health says `degraded` but the app works.** Something non-fatal is wrong, most
often the data directory. The response names it under `warnings`.

**Sign-in fails silently in production.** The cookie is `secure`, so it needs
HTTPS. Behind a proxy, also set `APP_URL` to the public HTTPS origin so
same-origin checks pass.

**Uploads vanish on redeploy.** Ephemeral filesystem. See the storage section.

**Customer paid, no access.** Check `WebhookEvent` for `USER_NOT_LINKED`. If it
is there, the customer needs to visit their link. If it is not, the webhook never
arrived — check the URL and the signing secret.

**Worker jobs never run.** `RUN_WORKER_INLINE=false` with no worker process
running. Either start the worker or set it back to `true`.

---

## What this app still needs before a real launch

Stated plainly rather than buried:

1. **S3 storage is implemented and tested, but not validated against a live
   bucket.** Upload one file through your real provider during the smoke test
   before trusting it in production.
2. **Email requires your SMTP account.** Development uses
   `MAIL_DRIVER=development` and writes to the local log; set
   `MAIL_DRIVER=smtp` and the `SMTP_*` variables for production. Transactional
   sends such as password reset fail closed when TLS is unavailable.
3. **Live Whop delivery is untested.** The signature verification, replay
   protection, linking and reconciliation are all unit-tested, but no real
   Whop event has been through this code. Test with a real purchase before
   advertising.
4. **There is no `.exe`.** If you need a distributable desktop binary, that is
   separate work — see the top-level README.
