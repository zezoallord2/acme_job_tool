/**
 * TanStack Router equivalent of the Next.js Metadata API.
 *
 * Takes the same input the Next.js build used (title, description, path, …) and
 * returns TanStack's head shape, so the metadata for every route is defined once
 * and identical in intent on both builds.
 *
 * The brand-suffix strip is preserved: `headFor` must never emit a title that
 * already ends in "| Acme Jobs", because the root route appends it.
 */
import { absoluteUrl, siteConfig } from '@/lib/config';

export interface HeadInput {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  /** Path of this route's OG image, e.g. '/free/og.png'. */
  imagePath?: string;
  type?: 'website' | 'article';
}

export interface HeadMeta {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
  charSet?: string;
}
export interface HeadLink {
  rel: string;
  href: string;
}

export interface HeadResult {
  meta: HeadMeta[];
  links: HeadLink[];
}

export const OG_IMAGE_ALT =
  'Acme Jobs — Better Opportunities Ahead. Your experience. AI-assisted. Never invented.';

export function headFor({
  title,
  description,
  path,
  noindex = false,
  imagePath,
  type = 'website',
}: HeadInput): HeadResult {
  const canonical = absoluteUrl(path);
  const image = absoluteUrl(imagePath ?? '/og.png');
  const cleanTitle = title.replace(/\s*\|\s*Acme Jobs\s*$/i, '').trim();

  const meta: HeadMeta[] = [
    { charSet: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    // TanStack renders a <title> from this meta entry, same as Next's
    // `title` field. Without it the served HTML has no <title> at all.
    { title: `${cleanTitle} | ${siteConfig.name}` },
    { name: 'description', content: description },
    { name: 'theme-color', content: '#0B2D4D' },
    ...(noindex
      ? [{ name: 'robots', content: 'noindex, nofollow' }]
      : [
          { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' },
        ]),
    { property: 'og:type', content: type },
    { property: 'og:site_name', content: siteConfig.name },
    { property: 'og:locale', content: siteConfig.locale },
    { property: 'og:title', content: cleanTitle },
    { property: 'og:description', content: description },
    { property: 'og:url', content: canonical },
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: OG_IMAGE_ALT },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: cleanTitle },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
    { name: 'twitter:image:alt', content: OG_IMAGE_ALT },
  ];

  const links: HeadLink[] = [{ rel: 'canonical', href: canonical }];

  return { meta, links };
}
