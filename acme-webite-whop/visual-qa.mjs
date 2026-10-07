/**
 * Visual + interaction QA.
 *
 * Boots the production server, then for every route and every breakpoint:
 *   - captures a full-page screenshot
 *   - measures real horizontal overflow (document vs viewport)
 *   - asserts the LiquidEther canvas mounts and stays click-through
 *   - checks tap-target sizes and that no CTA is covered
 *   - reports console errors and failed requests
 *
 * Usage: node visual-qa.mjs [baseUrl]
 */
import { chromium, devices } from 'playwright-core';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:3124';
const OUT = process.env.ACME_QA_DIR ?? path.join(os.tmpdir(), 'acme-jobs-qa', 'screenshots');

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
  '/resources/star-interview-method-practical-examples',
  '/not-a-real-page',
];

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
  { name: 'mobile-small', width: 320, height: 640, isMobile: true, deviceScaleFactor: 2 },
  { name: 'tablet', width: 768, height: 1024, isMobile: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1440, height: 900, isMobile: false, deviceScaleFactor: 1 },
];

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: undefined,
  args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader'],
});

let failures = 0;
const fail = (msg) => {
  console.log(`  FAIL ${msg}`);
  failures += 1;
};

for (const vp of VIEWPORTS) {
  console.log(`\n================ ${vp.name} (${vp.width}x${vp.height}) ================`);
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    deviceScaleFactor: vp.deviceScaleFactor,
  });

  for (const route of ROUTES) {
    const page = await context.newPage();
    const consoleErrors = [];
    const failedRequests = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
    });
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + String(err).slice(0, 200)));
    page.on('requestfailed', (req) =>
      failedRequests.push(`${req.url().slice(-70)} :: ${req.failure()?.errorText ?? '?'}`)
    );

    const response = await page.goto(BASE + route, { waitUntil: 'load', timeout: 45000 });
    const status = response?.status() ?? 0;

    // Let the lazy WebGL layer mount.
    await page.waitForTimeout(2200);

    // ---- horizontal overflow ----
    // Two independent checks:
    //  1. The page must not be able to scroll sideways at all.
    //  2. No text or control may extend past the layout viewport. Decorative
    //     bleeds inside a clipping section are legitimate and are excluded.
    const overflow = await page.evaluate(async () => {
      const html = document.documentElement;
      const clientW = html.clientWidth;

      window.scrollTo(400, window.scrollY);
      await new Promise((r) => setTimeout(r, 120));
      const scrolledX = window.scrollX;
      window.scrollTo(0, window.scrollY);

      function clippedInsideSection(el) {
        let node = el.parentElement;
        while (node && node !== document.body) {
          const cs = getComputedStyle(node);
          if (/hidden|clip|auto|scroll/.test(cs.overflowX)) return true;
          node = node.parentElement;
        }
        return false;
      }

      const offenders = [];
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right <= clientW + 0.5) continue;
        if (clippedInsideSection(el)) continue;
        // Only care about elements that carry content or interaction.
        const hasText = [...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim().length > 0
        );
        const interactive = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
        if (!hasText && !interactive) continue;
        offenders.push(
          `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 70)}"> [${Math.round(r.left)}..${Math.round(r.right)}] "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)}"`
        );
        if (offenders.length >= 5) break;
      }

      return { clientW, scrolledX, offenders };
    });

    if (overflow.scrolledX > 0) {
      fail(`${route} the page scrolls horizontally by ${overflow.scrolledX}px`);
    }
    if (overflow.offenders.length) {
      fail(
        `${route} content extends past the ${overflow.clientW}px viewport:\n        ${overflow.offenders.join('\n        ')}`
      );
    }

    // ---- LiquidEther present + click-through ----
    if (route === '/' || ['/free', '/complete', '/app', '/affiliates'].includes(route)) {
      const canvasInfo = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return null;
        const wrap = canvas.closest('[data-liquid-ether]');
        const cs = wrap ? getComputedStyle(wrap) : null;
        const r = canvas.getBoundingClientRect();
        return {
          mounted: true,
          pointerEvents: cs?.pointerEvents ?? null,
          ariaHidden: wrap?.getAttribute('aria-hidden'),
          hasFallback: !!document.querySelector(
            '[data-liquid-ether] > div[style*="radial-gradient"]'
          ),
          width: Math.round(r.width),
          height: Math.round(r.height),
          buffer: `${canvas.width}x${canvas.height}`,
        };
      });
      if (!canvasInfo) {
        fail(`${route} LiquidEther canvas did not mount`);
      } else {
        if (canvasInfo.pointerEvents !== 'none') {
          fail(`${route} LiquidEther wrapper has pointer-events: ${canvasInfo.pointerEvents}`);
        }
        if (!canvasInfo.hasFallback) fail(`${route} static gradient fallback missing`);
        if (canvasInfo.width < 100) fail(`${route} canvas collapsed to ${canvasInfo.width}px wide`);
        if (vp.isMobile && Number(canvasInfo.buffer.split('x')[0]) > 900) {
          fail(`${route} mobile buffer too large: ${canvasInfo.buffer}`);
        }
      }

      // The hero CTA must be clickable, not covered by the canvas.
      const clickable = await page.evaluate(() => {
        const hero = document.querySelector(
          '[data-testid="hero-cta-free"], [data-testid="free-page-cta"], [data-testid="complete-page-cta"], [data-testid="affiliates-page-cta"], a[href="#early-access"]'
        );
        if (!hero) return { found: false };
        const target = hero.closest('a, button') ?? hero;
        const r = target.getBoundingClientRect();
        const cx = Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1);
        const cy = Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight - 1);
        const top = document.elementFromPoint(cx, cy);
        return {
          found: true,
          inViewport: r.top < window.innerHeight && r.bottom > 0,
          covered: !(target === top || target.contains(top) || (top && top.contains(target))),
          topTag: top ? top.tagName.toLowerCase() : null,
        };
      });
      if (!clickable.found) fail(`${route} primary hero CTA not found`);
      else if (clickable.inViewport && clickable.covered) {
        fail(`${route} hero CTA is covered by <${clickable.topTag}>`);
      }
    }

    // ---- tap target sizes (mobile only) ----
    if (vp.isMobile) {
      const small = await page.evaluate(() => {
        const out = [];
        for (const el of Array.from(document.querySelectorAll('a, button'))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (el.closest('nav[aria-label="Footer"]')) continue;
          if (el.className.toString().includes('text-') && r.height < 32 && el.tagName === 'A') {
            out.push(
              `${el.tagName}:${el.textContent.trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`
            );
          }
        }
        return out.slice(0, 5);
      });
      for (const s of small) console.log(`    note: small tap target ${s}`);
    }

    // ---- font-size floor ----
    // 11px is the readability floor on this site: body copy is 14px+ and the
    // smallest permitted text is a tracked uppercase micro-label at 11.52px.
    const FLOOR = 11.5;
    const tiny = await page.evaluate((floor) => {
      const out = new Set();
      for (const el of Array.from(
        document.querySelectorAll('p, li, span, a, td, th, label, code')
      )) {
        if (!el.textContent || !el.textContent.trim()) continue;
        if (el.children.length > 0) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size > 0 && size < floor)
          out.add(`${Math.round(size * 10) / 10}px :: ${el.textContent.trim().slice(0, 34)}`);
      }
      return [...out].slice(0, 5);
    }, FLOOR);
    for (const t of tiny) fail(`${route} text below ${FLOOR}px -> ${t}`);

    // ---- console / network ----
    // The 404 route legitimately logs its own 404 status.
    const isNotFound = status === 404;
    for (const e of consoleErrors) {
      if (isNotFound && /404/.test(e)) continue;
      fail(`${route} console error: ${e}`);
    }
    for (const f of failedRequests) {
      if (isNotFound) continue;
      fail(`${route} failed request: ${f}`);
    }

    // ---- screenshot ----
    const safe = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_/, '');
    await page.screenshot({
      path: path.join(OUT, `${vp.name}__${safe}.png`),
      fullPage: true,
      animations: 'disabled',
    });

    console.log(
      `  ok  ${route.padEnd(52)} status=${status} height=${await page.evaluate(() => document.body.scrollHeight)}`
    );
    await page.close();
  }

  await context.close();
}

// ---- reduced motion: no animation, gradient still present ----
console.log('\n================ prefers-reduced-motion ================');
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const state = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const wrap = canvas?.closest('[data-liquid-ether]');
    return {
      canvasMounted: !!canvas,
      frameMode: wrap?.getAttribute('data-liquid-ether') ?? null,
      hasGradient: !!document.querySelector('[data-liquid-ether] > div[style*="radial-gradient"]'),
    };
  });
  console.log('  reduced motion state:', JSON.stringify(state));
  if (!state.hasGradient) fail('reduced motion: static gradient missing');
  await page.screenshot({
    path: path.join(OUT, 'reduced-motion__home.png'),
    animations: 'disabled',
  });

  // Confirm no CSS animation longer than a frame is left running.
  const animated = await page.evaluate(() => {
    const out = [];
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const cs = getComputedStyle(el);
      const name = cs.animationName;
      if (!name || name === 'none') continue;
      const durations = cs.animationDuration.split(',').map((d) => parseFloat(d) || 0);
      if (Math.max(...durations) > 0.05) {
        out.push(
          `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 60)}"> ${name} ${cs.animationDuration}`
        );
      }
    }
    return out;
  });
  for (const a of animated) fail(`reduced motion: animation still running -> ${a}`);

  // The FAQ must still open for reduced-motion users.
  await page.goto(BASE + '/faq', { waitUntil: 'load' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  const rmFaq = await page.evaluate(async () => {
    const trigger = document.querySelector('[data-radix-collection-item]');
    if (!trigger) return { found: false };
    trigger.click();
    for (let i = 0; i < 30; i += 1) {
      await new Promise((r) => setTimeout(r, 100));
      if (trigger.getAttribute('aria-expanded') === 'true') break;
    }
    return { found: true, expanded: trigger.getAttribute('aria-expanded') };
  });
  if (!rmFaq.found) fail('reduced motion: FAQ trigger missing');
  else if (rmFaq.expanded !== 'true') fail('reduced motion: FAQ did not expand');

  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(OUT, 'reduced-motion__home.png'),
    animations: 'disabled',
  });

  await ctx.close();
}

// ---- keyboard navigation ----
console.log('\n================ keyboard ================');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });

  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 40));
  console.log('  first tab stop:', first);
  if (!/skip to main/i.test(first ?? '')) fail('first tab stop is not the skip link');

  // Walk to the FAQ and open one with the keyboard.
  await page.goto(BASE + '/faq', { waitUntil: 'load' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  const opened = await page.evaluate(async () => {
    const trigger = document.querySelector('[data-radix-collection-item]');
    if (!trigger) return { found: false };
    trigger.focus();
    const focused = document.activeElement === trigger;
    trigger.click();
    // Client-side interaction: poll rather than assume a fixed delay.
    for (let i = 0; i < 30; i += 1) {
      await new Promise((r) => setTimeout(r, 100));
      if (trigger.getAttribute('aria-expanded') === 'true') break;
    }
    return { found: true, focused, expanded: trigger.getAttribute('aria-expanded') };
  });
  console.log('  faq keyboard:', JSON.stringify(opened));
  if (!opened.focused) fail('FAQ trigger could not receive focus');
  if (opened.expanded !== 'true') fail('FAQ trigger did not expand via click/keyboard');

  await ctx.close();
}

// ---- mobile navigation drawer ----
console.log('\n================ mobile nav ================');
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });

  await page.getByRole('button', { name: /open menu/i }).click();
  await page.waitForTimeout(400);
  const drawer = await page.evaluate(() => {
    const el = document.getElementById('mobile-nav');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      hidden: el.hasAttribute('hidden'),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  });
  console.log('  drawer:', JSON.stringify(drawer));
  if (!drawer || drawer.hidden || drawer.height < 100) fail('mobile drawer did not open visibly');
  if (drawer && drawer.width > 400) fail('mobile drawer is wider than a phone screen');
  await page.screenshot({ path: path.join(OUT, 'mobile__drawer-open.png') });

  await page.getByRole('button', { name: /close menu/i }).click();
  await page.waitForTimeout(300);
  const closed = await page.evaluate(() =>
    document.getElementById('mobile-nav')?.hasAttribute('hidden')
  );
  if (!closed) fail('mobile drawer did not close');

  await ctx.close();
}

await browser.close();

console.log(
  failures === 0
    ? `\nVISUAL QA PASSED Ã¢â‚¬â€ 0 failures. Screenshots in ${path.relative(process.cwd(), OUT)}`
    : `\nVISUAL QA FAILED Ã¢â‚¬â€ ${failures} failures`
);
process.exit(failures === 0 ? 0 : 1);
