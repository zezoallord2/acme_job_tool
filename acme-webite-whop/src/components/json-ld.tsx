/**
 * Renders a JSON-LD block. Content is authored in this repository (never user
 * input), and React escapes it, so the only risk is a malformed object — which is
 * why every block goes through a small shape check.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const serialised = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialised }} />;
}

export default JsonLd;
