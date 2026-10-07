/**
 * Live-site probe: confirms the deployed URL serves real content with correct
 * SEO, real CTAs and no disabled states.
 *
 * Usage: node verify-live.mjs <baseUrl>
 */
const BASE = process.argv[2] ?? 'https://acme-jobs.whop.site';

const ROUTES = [
  '/',
  '/free',
  '/complete',
  '/how-it-works',
  '/app',
  '/affiliates',
  '/resources',
  '/resources/star-interview-method-practical-examples',
  '/faq',
  '/about',
  '/privacy',
  '/terms',
];

let failures = 0;

for (const route of ROUTES) {
  const res = await fetch(BASE + route, { redirect: 'follow' });
  const html = await res.text();

  const title = (html.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? '';
  const canonical = (html.match(/rel="canonical" href="([^"]*)"/) ?? [])[1] ?? '';
  const desc = (html.match(/name="description" content="([^"]*)"/) ?? [])[1] ?? '';
  const h1Raw = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1] ?? '';
  const h1 = h1Raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const disabled = (html.match(/aria-disabled="true"/g) ?? []).length;
  const ld = (html.match(/application\/ld\+json/g) ?? []).length;
  const whop = [...new Set([...html.matchAll(/href="(https:\/\/whop\.com\/[^"]+)"/g)].map((m) => m[1]))];

  const problems = [];
  if (res.status !== 200) problems.push(`status ${res.status}`);
  if (!title) problems.push('no <title>');
  if (!desc) problems.push('no description');
  if (!canonical.startsWith('https://')) problems.push(`canonical not absolute: ${canonical}`);
  if (!h1) problems.push('no <h1>');
  if (disabled > 0) problems.push(`${disabled} disabled CTAs`);
  if (ld < 1) problems.push('no JSON-LD');
  if (whop.length < 2) problems.push(`expected 2+ whop links, found ${whop.length}`);

  const mark = problems.length ? 'FAIL' : 'ok  ';
  console.log(`${mark} ${route.padEnd(50)} ${title.slice(0, 58)}`);
  console.log(`     canonical ${canonical}`);
  console.log(`     h1 "${h1.slice(0, 62)}"  jsonld=${ld} disabled=${disabled} whopLinks=${whop.length}`);

  for (const p of problems) {
    console.log(`     -> ${p}`);
    failures += 1;
  }
}

// Static assets
for (const asset of ['/og.png', '/free/og.png', '/icon.svg', '/robots.txt', '/sitemap.xml']) {
  const res = await fetch(BASE + asset);
  const ok = res.status === 200;
  if (!ok) {
    console.log(`FAIL ${asset} -> ${res.status}`);
    failures += 1;
  } else {
    console.log(`ok   ${asset.padEnd(50)} ${res.headers.get('content-type')}`);
  }
}

// 404 behaviour
const missing = await fetch(BASE + '/definitely-not-a-page');
const missingHtml = await missing.text();
const notFoundOk = missing.status === 404 && /does not exist/i.test(missingHtml);
console.log(`${notFoundOk ? 'ok  ' : 'FAIL'} 404 page                        status ${missing.status}`);
if (!notFoundOk) failures += 1;

// sitemap integrity
const sitemap = await (await fetch(BASE + '/sitemap.xml')).text();
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const allOnWhop = locs.every((l) => l.startsWith(BASE));
console.log(`${allOnWhop ? 'ok  ' : 'FAIL'} sitemap                         ${locs.length} urls, all on ${BASE}: ${allOnWhop}`);
if (!allOnWhop) failures += 1;

console.log(failures === 0 ? '\nLIVE VERIFICATION PASSED' : `\nLIVE VERIFICATION FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
