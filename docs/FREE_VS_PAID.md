# Free vs Complete Edition

The single source of truth is `src/domain/entitlements.ts`. This document
explains it in plain language and, more importantly, is honest about the problem:
**right now the Free tier is too generous.**

## What Free actually gets

Everything below works on a free account, forever, with no card:

| Capability               | What you can do                                        |
| ------------------------ | ------------------------------------------------------ |
| Career Snapshot          | Profile, target role, your CV text stored and reusable |
| Evidence Ledger (basic)  | Record achievements by hand                            |
| Job Analyzer (basic)     | Paste a job description, get a fit read                |
| Evidence Matrix (basic)  | Map your evidence onto one job                         |
| Resume Tailoring (basic) | One tailored version                                   |
| STAR Story Bank          | **1** story                                            |
| Mock Interview           | **5** questions                                        |
| Ask Acme                 | Daily AI assist, **20 calls/day**                      |
| Free Guide               | The starter guide PDF                                  |

Hard limits, enforced **server-side** in `PLAN_LIMITS`, not just hidden in the UI:

```
savedApplications: 3
resumeVersions:     1
starStories:        1
mockInterviewQuestions: 5
aiAssistCallsPerDay:     20
```

## What Complete adds

23 further capabilities:

- **Master Resume** and **Resume Versions** (unlimited)
- **Resume Tailoring (advanced)** and the **Resume Bullet Builder**
- **Cover Letter Builder**, **LinkedIn Optimizer**, **Application Question Builder**
- **Voice Profile** and **Career Narrative** (writes in your voice, once)
- **Achievement Mining** — turns a raw job description into a story you forgot
- **Target Role Blueprint**
- **Job Analyzer (deep)** and **Evidence Matrix (full)**
- **Fit Recommendation**
- **Claim Inspector** and **Defend This Claim** — interview defence drills
- **Consistency Engine** and **Readiness Gate** — catches contradictions before an interview
- **Star Bank (full)** — unlimited stories
- **Interview Command Center**, **Mock Interview (advanced)**, **Post-Interview Review**
- **Follow-up Builder**, **Application Capsule**, **Immutable Sent Versions**
- **Application Tracker**, **Analytics**, **Daily Priority Engine**
- **Effort vs Opportunity** — tells you which applications are worth your time
- **Complete Book**

All limits become unlimited.

## The honest problem

You felt lost, and you are right to. The Free tier currently contains **ten
complete workflows**, not a taste. A user can:

- add a job, analyze it, build an evidence matrix, tailor a resume,
- record one story, practise five interview questions, ask Acme twenty times

...and never hit a wall in a single-session demo. That is a real conversion
problem, and it is a **product decision**, not a bug.

Compare with tools that convert well: they give you one thing end-to-end and
make the rest obviously necessary.

### Three options, with the trade-off

**Option 1 — leave it (safe, weakest revenue)**
Free stays generous. You get trust and word of mouth, low conversion. Acceptable
if the goal is a portfolio/demo product.

**Option 2 — gate at the _depth_ level (recommended)**
Keep every Free feature listed, but make the limits bite sooner and make the
paid tier the _only_ way to do the thing people actually pay for: applying to
many jobs well.

- `savedApplications: 3 → 1` (Free can tailor one CV to one job — the classic
  first use case)
- `aiAssistCallsPerDay: 20 → 5`
- `resumeVersions: 1 → 1` (unchanged)
- `starStories: 1` (unchanged — one good story already feels valuable)
- Keep: Job Analyzer, Evidence Matrix, Resume Tailoring, Mock Interview, Ask
  Acme. Removing these makes Free feel broken rather than generous.

The pitch becomes honest: _"Free gets you one application properly. Paid makes
your whole search systematic."_

**Option 3 — hard split by feature (highest conversion, highest resentment)**
Free = Career Snapshot + Evidence Ledger + one resume check. Everything else
paid. Converts best, but a user who cannot try the analyzer will not trust the
product, and you lose the $0 story that differentiates you.

My recommendation is **Option 2**. It preserves the "$0 mode works, genuinely"
positioning while giving a clear, non-hostile reason to pay.

## Why the app feels slow

Not a vague impression — three concrete causes, in order of impact:

1. **`npm run dev` is not a production build.** Next.js dev compiles routes on
   request, so the _first_ visit to each page waits seconds. This is expected.
   Production is much faster. Test the real thing with `npm run build && npm run start`.
2. **The background worker runs inside the web process by default**
   (`RUN_WORKER_INLINE=true`). Long jobs, like document parsing, block requests.
   Run the worker separately for anything beyond local use.
3. **No caching on the dashboard.** It queries several tables per load. Fine for
   one user; worth revisiting before real traffic.

## What I would do next

1. Decide between Options 1, 2 and 3 above. This is a business decision and it
   is yours.
2. Add a visible "what you get by upgrading" panel on the dashboard that
   responds to the account's actual plan, so the difference is self-evident
   rather than discovered by hitting a wall.
3. Fix the navigation so Free and Paid users both see a clear next step.

Changing `PLAN_LIMITS` is a one-line change per limit, and it takes effect
immediately — no migration.
