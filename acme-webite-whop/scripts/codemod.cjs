/**
 * One-off codemod: rewrites the Acme Jobs component tree from Next.js App Router
 * imports to the framework-agnostic equivalents used by the TanStack Start port.
 *
 *  next/link        ->  @/components/link
 *  next/image       ->  @/components/image
 *  next/dynamic     ->  React.lazy
 *  next/navigation  ->  @/components/navigation
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(process.cwd(), 'src');
const files = [];

(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
})(SRC);

let touched = 0;

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  let after = before;

  if (/from 'next\/link'/.test(after)) {
    after = after.replace(/from 'next\/link'/g, "from '@/components/link'");
  }
  if (/from 'next\/image'/.test(after)) {
    after = after.replace(/from 'next\/image'/g, "from '@/components/image'");
  }
  if (/from 'next\/navigation'/.test(after)) {
    after = after.replace(/from 'next\/navigation'/g, "from '@/components/navigation'");
  }

  // next/dynamic(() => import('x')) -> React.lazy(() => import('x'))
  if (/from 'next\/dynamic'/.test(after)) {
    after = after.replace(
      /const\s+(\w+)\s*=\s*dynamic\(\(\)\s*=>\s*import\('([^']+)'\)\s*(?:,\s*\{[^}]*\})?\);/g,
      (_m, name, spec) => `const ${name} = React.lazy(() => import('${spec}'));`
    );
    after = after.replace(/import\s+dynamic\s+from\s+'next\/dynamic';\s*\n?/g, '');
    // Ensure React is in scope for the lazy import.
    if (/React\.lazy/.test(after) && !/import \* as React/.test(after)) {
      after = "import * as React from 'react';\n" + after;
    }
  }

  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    touched += 1;
    console.log('rewrote', path.relative(process.cwd(), file));
  }
}

console.log(`\nfiles touched: ${touched}`);
