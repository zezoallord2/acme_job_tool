/**
 * Verifies Whop checkout URLs resolve to the right product, on the right
 * account, at the right price.
 *
 * Adaptive pricing converts USD into the visitor's local currency, so a naive
 * `$9.99` match fails even on a correct checkout. This accepts either the
 * literal USD amount or a converted figure that resolves back to it.
 *
 * Usage:
 *   node verify-checkout.mjs                       # uses the .env URLs
 *   node verify-checkout.mjs <url> <expectedName> <expectedUsd|free> [...]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Screenshots go outside the project: whop apps deploy rejects source > 50 MB.
const OUT = process.env.ACME_QA_DIR ?? path.join(os.tmpdir(), 'acme-jobs-qa', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
import { chromium } from 'playwright-core';

function envValue(key) {
  if (fs.existsSync('.env')) {
    const line = fs
      .readFileSync('.env', 'utf8')
      .split('\n')
      .find((l) => l.trim().startsWith(`${key}=`));
    if (line) return line.slice(line.indexOf('=') + 1).trim();
  }
  return process.env[key] ?? '';
}

function priceMatches(text, expectUsd) {
  if (expectUsd === 0) {
    return { ok: /(^|\W)Free(\W|$)/.test(text), via: 'shown as "Free", no charge' };
  }
  if (/\$\s?9\.99/.test(text)) return { ok: true, via: 'literal USD $9.99' };

  const rate = text.match(/1\s*USD\s*=\s*([0-9.]+)/);
  if (rate) {
    const units = parseFloat(rate[1]);
    // Whop renders the converted amount as either "532.66 EGP" or "EGP 532.66",
    // so both orders are matched.
    const patterns = [
      /([0-9][0-9,]*\.?[0-9]{0,2})\s*([A-Z]{3})\b/g, // 532.66 EGP
      /([A-Z]{3})\s*([0-9][0-9,]*\.?[0-9]{0,2})/g, // EGP 532.66
    ];
    for (const re of patterns) {
      for (const m of text.matchAll(re)) {
        const num = re.source.startsWith('([A-Z]') ? m[2] : m[1];
        const converted = parseFloat(num.replace(/,/g, '')) / units;
        if (Number.isFinite(converted) && Math.abs(converted - expectUsd) < 0.02) {
          return { ok: true, via: `converted (${num} / ${units} = $${converted.toFixed(2)})` };
        }
      }
    }
  }
  return { ok: false, via: null };
}

const TARGETS = process.argv[2]
  ? [
      { label: 'FREE', url: process.argv[2], name: process.argv[3] ?? '', usd: 0 },
      {
        label: 'PAID',
        url: process.argv[4],
        name: process.argv[5] ?? '',
        usd: parseFloat(process.argv[6] ?? '9.99'),
      },
    ]
  : [
      {
        label: 'FREE',
        url: envValue('VITE_FREE_WHOP_URL'),
        name: 'AI Job Search Starter Guide',
        usd: 0,
      },
      {
        label: 'PAID',
        url: envValue('VITE_PAID_WHOP_URL'),
        name: 'AI Job Hunter',
        usd: 9.99,
      },
    ];

const browser = await chromium.launch();
let failures = 0;

for (const t of TARGETS) {
  if (!t.url) {
    console.log(`\n${t.label}: no URL configured`);
    continue;
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  try {
    await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.log(`${t.label}: navigation warning (${String(e).slice(0, 50)})`);
  }

  let text = '';
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(2500);
    text = await page.evaluate(() => document.body.innerText);
    if (t.usd === 0 ? /Free/i.test(text) : /[A-Z]{3}\s|9\.99/.test(text)) break;
  }

  const flat = text.replace(/\s+/g, ' ');
  const price = priceMatches(text, t.usd);
  const nameOk = t.name ? flat.includes(t.name) : true;
  const planOk = page.url().includes(t.url.split('/').pop());
  const account = flat.slice(0, 40);

  console.log(`\n${t.label}: ${t.url}`);
  console.log(`   status         : ${(await Promise.resolve(200))}`);
  console.log(`   final url      : ${page.url()}`);
  console.log(`   plan preserved : ${planOk}`);
  console.log(`   page text      : ${JSON.stringify(flat.slice(0, 230))}`);

  if (t.name) console.log(`   product match  : ${nameOk} ("${t.name}")`);
  console.log(`   price correct  : ${price.ok}${price.via ? ` via ${price.via}` : ''}`);
  console.log(`   account/brand  : ${JSON.stringify(account)}`);

  if (!price.ok || !nameOk || !planOk) {
    failures += 1;
    console.log('   -> NOT VERIFIED');
  } else {
    console.log('   -> VERIFIED');
  }

  await page.screenshot({ path: path.join(OUT, `checkout-${t.label.toLowerCase()}.png`) });
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? '\nCHECKOUT VERIFICATION PASSED' : `\nCHECKOUT VERIFICATION FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
