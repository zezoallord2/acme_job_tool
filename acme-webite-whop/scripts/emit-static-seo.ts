/**
 * Emits the static SEO files that the Next.js build generated on demand:
 *   public/sitemap.xml
 *   public/robots.txt
 *
 * Route list is derived from the TanStack route tree so a new page cannot be
 * added without appearing in the sitemap.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Article slugs are read straight off disk rather than imported: this script
 * runs on plain Node, which cannot resolve the extensionless TypeScript imports
 * inside src/content/articles.
 */
function articleSlugs(): string[] {
  const dir = path.join(process.cwd(), 'src', 'content', 'articles');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !['index.ts', 'types.ts'].includes(f))
    .map((f) => {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      const match = src.match(/\bslug:\s*'([^']+)'/);
      if (!match?.[1]) throw new Error(`No slug found in ${f}`);
      return match[1];
    })
    .sort();
}

const ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');

if (!ORIGIN) {
  console.error(
    'NEXT_PUBLIC_SITE_URL is not set. Refusing to emit absolute sitemap/robots URLs.'
  );
  process.exit(1);
}

const STATIC_ROUTES = [
  { p: '/', freq: 'weekly', pri: '1' },
  { p: '/free', freq: 'monthly', pri: '0.95' },
  { p: '/complete', freq: 'monthly', pri: '0.9' },
  { p: '/how-it-works', freq: 'monthly', pri: '0.8' },
  { p: '/app', freq: 'monthly', pri: '0.7' },
  { p: '/resources', freq: 'weekly', pri: '0.8' },
  { p: '/affiliates', freq: 'monthly', pri: '0.6' },
  { p: '/faq', freq: 'monthly', pri: '0.6' },
  { p: '/about', freq: 'yearly', pri: '0.5' },
  { p: '/privacy', freq: 'yearly', pri: '0.3' },
  { p: '/terms', freq: 'yearly', pri: '0.3' },
];

const articles = articleSlugs().map((slug) => ({
  p: `/resources/${slug}`,
  freq: 'monthly',
  pri: '0.7',
}));

const urls = [...STATIC_ROUTES, ...articles]
  .map(
    (r) =>
      `  <url>\n    <loc>${ORIGIN}${r.p}</loc>\n    <changefreq>${r.freq}</changefreq>\n    <priority>${r.pri}</priority>\n  </url>`
  )
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

const robots = `User-Agent: *
Allow: /
Disallow: /api/

Host: ${ORIGIN}
Sitemap: ${ORIGIN}/sitemap.xml
`;

const out = path.join(process.cwd(), 'public');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'sitemap.xml'), sitemap, 'utf8');
fs.writeFileSync(path.join(out, 'robots.txt'), robots, 'utf8');

console.log(
  `emitted sitemap.xml (${STATIC_ROUTES.length + articles.length} urls) and robots.txt for ${ORIGIN}`
);
