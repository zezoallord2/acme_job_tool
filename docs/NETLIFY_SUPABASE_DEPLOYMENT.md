# Acme Jobs hosting

The live app opens at https://acme-jobs.acmejobs-zezo.workers.dev/login.
Cloudflare's acme-jobs Worker forwards requests to the Netlify Next.js deployment at https://acme-jobs-app.netlify.app. This provides an accessible entry URL where the Netlify hostname times out.

Supabase project hgpzpmqjzblzgxnihhsw runs PostgreSQL and the private acme-files bucket. Database and S3 credentials belong only in Netlify server environment variables. APP_URL must use the public Cloudflare URL. The proxy contains no app credentials and preserves foreign Origin headers so app CSRF checks still reject them.

The deployment branch is codex/netlify-supabase. Pushes rebuild Netlify using the Next.js runtime plugin. Deploy the proxy source cloudflare/netlify-proxy.mjs through the existing Cloudflare account; keep API tokens outside Git.

Whop's storefront links to the app. Guide checkout purchases do not automatically grant app entitlements; payment integration and production password-reset email delivery still require configuration. Manual admin grants can enable Complete accounts.
