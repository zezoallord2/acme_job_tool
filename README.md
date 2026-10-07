# Acme Jobs — Better Opportunities Ahead

An evidence-first job search operating system.

Acme Jobs refuses to invent. Every claim in a resume, cover letter, application
answer, interview story or AI answer must trace back to something the user
actually did. When the evidence does not exist, the product says so instead of
producing a confident sentence.

**Mandatory operating cost: $0.** No paid AI, no paid queue, no paid auth, no
hosted storage, no hosted observability, no paid email. Manual AI Mode works
without a single credential. See [docs/ZERO_COST_MODE.md](docs/ZERO_COST_MODE.md).

---

## The canonical flow

```
CAREER → Evidence Ledger → JOB → Evidence Matrix → APPLICATION
        → immutable Sent Version → Interview → Outcome
```

- **Career Profile** — roles you want, compensation floor, skills, constraints.
- **Evidence Ledger** — verified facts with source, verification status, and
  recency. Superseded facts are never deleted, only superseded.
- **Job** — a pasted description analysed into requirements and seniority signals.
- **Evidence Matrix** — every requirement compared against your evidence with
  plain-language reasoning. Coverage states are `STRONG`, `PARTIAL`, `MISSING`,
  `CONTRADICTED`, `NOT_APPLICABLE`. Nothing is a probability.
- **Application** — an immutable snapshot at send time. Later edits to your
  evidence never rewrite what you already sent.
- **Interview** — questions drawn from your own evidence, with STAR stories.
- **Outcome** — what happened, and what that teaches you next time.

---

## Stack

| Concern       | Choice                                        | Cost |
| ------------- | --------------------------------------------- | ---- |
| Framework     | Next.js 15 App Router, React 19, TypeScript   | $0   |
| Database      | PostgreSQL 16                                 | $0   |
| ORM           | Prisma 6                                      | $0   |
| Queue         | PostgreSQL-backed worker                      | $0   |
| Auth          | Argon2id + database sessions                  | $0   |
| AI            | Manual Mode (default), optional local or BYOK | $0*  |
| Storage       | Local filesystem                              | $0   |
| Observability | Local JSON logs + database records            | $0   |
| Analytics     | Internal PostgreSQL                           | $0   |
| Billing       | Manual admin entitlements, optional webhook   | $0   |

\* BYOK is billed to your own provider account and is never required.

---

## Quick start (local, no Docker)

```bash
npm install
cp .env.example .env          # defaults work as-is for local PostgreSQL
npm run db:deploy             # apply migrations
npm run db:seed               # FREE, PAID and ADMIN demo accounts
npm run dev                   # http://localhost:3000
```

The background worker runs in-process when `RUN_WORKER_INLINE=true`. To run it
separatively:

```bash
npm run worker
```

### Demo accounts

| Account                | Role  | Sees                                         |
| ---------------------- | ----- | -------------------------------------------- |
| `free@acmejobs.local`  | FREE  | Counts, recommendations, upgrade boundaries  |
| `paid@acmejobs.local`  | PAID  | Full matrices, tailoring, interview, stories |
| `admin@acmejobs.local` | ADMIN | Entitlements, Debug Center, system health    |

Password for all three: `acme-demo-password-2026`

---

## Quick start (Docker)

```bash
docker compose up --build
```

Brings up PostgreSQL, runs migrations, then starts the app and the worker.
Available at `http://localhost:3000`.

---

## Common commands

| Command                    | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `npm run dev`              | Development server                             |
| `npm run build`            | Production build                               |
| `npm run worker`           | Background worker                              |
| `npm run test`             | All Vitest suites                              |
| `npm run test:integration` | Database-backed tests                          |
| `npm run test:security`    | Authorization, path traversal, injection, SSRF |
| `npm run test:eval`        | AI quality, faithfulness and non-hallucination |
| `npm run e2e`              | Playwright, desktop and mobile                 |
| `npm run e2e:desktop`      | Desktop journeys                               |
| `npm run e2e:mobile`       | Mobile and responsive journeys                 |
| `npm run integrity:check`  | Read-only data integrity report                |
| `npm run backup`           | Database and file backup                       |
| `npm run backup:verify`    | Prove a backup is restorable                   |
| `npm run verify:full`      | Format, lint, typecheck, unit, build, E2E      |

---

## Manual AI Mode

Every AI workflow works without any provider:

1. Acme Jobs produces a prompt with a version tag and a schema.
2. You paste the response into any tool you like, or answer yourself.
3. You paste it back.
4. Acme Jobs validates it against the schema, repairs it when unambiguous, and
   asks you about anything it cannot verify.

Responses are never trusted silently. Unknown fields are reported, not dropped.
Repairable formatting is fixed and the repair is disclosed.

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — domain model and invariants
- [docs/ZERO_COST_MODE.md](docs/ZERO_COST_MODE.md) — how $0 is guaranteed
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — deploy, back up, restore, incidents
- [docs/HOSTING.md](docs/HOSTING.md) — MODE A/B hosting options and the true limitation list
- [docs/SECURITY.md](docs/SECURITY.md) — threat model and controls
- [docs/TESTING.md](docs/TESTING.md) — test strategy and how to run the gates
- [docs/WHOP_GO_LIVE.md](docs/WHOP_GO_LIVE.md) — real purchase, webhook and refund checklist
- [docs/SMOKE_TEST.md](docs/SMOKE_TEST.md) — post-deploy smoke sequence

---

## Non-goals

- Auto-applying to jobs.
- Ranking candidates or employers by a hidden score.
- Any statement of the form "you have an 80% chance of getting this interview".
- Inventing metrics, employers, titles, dates, or responsibilities.
- [docs/SESSION_REPORT.md](docs/SESSION_REPORT.md) - CV review, free vs paid analysis, and Docker verification
