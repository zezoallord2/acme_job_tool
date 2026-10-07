# Acme Jobs â€” Whop-hosted site

**Live:** https://acme-jobs.whop.site

This is the **Whop-hosted** build of the Acme Jobs marketing site: TanStack Start
(SSR) on Vite, served from Cloudflare Workers, deployed with `whop apps deploy`
to `app_RuqJ0gn3F8qBVM` (route `acme-jobs`).

The original Next.js build still exists in `../acme webite` and is deployed to
Vercel. Both are live; this one is the intended long-term home because
`acme-jobs.whop.site` is a real branded domain that can be shared on TikTok,
Pinterest and in affiliate links.

---

## Why this stack

Whop's app host (`whop apps deploy`) accepts **Vite** projects only and serves
them from Cloudflare Workers. A Next.js App Router project is rejected outright:

```
code: NOT_A_VITE_APP
"doesn't look like a Vite app (missing package.json or vite config)"
```

`whop apps init` scaffolds **TanStack Start**, which is a Vite-native React
framework with SSR. That matters: SSR is what keeps `<title>`, meta description,
canonical, OpenGraph tags, JSON-LD and the full page content in the HTML a
crawler receives, exactly as the Next.js build did. A plain SPA would have lost
all of that.

---

## Commands

```bash
npm install
npm run dev              # local dev
npm run build            # production build (also packs dist/whop-build.zip)
npm run deploy           # whop apps deploy --app app_RuqJ0gn3F8qBVM
npm run typecheck        # tsc --noEmit

npm run generate-routes  # regenerate src/routeTree.gen.ts after adding a route
npm run emit:og          # regenerate the OG card PNGs into public/
npm run emit:seo         # regenerate public/sitemap.xml + public/robots.txt
```

`emit:seo` needs the origin:

```bash
# PowerShell
$env:NEXT_PUBLIC_SITE_URL = "https://acme-jobs.whop.site"; npm run emit:seo
```

### QA

```bash
npm run qa:audit    # SEO + a11y + internal links against a running server
npm run qa:visual   # Playwright: 320/390/768/1440, a11y, interactions
npm run qa:live     # probes the deployed URL end to end
npm run qa:slice    # slices tall screenshots for review
npm run qa:frame    # confirms the site can be framed (Whop dashboard preview)
```

---

## Configuration

`.env` holds **public** build-time values, inlined by Vite with the `VITE_`
prefix. There are no secrets in it.

| Variable | Purpose |
| --- | --- |
| `VITE_SITE_URL` | Canonical origin. Must match the served URL or canonicals/sitemap are wrong. |
| `VITE_FREE_WHOP_URL` | Free checkout. `https://whop.com/checkout/plan_KGrX4zi3Xfwjl` |
| `VITE_PAID_WHOP_URL` | Paid checkout. `https://whop.com/checkout/plan_o3nDium62V40t` |
| `VITE_AFFILIATE_URL` | `https://whop.com/acme-jobs/affiliates/` |
| `VITE_APP_WAITLIST_ENABLED` | `false` until a webhook is configured |
| `VITE_WAITLIST_PROVIDER` | `disabled` â€” Workers has no writable filesystem |

Runtime secrets go through Whop, not the bundle:

```bash
whop apps secrets add WAITLIST_WEBHOOK_URL https://your-form-endpoint
```

With that set, flip `VITE_APP_WAITLIST_ENABLED=true` and `VITE_WAITLIST_PROVIDER=webhook`,
rebuild, and `/app` starts collecting emails.

---

## What changed in the port

| Next.js | TanStack Start equivalent |
| --- | --- |
| `app/**/page.tsx` | `src/routes/**.tsx` via `createFileRoute` |
| `app/layout.tsx` | `src/routes/__root.tsx` (`shellComponent`) |
| `app/not-found.tsx` | root `notFoundComponent` |
| `export const metadata` | `head: () => headFor({...})` in `src/lib/head.ts` |
| `next/link` | `src/components/link.tsx` (wraps TanStack `Link`) |
| `next/image` | `src/components/image.tsx` |
| `next/dynamic({ssr:false})` | `React.lazy` + `<Suspense>` |
| `next/font/google` | system font stack in `--font-sans` |
| `app/api/waitlist/route.ts` | `createServerFn` RPC in `src/lib/waitlist-fn.ts` |
| `opengraph-image.tsx` (`next/og`) | static PNGs via `scripts/generate-og.ts` |
| `app/sitemap.ts` / `robots.ts` | `scripts/emit-static-seo.ts` â†’ `public/` |
| `process.env.NEXT_PUBLIC_*` | `import.meta.env.VITE_*` via `read()` in `src/lib/config.ts` |

All components, copy, product data, articles and styling are shared with the
Next.js build unchanged.

---

## Two Whop platform behaviours to know

**1. Whop overrides `<title>`.** The hosting layer injects a script that forces
`document.title` to the app name and re-applies it on every DOM mutation:

```js
}(/* app name */"Acme Jobs â€” AI Job Search", null, null);
```

Consequences:
- The **root route's** SSR title is the app name, so the app name is the
  homepage's indexed title. It is deliberately descriptive for that reason.
- After **client-side navigation** the title is the app name on every page.
  Direct requests (what crawlers and social unfurlers do) still get each
  page's correct full title. Verified: SSR `/free` â†’ the real title; CSR `/free`
  â†’ the app name.

**2. `*.whop.site` needs a route.** `acme-jobs.whop.site` only serves the app
because `route: acme-jobs` is set on it. Without a route the domain shows
Whop's "is empty for now" placeholder.

---

## Deployment contract

`whop apps deploy` uploads the **source archive**, so the working tree must stay
small. `qa-screenshots` is ~93 MB on its own and once pushed the deploy failed:

```
code: DEPLOY_FAILED
message: File size exceeds the maximum allowed size of 50 MB
```

Both `qa-screenshots` and `qa-slices` are in `.gitignore`. Keep it that way, and
keep `dist` out of any commit.

Current source footprint: well under 2 MB.

---

## Verification status

Against the live `https://acme-jobs.whop.site`:

- `qa:audit` â€” 0 failures
- `qa:live` â€” 12 routes + 5 static assets + 404 + sitemap, all pass
- `qa:visual` â€” 0 failures at 320 / 390 / 768 / 1440 px
- `typecheck` â€” 0 errors
- Zero disabled CTAs; all three Whop destinations live
- three.js remains a deferred chunk, not in any initial bundle
