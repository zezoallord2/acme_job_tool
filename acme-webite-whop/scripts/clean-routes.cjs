/**
 * Cleanup pass over the generated TanStack route files:
 *  - swap the leftover `buildMetadata` import for `headFor`
 *  - drop imports the routes no longer use
 *  - rename `to=` props on the local Link shim to `href=`
 */
const fs = require('fs');
const path = require('path');

const ROUTES = path.join(process.cwd(), 'src', 'routes');
const files = fs.readdirSync(ROUTES).filter((f) => f.endsWith('.tsx'));

let touched = 0;

for (const name of files) {
  const file = path.join(ROUTES, name);
  const before = fs.readFileSync(file, 'utf8');
  let after = before;

  // seo.ts is still needed for the JSON-LD builders, but buildMetadata is not.
  after = after.replace(
    /import \{ ([^}]*?)buildMetadata, ([^}]*?)\} from '@\/lib\/seo';/g,
    (_m, a, b) => `import { ${a}${b} } from '@/lib/seo';`
  );
  after = after.replace(
    /import \{ buildMetadata, ([^}]*?)\} from '@\/lib\/seo';/g,
    (_m, b) => `import { ${b} } from '@/lib/seo';`
  );
  after = after.replace(
    /import \{ ([^}]*?)\} from '@\/lib\/seo';/g,
    (m, inner) => (inner.includes('buildMetadata') ? m : m)
  );

  // The local Link shim takes href, not TanStack's `to`.
  after = after.replace(/(<Link\b[^>]*?)\bto=/g, '$1href=');

  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    touched += 1;
    console.log('cleaned', name);
  }
}
console.log(`\nfiles touched: ${touched}`);
