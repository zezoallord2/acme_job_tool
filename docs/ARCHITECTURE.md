# Architecture

## Domain model

```
User ─┬─ CareerProfile
      ├─ EvidenceRecord ── EvidenceVerification ── Source
      ├─ JobRecord ── JobAnalysis ── Requirement
      ├─ Application ── ApplicationVersion (immutable)
      ├─ Resume ── ResumeSection
      ├─ Interview ── InterviewQuestion ── InterviewAnswer
      ├─ Story ── InterviewOutcome ── LearningEvent
      ├─ Session / Entitlement / RateLimitBucket
      └─ WorkQueueItem / SystemError / SystemTrace / AnalyticsEvent
```

### Invariants

1. **Evidence is the only source of claims.** No generated artefact may contain a
   metric, employer, title, date, or skill that does not resolve to an evidence
   record the user owns.
2. **Evidence is superseded, never deleted.** Records carry
   `SUPERSEDED` status plus `supersededById`, so history stays auditable.
3. **Verification gates claims.** `VERIFIED` evidence can support a claim.
   `REPORTED` evidence can support a claim but must be presented as
   user-reported. `CONTRADICTED` evidence blocks the claim.
4. **Sent versions are immutable.** `ApplicationVersion` rows are written once,
   hash their contents, and are never updated. Regenerating a resume changes the
   draft, never the version already sent.
5. **Optimistic concurrency.** Application transitions carry an `expectedVersion`
   that must match, so two tabs cannot double-submit a state change.
6. **Coverage is not probability.** The evidence matrix emits `STRONG`,
   `PARTIAL`, `MISSING`, `CONTRADICTED`, `NOT_APPLICABLE` with a written reason.
   It never emits a success percentage.
7. **Cross-document consistency.** A metric appearing in a resume, a cover letter
   and an application answer must agree. Disagreement is reported as a defect.
8. **Learning cannot write facts.** `LearningEvent` may create an
   `EvidenceProposal` in `PENDING_REVIEW`. Nothing reaches the ledger without
   user confirmation.
9. **Honest analytics.** Samples below the sufficiency threshold are labelled
   insufficient, and no chart asserts causation.
10. **Authorization is server-side.** Every read and write filters by `userId`.
    The client is never trusted for identity or entitlement.

## Application state machine

```
DRAFT → TAILORED → READY_TO_APPLY → APPLIED
                    ↓                    ↓
                 DECLINED           INTERVIEWING
                                          ↓
                            OFFER / REJECTED / WITHDRAWN
```

Transitions are validated against an explicit table. Terminal states cannot be
left. Illegal transitions raise a typed error and are logged as system errors
with their triggering user and entity.

## AI pipeline

```
workflow (jobs.analyze, resume.tailor, interview.coach, ...)
  → provider router
      → LocalAIProvider    (Ollama, optional)
      → BYOK provider      (optional, billed to user)
      → ManualAIProvider   (default, $0)
  → strict schema validation (Zod)
  → disclose-on-repair pass
  → claim extraction against the evidence ledger
  → faithfulness check
  → persistence with promptVersion + schemaVersion
```

Unknown fields are reported to the user rather than silently dropped, because
silently dropping a field is how an unsupported claim escapes review.

### Where each workflow is wired

Every workflow has a prompt, a schema, a validator, a version and a Manual Mode
prompt package. Each also has an entry point:

| Workflow                | Entry point                       | Output becomes                        |
| ----------------------- | --------------------------------- | ------------------------------------- |
| `JOB_ANALYSIS`          | Job → Analyze now                 | `JobAnalysis`, requirements, matrix   |
| `EVIDENCE_EXTRACTION`   | Evidence → Discover evidence      | `EvidenceProposal` rows               |
| `ACHIEVEMENT_INTERVIEW` | Evidence → Discover evidence      | `EvidenceProposal` rows, on request   |
| `DEFEND_CLAIM`          | Claim Inspector → Claim Defense   | A verdict, reported only              |
| `INTERVIEW_QUESTION`    | Interview Prep → Question Builder | `InterviewQuestion` rows on a session |
| `INTERVIEW_FEEDBACK`    | Interview Prep → Answer Coach     | Five scores plus one follow-up        |

The remaining nine run through the **Writing Studio** at `/app/studio`. They are
declared once each in `src/services/studio-service.ts` as data — fields, prompt
context, and where the validated output is persisted — and rendered by one shared
panel, so adding a workflow is a registry entry rather than a new screen.

| Workflow             | Saves                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| `RESUME_TAILORING`   | A job-linked draft cloned from the Master Resume, which is left untouched |
| `RESUME_BULLET`      | A `ResumeBullet` in `NEEDS_CONFIRMATION`, never auto-accepted             |
| `COVER_LETTER`       | A versioned `CoverLetter`; older drafts are superseded, not deleted       |
| `APPLICATION_ANSWER` | An `ApplicationAnswer` linked to the application                          |
| `LINKEDIN_OPTIMIZER` | Suggestions on the career narrative, `userConfirmed: false`               |
| `STAR_STORY`         | A `StarStory` in the bank                                                 |
| `FOLLOW_UP`          | A `FollowUp` in `DRAFT`; nothing is ever sent                             |
| `CAREER_NARRATIVE`   | An active `CareerNarrative`, unconfirmed                                  |
| `VOICE_PROFILE`      | A new `VoiceProfile` version of style preferences                         |

The persistence rule matters more than the list. Only `JOB_ANALYSIS` writes
domain records directly, because a job description contains no claims about the
user. Anything derived from the user's own career produces an `EvidenceProposal`
that stays `PENDING` until it is accepted on the Learning page. `DEFEND_CLAIM`
writes nothing at all, because a bad verdict is information, not a fact.

## Background processing

Two things run in the worker rather than in a request:

| Job type                                                                              | What it does                                                         |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `DOCUMENT_PARSE`                                                                      | Extracts text from a TXT, MD, PDF or DOCX upload and creates the job |
| `AI_WORKFLOW`, `EXPORT_PDF`, `ANALYTICS_RECALC`, `INTEGRITY_CHECK`, `WEBHOOK_PROCESS` | The rest                                                             |

`DOCUMENT_PARSE` uses `node:zlib` directly: DOCX is a ZIP of XML so `word/document.xml` is inflated and stripped, and PDF content streams are inflated and scanned for text operators. There is no OCR service and no document API, which is what keeps the stack at $0. A scanned PDF with no text layer is reported as such instead of silently producing nothing.

## Testing the upload path

`src/worker/handlers/document-parse.ts` exports `extractText`, `extractDocxText` and `extractPdfText` so they can be tested without the queue. The action boundary is covered separately: `tests/security/` exercises extension, MIME and size rejection, and `tests/integration/` asserts an upload enqueues exactly one job.

## Queue

`WorkQueueItem` is a PostgreSQL table. Workers claim rows with
`FOR UPDATE SKIP LOCKED`, so multiple workers can share one database without a
broker. Failures retry with exponential backoff until `maxAttempts`, then move to
`DEAD` for inspection in the Debug Center. Idempotency keys prevent duplicate
side effects across retries.

The same table backs stuck-job recovery, since a `lockedAt` older than
`QUEUE_LOCK_TIMEOUT_MS` is reclaimable.

## Observability

`SystemTrace` records operation, duration, outcome and the user it affected.
`SystemError` records severity, whether it is retryable, and whether it is
auto-repairable. `AnalyticsEvent` records product events in-house. All of it is
queryable from the Debug Center with no external service.

## Zero-cost boundaries

Adapters are chosen by environment variables, never hardcoded. See
[ZERO_COST_MODE.md](ZERO_COST_MODE.md).

## Directory map

```
prisma/            schema, migrations, seed
src/domain/        pure rules: state machine, evidence, matching, readiness,
                   consistency, analytics, priorities, learning
src/ai/            providers, prompts, schemas, validation, router
src/services/     application services that orchestrate domain rules + Prisma
src/services/studio-service.ts
                   registry of the nine Writing Studio workflows, declared as data
src/queue/         Postgres queue and circuit breakers
src/worker/        worker loop and handlers
src/app/           routes; route handlers and server actions enforce ownership
src/workflows/     workflow runner shared by every AI entry point
src/components/    UI
scripts/           backup, restore, verify-backup, integrity check
tests/             unit, integration, security, eval
e2e/               Playwright journeys
```
