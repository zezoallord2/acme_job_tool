# Production Smoke Test

Run this after every deploy, in this order. Do not change the order; each step
depends on the one before it. Everything here except step 6 (Whop) works without
paid services.

## 0. Preflight

```bash
npm run production:check
```

Expected ending: `READY TO DEPLOY.` or `DEPLOYABLE with warnings.` (a `WARNING`
for a known operational choice is acceptable; any `FAIL` is not — fix it and
re-run.)

## 1. Health

```bash
curl -fsS "https://your-domain.example/api/health?strict=1"
```

Expected: HTTP 200 and JSON with `"ok": true`. Any other status means the app
booted but cannot serve traffic: check the server logs and the migration step.

## 2. Auth round trip

1. Sign up a fresh account at `https://your-domain.example/signup`.
2. Confirm the session cookie is set (`HttpOnly`, `Secure`,
   `SameSite=Lax` — inspect in browser devtools).
3. Sign out, then sign in again.
4. Sign in once with a wrong password and confirm a generic failure message, not
   an account-existence leak.

## 3. Manual AI core flow

1. Add a job with a real posting URL or paste the description directly.
2. Run analysis in Manual Mode and confirm a fit report renders.
3. Add another job, upload a resume (`.pdf`/`.docx`/`.txt`/`.md`), and confirm
   the parsed text appears.
4. Generate a follow-up email in Writing Studio.

None of these steps may require an AI API key. If one does, the zero-cost path
is broken — file a bug before launch.

## 4. Storage round trip (MODE B / S3 deployments only)

Upload the resume again, then delete the upload. Confirm in your bucket console
that the object under `uploads/<user-id>/` is gone. A stale object here means
the delete path is not owner-scoped correctly. (MODE A deployments can repeat
on the mounted volume at `DATA_DIR/uploads` instead.)

## 5. Transactional mail

1. Request a password reset for the fresh account.
2. Confirm the email arrives from `MAIL_FROM_ADDRESS`, links to
   `/reset-password?token=...`, and the new password sticks at sign-in.
3. Confirm requesting a second reset invalidates the first link.

## 6. Whop (once, with real credentials)

Follow [WHOP_GO_LIVE.md](WHOP_GO_LIVE.md). Do not skip it because it is manual.

## 7. Abuse and limits

- Hit `/api/webhooks/billing` with a garbage body and confirm a 400/401, never a 500.
- Submit the login form more than the rate limit in a minute and confirm a 429
  and a wait message.

## Expected log noise

The idempotency `UNIQUE` constraint error on duplicate queue jobs is expected
under retry. Structured logs outside `data/logs` are a sign of the logger
being bypassed — investigate.

## Passing

Record `pass` per step in your release notes. `PRODUCTION CLOSEOUT STATUS`
should only report `OPERATIONALLY READY` once steps 0–5 and 7 pass and step 6 is
recorded from a real run.
