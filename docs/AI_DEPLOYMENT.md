# AI deployment roles

Acme Jobs deliberately separates the product into four responsibilities:

| Service                      | Responsibility                                    | Runs the model?              |
| ---------------------------- | ------------------------------------------------- | ---------------------------- |
| Customer browser or phone    | Displays the UI and sends requests                | No                           |
| Vercel (or another web host) | Runs Next.js pages and API/server actions         | No persistent Ollama process |
| Whop                         | Checkout, purchase state and entitlement webhooks | No                           |
| AI inference host/provider   | Loads the model and returns generated text        | Yes                          |

## Local development

Ollama listens on `127.0.0.1:11434` and the bundled `acme-jobs` model is based
on Gemma 3 1B. This is the lightweight path for development and private
self-hosting. Keep Ollama bound to loopback; do not expose port 11434 to the
internet.

## Public production

Do not route customer traffic through a developer laptop. Deploy the web app to
Vercel and configure one of these inference paths:

1. A managed AI provider through the existing BYOK adapters.
2. A separate HTTPS inference server you operate. It must require
   authentication at its edge, restrict inbound traffic, encrypt transport,
   apply rate limits and avoid retaining career data in logs.

`LOCAL_AI_ALLOW_REMOTE` remains `false` by default. A remote URL must use HTTPS
and also requires `LOCAL_AI_API_KEY`; Acme Jobs sends it as a bearer token. Put
a secure authenticated gateway that validates that token in front of Ollama,
or use a provider adapter designed for production.

Manual Mode remains the no-compute fallback. Every provider response is still
treated as untrusted input and passes through workflow schema and evidence
validation before persistence.
