# Whop Go-Live Checklist

Acme Jobs can accept Whop webhooks for purchases, renewals, refunds, and
cancellations. Everything that can be verified without your Whop account is
verified: HMAC signature checks, replay protection, account linking, idempotent
entitlement grants, held-event reconciliation, and negative authorization
tests. What this checklist covers is the part that can only be proven with
**your** live credentials and a **real** purchase.

## 1. Prerequisites

- A deployed Acme Jobs instance on a public HTTPS URL.
- A Whop business account with at least one product/plan priced at $0 or a real
  plan you are prepared to buy during the test.
- Your Whop webhook signing secret (Whop dashboard → Developer → Webhooks).

Set in production:

```
APP_URL=https://your-domain.example
WHOP_WEBHOOK_SECRET=<from the Whop dashboard>
BILLING_PROVIDER=whop
BILLING_LINK_SECRET=<32+ random characters, distinct from AUTH_SECRET>
```

`npm run production:check` must report `READY TO DEPLOY.` before you continue.

## 2. Register the endpoint

1. In whatever Whop plan/product represents your Pro offer, set the return URL
   to `https://your-domain.example/app/settings`. A successful purchase returns
   the buyer to Settings with a signed `?token=...` query string; the Settings
   page shows a "Link this purchase to my account" control that POSTs the token
   to `/api/billing/link` and reconciles any events that arrived beforehand.
2. Add a webhook endpoint in the Whop dashboard pointing to:

   ```
   https://your-domain.example/api/webhooks/billing
   ```

3. Subscribe to all event types the Whop dashboard offers (purchases,
   renewals, cancellations, expirations, refunds). The endpoint records any
   Whop event shape and maps it onto entitlement grants/revokes; nothing extra
   needs configuring per event.

## 3. Linking the buyer to a local account

Acme Jobs identifies a buyer by the Whop user id stored on their billing link.
New users are linked when the buyer lands on `/app/settings?token=...` after
checkout and confirms the link, or when an operator mints a return URL via
`PUT /api/billing/link` and the buyer follows it.

If no match can be made, the event is **held**, not lost: it appears on
`/admin/billing` with state `HELD` and is replayed automatically once the
account is connected (`src/lib/billing-link.ts` → `/api/billing/link`).

## 4. The real purchase test

1. Sign out of Whop and make a fresh purchase with a test customer whose email
   you then sign into.
2. Confirm in Whop that the webhook was delivered with a 200 response.
3. On `/admin/billing`, search the event by Whop event id. State should be
   `APPLIED` and an entitlement row present.
4. Visit `/app` as the buyer and confirm the Pro features are unlocked.
5. Resend the same event from the Whop dashboard. State should become
   `DUPLICATE` and the entitlement must not change.
6. Issue a refund in Whop. A refund event should set the entitlement to
   `canceled`/`refunded` and remove Pro access.

## 5. Failure drills

- Temporarily set the wrong `WHOP_WEBHOOK_SECRET`, send a test event, and
  confirm the webhook returns 401 and no entitlement is granted. Restore the
  correct secret afterwards.
- Create a user with the same email but a different purchase id and confirm
  their events never appear on the other user's diagnostics view.
- Delete the user row and confirm events go to `USER_NOT_LINKED`, not to a
  successful state.

## 6. Acceptance

Record results in your release notes, e.g.:

| Check                                  | Result    |
| -------------------------------------- | --------- |
| Signed purchase event applied a grant  | pass/fail |
| Replay is a duplicate, no double grant | pass/fail |
| Refund revokes access                  | pass/fail |
| Bad signature rejected, event held     | pass/fail |
| Held event replays after account link  | pass/fail |

Only advertise live billing once every row is `pass`.
