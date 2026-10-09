# Acme Jobs hosting

The current application runs on Vercel at https://acme-jobs-vercel.vercel.app/login. The deployment branch is codex/netlify-supabase and vercel.json selects Frankfurt (fra1), next to Supabase.

Supabase project hgpzpmqjzblzgxnihhsw stores PostgreSQL and the private acme-files bucket. Credentials are server-only Vercel environment secrets. APP_URL uses the Vercel public origin. Guide purchases still do not automatically grant app entitlements; billing integration and production password-reset mail remain separate setup work.

Whop's storefront at https://acme-jobs.whop.site links directly to Vercel. The Cloudflare acme-jobs Worker redirects old workers.dev bookmarks to the matching Vercel path. It stores no app credentials.

The former Netlify site acme-jobs-app is disabled and automatic builds are stopped after cutover. Its resources are retained for recovery. Vercel's current account is Hobby, whose published rules restrict it to non-commercial use; no paid plan was activated.
