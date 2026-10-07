/**
 * Generates the OpenGraph / Twitter card PNGs.
 *
 * The Next.js build rendered these on demand with next/og. This build serves
 * static files, so they are produced once into public/ and shipped as assets.
 *
 * Design is deliberately identical to the next/og cards: navy base, teal glow,
 * the Acme Jobs wordmark, the brand tagline, and the promise line.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const W = 1200;
const H = 630;

const CARDS: Card[] = [
  {
    out: 'og.png',
    eyebrow: 'AI-ASSISTED JOB SEARCH',
    title: ['Stop Sending Generic', 'Applications. Build Better', 'Ones With AI.'],
    sub: "Use AI to build better applications from your real experience â€” never invented.",
    pill: null,
  },
  {
    out: 'free/og.png',
    eyebrow: 'FREE EDITION',
    title: ['AI Job Search Starter', 'Guide'],
    sub: 'Improve one real application for free. No paid AI subscription required.',
    pill: '$0',
  },
  {
    out: 'complete/og.png',
    eyebrow: 'COMPLETE SYSTEM',
    title: ['AI Job Hunter â€”', 'Complete Edition'],
    sub: 'The full reusable AI-assisted job search workflow, built on your real evidence.',
    pill: '$9.99 launch',
  },
  {
    out: 'app/og.png',
    eyebrow: 'COMING SOON',
    title: ['The Acme Jobs App', 'Is Coming.'],
    sub: 'Career evidence, job analysis, claim verification and interview preparation.',
    pill: 'Early access',
  },
  {
    out: 'affiliates/og.png',
    eyebrow: 'AFFILIATE PROGRAMME',
    title: ['Share Acme Jobs.', 'Earn When Someone Buys.'],
    sub: 'Promote AI Job Hunter â€” Complete Edition and earn a commission on purchase.',
    pill: 'For creators',
  },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface Card {
  out: string;
  eyebrow: string;
  title: string[];
  sub: string;
  pill: string | null;
}

function svg(card: Card): string {
  const titleLines = card.title
    .map((line: string, i: number) => {
      const y = 300 + i * 74;
      const accent = line.includes('Better') || line.includes('Earn') ? '#4DD6DA' : '#FFFFFF';
      return `<text x="80" y="${y}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="62" font-weight="700" fill="${accent}" letter-spacing="-1.5">${escapeXml(line)}</text>`;
    })
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B2D4D"/>
      <stop offset="55%" stop-color="#072339"/>
      <stop offset="100%" stop-color="#04182B"/>
    </linearGradient>
    <radialGradient id="glowA" cx="0.12" cy="0.02" r="0.75">
      <stop offset="0%" stop-color="#24C3C8" stop-opacity="0.42"/>
      <stop offset="60%" stop-color="#118E94" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#0B2D4D" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="1.02" cy="1.05" r="0.7">
      <stop offset="0%" stop-color="#1B4F7D" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#0B2D4D" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="markGrad" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#24C3C8"/>
      <stop offset="60%" stop-color="#1E9BE6"/>
      <stop offset="100%" stop-color="#2C6BE0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#glowA)"/>
  <rect width="${W}" height="${H}" fill="url(#glowB)"/>

  <!-- logo mark -->
  <g transform="translate(80, 58)">
    <path d="M20 46 C24 30, 30 14, 44 6 C56 -1, 68 4, 74 16 C78 24, 74 32, 66 36 L40 52 C30 58, 22 56, 20 46 Z" fill="url(#markGrad)"/>
  </g>
  <text x="176" y="96" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="40" font-weight="700" fill="#FFFFFF">Acme <tspan fill="#8EE7E9">Jobs</tspan></text>
  <text x="176" y="126" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="17" letter-spacing="3.4" fill="#8EE7E9">BETTER OPPORTUNITIES AHEAD.</text>

  ${
    card.pill
      ? `<g>
    <rect x="${W - 80 - 8}" y="58" width="8" height="0" fill="none"/>
    <rect x="${W - 80 - (card.pill.length * 13 + 56)}" y="62" width="${card.pill.length * 13 + 56}" height="52" rx="26" fill="none" stroke="#8EE7E9" stroke-opacity="0.55" stroke-width="2"/>
    <text x="${W - 80 - 28}" y="96" text-anchor="end" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="#EAF8F8">${escapeXml(card.pill)}</text>
  </g>`
      : ''
  }

  <text x="80" y="230" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="4" fill="#8EE7E9">${escapeXml(card.eyebrow)}</text>

  ${titleLines}

  <text x="80" y="${H - 130}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="28" fill="#C9E6E7">${escapeXml(card.sub)}</text>

  <rect x="80" y="${H - 92}" width="${W - 160}" height="1" fill="#ffffff" fill-opacity="0.14"/>
  <text x="80" y="${H - 48}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2.4" fill="#8EE7E9">YOUR EXPERIENCE. AI-ASSISTED. NEVER INVENTED.</text>
</svg>`;
}

const root = path.join(process.cwd(), 'public');

for (const card of CARDS) {
  const target = path.join(root, card.out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const buffer = Buffer.from(svg(card));
  await sharp(buffer, { density: 96 }).png({ compressionLevel: 9 }).toFile(target);
  const size = fs.statSync(target).size;
  console.log(`${card.out.padEnd(22)} ${Math.round(size / 1024)} KB`);
}

console.log('\nOG images written to public/');
