# Overnight Work Report

Generated after the 2026-10-07 session. Everything below was verified by running
it, not by inspection.

## Bugs found and fixed tonight

### 1. DOCX uploads extracted zero text (critical, silent)

`src/worker/handlers/document-parse.ts` replaced whole paragraph blocks:

```js
.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, "\n")
```

That match **consumes the paragraph contents**, so every real Word/Google Docs
file parsed to an empty string. Existing tests passed because the fixtures had no
`<w:p>` wrappers at all.

Fixed by replacing only the tags:

```js
.replace(/<w:p\b[^>]*>/g, "\n")
.replace(/<\/w:p>/g, "\n")
```

**Verified against your real CV**
(`Zeyad_Ahmed_Hussein_CV_CyberSecurity (1).docx`): 0 characters before,
**4,292 characters / 554 words** after, with headings, bullets and the tab-aligned
job/date columns intact.

Regression test added in `tests/unit/document-extraction.test.ts`, using a
DOCX-shaped ZIP built in memory with real `<w:p><w:r><w:t>` structure. 7 tests.

### 2. `next build` failed inside Docker (deployment blocker)

`.dockerignore` correctly excludes `.env`, so the build had no `AUTH_SECRET`
while collecting page data for `/api/health`:

```
Error: AUTH_SECRET is required in production.
Failed to collect page data for /api/health
```

Fixed with clearly-named build-time placeholders in the builder stage, which
never reach the runtime stage.

### 3. The production image had no Prisma CLI (deployment blocker)

`output: "standalone"` prunes everything the server does not import, so
`/app/node_modules/prisma` did not exist. `migrate deploy` could never run in the
container. Three attempts, each failing for a distinct real reason:

- copying two packages: missing `@prisma/fetch-engine`, `@prisma/engines-version`
- `npm install` into `/app`: `Cannot read properties of null (reading 'edgesOut')`
  (npm cannot reconcile against the pruned tree)
- final fix: install the pinned CLI into `/opt/prisma-cli` with a clean
  `package.json`, symlinked to `/usr/local/bin/prisma`. Adds 35 packages.

Also removed `prisma generate` from the migrate command: it is a build-time step,
and re-running it in the runtime image fails because the standalone bundle omits
the engine wasm.

### 4. The container bound to its own hostname, not 127.0.0.1

Docker sets `HOSTNAME` to the container id, and the Next standalone server binds
to whatever `HOSTNAME` says. The compose healthcheck used `127.0.0.1`, which would
have failed forever. Fixed with `HOSTNAME=0.0.0.0` and a writable `HOME`.

### 5. Duplicate "Resumes" tab in the sidebar

`src/components/nav.tsx` listed the identical entry twice (lines 27 and 41).
Removed one.

## Docker verified end to end

Full `docker compose up` from a clean slate:

| Service  | Result                                             |
| -------- | -------------------------------------------------- |
| postgres | healthy                                            |
| migrate  | exited 0, preflight `PASS 15 · WARNING 1 · FAIL 0` |
| app      | **healthy**, host request `HTTP 200 ok=true`       |
| worker   | running                                            |

Image size ~440 MB. Tore down cleanly afterwards.

## Your CV, honestly assessed

The DOCX parsed cleanly and the content is genuinely good for an internship CV:
CCNA, SC-100, a BI internship with quantified impact (15 KPIs, 5 dashboards,
10 hrs/week saved, 70% less manual reporting).

What it needs, in priority order:

1. **The summary is weak.** "Seeking a Cyber Security internship to keep
   learning" describes what you want, not what you can do. Recruiters skim this.
2. **Cyber security experience is thin.** Everything in the CV is backend/BI.
   The security content is confined to one summary sentence and the
   certifications. There is no security project, lab, CTF, or security role.
3. **No projects section at all.** For a security internship this is the single
   biggest gap. Two or three small projects (a vulnerable app you hardened, a
   network lab, a scanner you wrote) would change the response rate.
4. **Skills are not a list.** "SQL, Python, Power BI" buried in prose. Recruiters
   scan for a skills line.
5. **Timeline format is inconsistent** ("Jun 2025 – Aug 2025" vs "SC-100").

This app's Achievement Mining and Claim Inspector features exist precisely for
points 1 and 4. Point 3 is a content problem no tool can fix.

## Free vs paid — the honest answer to your question

Written up in `docs/FREE_VS_PAID.md`. The short version:

**You are right to be worried.** Free currently contains 10 complete workflows.
A user can add a job, analyze it, build a matrix, tailor a resume, record a story
and practise 5 interview questions without hitting a wall. There is no obvious
reason to pay.

My recommendation (Option 2 in that doc): keep every Free feature but tighten the
limits so Free does exactly **one application properly**:

```
savedApplications:  3 -> 1
aiAssistCallsPerDay: 20 -> 5
starStories:         1      (unchanged)
resumeVersions:      1      (unchanged)
```

The pitch becomes honest: _"Free gets you one application properly. Paid makes
your whole search systematic."_ That is a one-line change per limit in
`src/domain/entitlements.ts` and takes effect immediately.

I also added a dashboard panel for Free accounts showing real usage against those
limits and exactly what Complete adds, so the difference is visible instead of
discovered by frustration.

## Why the app felt slow

Not a vague impression, three concrete causes:

1. `npm run dev` is not a production build. Routes compile on first visit, so
   each new page waits seconds. `npm run build && npm run start` is much faster.
2. The background worker runs inside the web process by default
   (`RUN_WORKER_INLINE=true`), so long jobs block requests.
3. The dashboard issues several queries per load with no caching.

For tomorrow's testing, judge speed on `npm run start`, not `npm run dev`.

## Verification status

| Gate                              | Result                             |
| --------------------------------- | ---------------------------------- |
| Vitest                            | **346 passed**, 23 files, 0 failed |
| Playwright E2E                    | **54 passed**                      |
| TypeScript                        | clean                              |
| ESLint                            | clean                              |
| Prettier                          | clean                              |
| `npm audit`                       | 0 vulnerabilities                  |
| Production build                  | green                              |
| Docker image + full compose stack | green, verified running            |
| Integrity check                   | 0 warnings, 0 auto-repaired        |

## Still blocked, unchanged

- No public deployment. Blocked on a hosting account and a domain.
- No real Whop event has ever been delivered. Needs the webhook secret and one
  real purchase. See `docs/WHOP_GO_LIVE.md`.
- No live S3 bucket test. Covered by a fake in-process S3 server, not a real one.
- No real SMTP account test. Covered by a fake SMTP server; TLS-mandatory
  behaviour is proven, actual delivery is not.

## Do these three things tomorrow

1. **Rotate the Whop API key.** It was pasted into chat and is therefore exposed.
   It sits in your gitignored `.env` as `WHOP_API_KEY`.
2. **Back up the database.** It lives in a Docker container that the WSL update
   already destroyed once. `npm run backup`, and copy the dump somewhere else.
3. **Decide the free/paid boundary** (Option 1, 2 or 3 in the doc). Then test with
   `free@acmejobs.local` and see whether the limits feel fair.
