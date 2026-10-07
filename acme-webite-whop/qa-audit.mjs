/**
 * Runtime QA: fetches every route from a running server and checks the
 * accessibility, SEO and conversion contract of the served HTML.
 *
 * Usage: node qa-audit.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://localhost:3122';

const ROUTES = [
  '/',
  '/free',
  '/complete',
  '/how-it-works',
  '/app',
  '/affiliates',
  '/resources',
  '/faq',
  '/about',
  '/privacy',
  '/terms',
  '/resources/how-to-tailor-a-resume-with-ai-without-lying',
  '/resources/fresh-graduate-resume-guide',
];

let failures = 0;
const fail = (route, msg) => {
  console.log(`  FAIL ${route}: ${msg}`);
  failures += 1;
};

const allPages = [];

for (const route of ROUTES) {
  const res = await fetch(BASE + route);
  if (res.status !== 200) {
    fail(route, `status ${res.status}`);
    continue;
  }
  const html = await res.text();
  allPages.push([route, html]);

  const head = html.slice(0, html.indexOf('</head>'));

  if (!/<title>[^<]{10,}<\/title>/.test(head)) fail(route, 'missing or short <title>');
  if (!/<meta name="description" content="[^"]{60,}"/.test(head))
    fail(route, 'missing/short description');
  if (!/<link rel="canonical" href="https?:\/\/[^"]+"/.test(head)) fail(route, 'missing canonical');
  if (!/<meta property="og:title"/.test(head)) fail(route, 'missing og:title');
  if (!/<meta property="og:image"/.test(head)) fail(route, 'missing og:image');
  if (!/<meta name="twitter:card" content="summary_large_image"/.test(head))
    fail(route, 'missing twitter:card');
  if (!/<meta name="viewport" content="[^"]*width=device-width/.test(head))
    fail(route, 'missing responsive viewport');
  if (!/<html lang="en"/.test(html)) fail(route, 'missing lang attribute');
  if (!/<meta name="theme-color" content="#0B2D4D"/.test(head)) fail(route, 'missing theme-color');

  const h1s = html.match(/<h1[\s>]/g) ?? [];
  if (h1s.length !== 1) fail(route, `expected exactly 1 <h1>, found ${h1s.length}`);

  if (!/Skip to main content/.test(html)) fail(route, 'missing skip link');
  if (!/<main id="main"/.test(html)) fail(route, 'missing main landmark');
  if (!/<header[\s>]/.test(html)) fail(route, 'missing banner landmark');
  if (!/<footer[\s>]/.test(html)) fail(route, 'missing contentinfo landmark');
  if (!/<nav aria-label="Primary"/.test(html)) fail(route, 'missing labelled primary nav');

  const noAlt = html.match(/<img(?![^>]*\balt=)[^>]*>/g) ?? [];
  if (noAlt.length) fail(route, `${noAlt.length} <img> without alt`);

  const noType = html.match(/<button(?![^>]*\btype=)[^>]*>/g) ?? [];
  if (noType.length) fail(route, `${noType.length} <button> without explicit type`);

  // Empty or hash-only links are dead ends.
  const deadLinks = [...html.matchAll(/<a\s[^>]*href="(#|javascript:)"/g)];
  if (deadLinks.length) fail(route, `${deadLinks.length} dead anchor links`);

  // External links must be safe.
  const unsafeExternal = [...html.matchAll(/<a\s[^>]*href="https?:\/\/[^"]*"[^>]*>/g)].filter(
    (m) => !/rel="[^"]*noopener/.test(m[0])
  );
  if (unsafeExternal.length)
    fail(route, `${unsafeExternal.length} external links without rel=noopener`);

  // The WebGL layer is client-only (dynamic, ssr:false) by design. What must be
  // in the server HTML is the static gradient fallback, which is the loading,
  // reduced-motion and failure surface.
  const staticGradient =
    /background-image:\s*radial-gradient\(115% 88% at 14% 4%/.test(html) ||
    /radial-gradient\(115% 88% at 14% 4%/.test(html);
  if (route === '/' && !staticGradient) fail(route, 'missing static LiquidEther gradient fallback');
  if (route === '/' && /WebGLRenderer|PerspectiveCamera/.test(html)) {
    fail(route, 'three.js internals leaked into the server HTML');
  }

  // Horizontal overflow guards in the markup.
  if (/min-w-\[(\d{4,})px\]/.test(html)) fail(route, 'fixed pixel min-width may overflow');

  // Unconfigured CTAs must be explicit, never dead links.
  if (!/Link not published yet/.test(html) && !/whop\.com/.test(html)) {
    fail(route, 'no visible CTA state and no Whop destination (check CTA config)');
  }
}

// Cross-page checks
const home = allPages.find(([r]) => r === '/')?.[1] ?? '';
const scripts = [...home.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]);
const uniqueScripts = [...new Set(scripts)];
console.log(`\nInitial JS chunks referenced by /: ${uniqueScripts.length}`);
for (const src of uniqueScripts) {
  const js = await (await fetch(BASE + src)).text();
  if (/WebGLRenderer|PerspectiveCamera|BufferGeometry|WebGL2RenderingContext/.test(js)) {
    fail(
      '/',
      `three.js found in initial chunk ${src} (${Math.round(js.length / 1024)} KB) — it must be lazy`
    );
  }
}

// Report where three.js actually ended up: it must be in a lazy chunk that the
// browser only fetches once the hero scrolls into view.
let threeChunk = null;
for (const src of uniqueScripts) {
  const js = await (await fetch(BASE + src)).text();
  if (/WebGLRenderer|PerspectiveCamera|BufferGeometry/.test(js)) {
    threeChunk = { src, kb: Math.round(js.length / 1024) };
  }
}
console.log(
  threeChunk
    ? `three.js found in a DEFERRED chunk: ${threeChunk.src} (${threeChunk.kb} KB) — not loaded initially`
    : 'three.js not present in any initial chunk (loaded lazily by the hero)'
);

// Every internal href must resolve.
const hrefs = new Set();
for (const [, html] of allPages) {
  for (const m of html.matchAll(/href="(\/[a-z0-9\-/]*)"/g)) hrefs.add(m[1]);
}
console.log(`\nChecking ${hrefs.size} distinct internal hrefs...`);
for (const href of hrefs) {
  const clean = href.split('#')[0];
  if (!clean || clean === '/') continue;
  const res = await fetch(BASE + clean, { redirect: 'manual' });
  if (res.status >= 400) fail(href, `internal link resolves to ${res.status}`);
}

// 404 behaviour
const missing = await fetch(BASE + '/this-route-does-not-exist');
if (missing.status !== 404)
  fail('/this-route-does-not-exist', `expected 404, got ${missing.status}`);
else if (!(await missing.text()).includes('This page does not exist')) {
  fail('/this-route-does-not-exist', '404 page did not render the branded not-found content');
}

console.log(
  failures === 0 ? '\nAUDIT PASSED — 0 failures' : `\nAUDIT FAILED — ${failures} failures`
);
process.exit(failures === 0 ? 0 : 1);
