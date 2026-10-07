# Testing

## Layers

| Suite         | Location            | Needs a database  | What it proves                      |
| ------------- | ------------------- | ----------------- | ----------------------------------- |
| Unit          | `tests/unit`        | no                | Domain rules, schemas, validators   |
| Integration   | `tests/integration` | yes               | Repositories, transactions, queue   |
| Security      | `tests/security`    | yes               | Authorization, traversal, injection |
| AI evaluation | `tests/eval`        | no                | Output quality and faithfulness     |
| End-to-end    | `e2e`               | yes + a built app | Real user journeys                  |

## Running

```bash
npm run test               # every Vitest suite
npm run test:unit
npm run test:integration   # uses TEST_DATABASE_URL
npm run test:security
npm run test:eval

npm run e2e                # desktop + mobile
npm run e2e:desktop
npm run e2e:mobile
npm run e2e:ui             # interactive debugger
```

## The full gate

```bash
npm run verify:full
```

Format check, lint, typecheck, unit, integration, security, eval, production
build, then all Playwright journeys. This is the gate that has to be green
before a release.

## Database

Integration, security and E2E suites run against `TEST_DATABASE_URL`. They
truncate the tables they touch between tests, so never point it at a database
you care about.

```bash
createdb acme_jobs_test
npm run db:deploy          # uses DATABASE_URL; set it to the test DB once
npm run db:seed
```

## AI evaluation

The evaluation suite asserts the properties the product actually promises,
rather than snapshotting prose:

- Unsupported metrics never appear in generated output.
- Every claim in a resume or cover letter resolves to an evidence record.
- Leadership inflation is detected.
- Coverage states never render as percentages.
- Validation rejects a malformed payload and repairs a repairable one while
  disclosing the repair.
- Unsupported-role refusal works: asked about a job the user has no evidence
  for, the model must say so rather than produce something.

## End-to-end coverage

Desktop:

- `free-user.spec.ts` — signup, onboarding, career snapshot, evidence, job
  creation, Manual Mode analysis, matrix, recommendation, upgrade boundary, and
  that the follow-up link Ask Acme suggests actually resolves
- `paid-user.spec.ts` — paid surfaces, seeded evidence, claim inspector, Ask
  Acme, cost-responsibility messaging
- `coaching-workflows.spec.ts` — all five coaching workflows through the real
  Manual Mode UI, including that extraction creates proposals and writes nothing
  to the ledger, that Claim Defense may return `OVERSTATED`, that generated
  questions are persisted, that the coach flags an unsupported claim, and that a
  mock interview answer reaches a real `InterviewAnswer` row
- `studio.spec.ts` — the Writing Studio: all nine tools listed and unlocked for a
  paid account, one tool completing a real Manual Mode round trip, a malformed
  response writing nothing, the tools locked rather than broken for a free
  account, and the nav entry resolving
- `security.spec.ts` — cross-tenant access, entitlement bypass, admin boundary

Mobile:

- `responsive.spec.ts` — mobile navigation, reachability, absence of horizontal
  overflow at 375px

## Writing tests

- Domain rules are pure functions; test them without a database.
- Test behaviour, not implementation. Assert the coverage state and the reason,
  not which helper produced them.
- Every bug fix gets a regression test. Two real ones:
  - the evidence matrix must report `SKIP` when a mandatory certification is
    missing, exactly as the CPA example in the specification describes
  - the Manual Mode panel must not claim "Analysis saved" before the user has
    actually submitted anything

## Debugging a failure

Playwright writes `test-results/<test>/error-context.md` with a page snapshot,
plus a trace. Read the snapshot first; it usually shows the real state. Then:

```bash
npx playwright show-trace test-results/<test>/trace.zip
```

Vitest failures print the diff; integration failures usually mean the test
database is out of date, so re-run `npm run db:deploy`.
