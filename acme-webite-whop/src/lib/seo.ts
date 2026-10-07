import type { Metadata } from 'next';
import { absoluteUrl, siteConfig } from '@/lib/config';

export const OG_IMAGE = {
  desktop: absoluteUrl('/opengraph-image'),
  alt: 'Acme Jobs — Better Opportunities Ahead. Your experience. AI-assisted. Never invented.',
} as const;

interface PageMetaInput {
  title: string;
  description: string;
  /** Path of the page, e.g. '/complete'. Used for the canonical URL. */
  path: string;
  /** Set for pages that should not be indexed (e.g. drafts). */
  noindex?: boolean;
  /** Overrides the default OG image path when a page has its own preview. */
  imagePath?: string;
  type?: 'website' | 'article';
}

/**
 * Builds a complete, consistent metadata object: unique title + description,
 * canonical URL, OpenGraph and Twitter/X tags, and robots directives.
 */
export function buildMetadata({
  title,
  description,
  path,
  noindex = false,
  imagePath,
  type = 'website',
}: PageMetaInput): Metadata {
  const canonical = absoluteUrl(path);
  const image = absoluteUrl(imagePath ?? '/opengraph-image');

  // The root layout applies a "%s | Acme Jobs" template. Strip any brand
  // suffix supplied here so a page can never end up as "… | Acme Jobs | Acme Jobs".
  const cleanTitle = title.replace(/\s*\|\s*Acme Jobs\s*$/i, '').trim();

  return {
    title: cleanTitle,
    description,
    alternates: { canonical },
    robots: noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
    openGraph: {
      type,
      url: canonical,
      siteName: siteConfig.name,
      title: cleanTitle,
      description,
      locale: siteConfig.locale,
      images: [{ url: image, width: 1200, height: 630, alt: OG_IMAGE.alt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: cleanTitle,
      description,
      images: [image],
    },
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': absoluteUrl('/#organization'),
    name: siteConfig.name,
    url: absoluteUrl('/'),
    slogan: siteConfig.tagline,
    description: siteConfig.shortDescription,
    email: siteConfig.email,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/icon.svg'),
    },
    knowsAbout: [
      'AI job search',
      'resume tailoring with AI',
      'AI interview preparation',
      'job description analysis',
      'career evidence',
    ],
  };
}

interface ProductJsonLdInput {
  name: string;
  description: string;
  price: string;
  priceCurrency: string;
  path: string;
  availability?: 'https://schema.org/InStock' | 'https://schema.org/PreOrder';
  brand?: string;
}

export function productJsonLd({
  name,
  description,
  price,
  priceCurrency,
  path,
  availability = 'https://schema.org/InStock',
  brand = siteConfig.name,
}: ProductJsonLdInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    brand: { '@type': 'Brand', name: brand },
    url: absoluteUrl(path),
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency,
      availability,
      url: absoluteUrl(path),
      seller: { '@id': absoluteUrl('/#organization') },
    },
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function articleJsonLd(input: {
  title: string;
  description: string;
  path: string;
  published: string;
  updated: string;
  readingMinutes: number;
  section: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    datePublished: input.published,
    dateModified: input.updated,
    author: { '@type': 'Organization', name: siteConfig.name, url: absoluteUrl('/about') },
    publisher: { '@id': absoluteUrl('/#organization') },
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(input.path) },
    articleSection: input.section,
    timeRequired: `PT${input.readingMinutes}M`,
    inLanguage: 'en-US',
  };
}
