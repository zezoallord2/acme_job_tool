/**
 * One-off codemod: converts the Next.js App Router pages into TanStack Start
 * route files.
 *
 *  src/app/<x>/page.tsx  ->  src/routes/<x>.tsx
 *
 * Next's `export const metadata = buildMetadata({...})` becomes
 * `head: () => headFor({...})`, where headFor takes the same input and returns
 * TanStack Router's head shape. Page bodies are copied through untouched, which
 * keeps the port faithful: the same components, the same copy, the same classes.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'src', 'app');
const OUT_DIR = path.join(ROOT, 'src', 'routes');

const PAGES = [
  { dir: '', route: '/', file: 'index.tsx', component: 'HomePage' },
  { dir: 'free', route: '/free', file: 'free.tsx', component: 'FreePage' },
  { dir: 'complete', route: '/complete', file: 'complete.tsx', component: 'CompletePage' },
  {
    dir: 'how-it-works',
    route: '/how-it-works',
    file: 'how-it-works.tsx',
    component: 'HowItWorksPage',
  },
  { dir: 'app', route: '/app', file: 'app.tsx', component: 'AppPage' },
  {
    dir: 'affiliates',
    route: '/affiliates',
    file: 'affiliates.tsx',
    component: 'AffiliatesPage',
  },
  { dir: 'resources', route: '/resources', file: 'resources.tsx', component: 'ResourcesPage' },
  { dir: 'faq', route: '/faq', file: 'faq.tsx', component: 'FaqPage' },
  { dir: 'about', route: '/about', file: 'about.tsx', component: 'AboutPage' },
  { dir: 'privacy', route: '/privacy', file: 'privacy.tsx', component: 'PrivacyPage' },
  { dir: 'terms', route: '/terms', file: 'terms.tsx', component: 'TermsPage' },
];

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const SRC_APP = path.join(ROOT, '..', 'acme webite', 'src', 'app');

for (const page of PAGES) {
  const from = path.join(SRC_APP, page.dir, 'page.tsx');
  if (!fs.existsSync(from)) {
    console.log('!! missing source page:', from);
    continue;
  }
  let src = fs.readFileSync(from, 'utf8');

  // 1. Drop Next-only imports.
  src = src.replace(/import type \{ Metadata \} from 'next';\n?/g, '');
  src = src.replace(/import \{ redirect \} from 'next\/navigation';\n?/g, '');
  src = src.replace(
    /import Link from 'next\/link';/g,
    "import { Link } from '@/components/link';"
  );
  src = src.replace(
    /import Header from '@\/components\/layout\/header';/g,
    "import { Header } from '@/components/layout/header';"
  );
  src = src.replace(/import type \{ Article \} from '@\/content\/articles';/g, '');

  // 2. metadata export -> head()
  src = src.replace(
    /export const metadata: Metadata = buildMetadata\(\{([\s\S]*?)\n\}\);/,
    (_m, args) => `const head = () => headFor({${args}\n});`
  );

  // 3. default export -> plain component
  src = src.replace(/export default function ([A-Za-z0-9_]+)\(/, (_m, name) => `function ${name}(`);

  // Keep the "use client" marker off the top so the route is server-rendered.
  src = src.replace(/^'use client';\n+/, '');

  // 4. Router import at the top; the Route export goes LAST so that `head` and
  //    the component function are already initialised when the object literal is
  //    evaluated (a leading export would hit the temporal dead zone).
  const preamble =
    `import { createFileRoute } from '@tanstack/react-router';\n` +
    `import { headFor } from '@/lib/head';\n\n`;

  const routeExport =
    `\nexport const Route = createFileRoute('${page.route}')({\n` +
    `  component: ${page.component},\n` +
    `  head,\n` +
    `});\n`;

  const out = preamble + src.trimEnd() + '\n' + routeExport;
  fs.writeFileSync(path.join(OUT_DIR, page.file), out, 'utf8');
  console.log('created src/routes/' + page.file);
}

console.log('\ndone');
