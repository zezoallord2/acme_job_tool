# Zero-Cost Mode

Acme Jobs runs with **$0 mandatory recurring cost**. This document explains how
that is guaranteed and what changes if you pay for something.

## The rule

No core user-facing workflow may require a paid, network-dependent third party.
If a paid service is unreachable or unconfigured, the product still works end to
end.

## What this means in practice

| Concern              | Zero-cost default                | Paid option (optional)          |
| -------------------- | -------------------------------- | ------------------------------- |
| AI                   | `ManualAIProvider`               | Local Ollama, BYOK, Acme-funded |
| Queue                | `PostgresJobQueue`               | None needed                     |
| Auth                 | Argon2id + DB sessions           | None needed                     |
| File storage         | Local filesystem                 | S3-compatible                   |
| Email                | In-app notifications             | SMTP                            |
| Observability        | Local JSON logs + DB             | Any log shipper                 |
| Analytics            | Internal PostgreSQL              | None needed                     |
| Billing/entitlements | `ManualAdminEntitlementProvider` | Whop webhook                    |
| Rate limiting        | Database                         | None needed                     |

## Manual AI Mode is a complete product, not a placeholder

Manual Mode covers every AI workflow:

- Job description analysis
- Resume tailoring
- Cover letter generation
- Application answer writing
- Interview question generation
- Interview answer coaching
- Gap and weakness analysis
- Career narrative
- Achievement mining

The flow is always the same:

1. Acme Jobs renders a prompt with a `promptVersion` and a JSON schema.
2. The prompt is copied to any assistant, or answered by hand.
3. The response is pasted back.
4. Validation is identical to a programmatic provider: strict schema, Zod, and a
   disclose-on-repair policy.

Switching between Manual Mode and a provider does not change validation. A
response that would be rejected from an API is rejected from a paste.

## Reading an uploaded job description

TXT, MD, PDF and DOCX uploads are parsed on your own machine by the background
worker. There is no OCR service and no document API in the stack.

DOCX is a ZIP of XML, so `word/document.xml` is inflated with `node:zlib` and the
tags are stripped. PDF content streams are inflated and scanned for text
operators. A scanned PDF with no embedded text layer cannot be read, and the
worker reports exactly that instead of returning an empty description — paste the
text in that case.

## Local AI

Ollama is supported through its native local `/api/chat` and `/api/tags`
endpoints.

The included `ollama/Modelfile` creates an evidence-first `acme-jobs` model on
top of `gemma3:1b` (about 815 MB in Ollama). Install Ollama and run
`npm run ai:local:setup`, then keep `LOCAL_AI_BASE_URL` and `LOCAL_AI_MODEL` at
their defaults. If the endpoint is
unreachable, the router falls back to Manual Mode instead of failing the request.

Ollama runs on the computer or server hosting Acme Jobs. It does **not** run in
the browser and customer phones do not download the model. A public Vercel
deployment must call a separate HTTPS inference host or a managed AI provider;
Whop handles checkout and entitlements, not model compute. Remote endpoints are
blocked by default. Only set `LOCAL_AI_ALLOW_REMOTE=true` for a trusted,
authenticated, TLS-protected endpoint that you operate.

## Bring your own key

Set any of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`,
`OPENROUTER_API_KEY`. Keys are encrypted at rest with `KEY_ENCRYPTION_SECRET` and
are billed to your own provider account. Acme Jobs has no key for these
services, and the settings page states the cost responsibility explicitly.

`ACME_AI_ENABLED=false` disables Acme-funded AI entirely.

## Enforcing it

- `ZERO_COST_MODE=true` rejects any configuration that would send a request to
  an Acme-funded provider.
- `ALLOW_AUTO_REPAIR_IN_ENV` defaults to `local_dev`. Automatic repair execution
  is refused outside a local environment; in containers it is `none`.
- The Docker Compose file pins every service to a free image and sets
  `ACME_AI_ENABLED=false`.
- `npm run test:security` fails if a zero-cost default regresses.

## What a hosted deployment changes

A hosted deployment needs a machine and a database, which is an unavoidable fixed
cost. Everything else stays optional. If you want zero fixed cost as well, run it
on hardware you already own — the entire stack is PostgreSQL plus one Node
process plus one worker.
