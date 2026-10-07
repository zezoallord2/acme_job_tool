/**
 * Central, validated site configuration.
 *
 * Every outbound destination is environment-driven. Nothing here invents a
 * production URL: when a variable is missing the UI degrades into an explicit,
 * honest "not configured yet" state instead of rendering a broken link.
 *
 * Env resolution differs from the Next.js build. `process.env.NEXT_PUBLIC_*` is
 * substituted by webpack at build time; Vite only inlines `import.meta.env.*`,
 * and the Cloudflare Workers runtime has no Node `process` on the client. So the
 * primary source is `VITE_*`, with a guarded `process.env` fallback for the
 * server bundle and for local Node scripts.
 */

type EnvRecord = Record<string, string | undefined>;

function read(name: string): string | undefined {
  const bare = name.replace(/^NEXT_PUBLIC_/, '');
  const fromVite = (import.meta.env as EnvRecord | undefined)?.[`VITE_${bare}`];
  if (fromVite !== undefined && fromVite !== '') return fromVite;
  // `process` does not exist in the browser bundle, so this must be guarded.
  if (typeof process !== 'undefined' && process.env) return process.env[name];
  return undefined;
}

const rawSiteUrl = read('NEXT_PUBLIC_SITE_URL')?.trim() ?? '';

function normaliseOrigin(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, '');
}

export const SITE_ORIGIN = rawSiteUrl ? normaliseOrigin(rawSiteUrl) : '';

export const siteConfig = {
  name: 'Acme Jobs',
  tagline: 'Better Opportunities Ahead.',
  positioning: 'Your experience. AI-assisted. Never invented.',
  shortDescription:
    'Acme Jobs helps job seekers use AI to build stronger, more targeted applications from their real experience â€” without inventing qualifications, metrics, or career history.',
  url: SITE_ORIGIN,
  locale: 'en_US',
  email: 'hello@acmejobs.co',
  foundedYear: 2026,
} as const;

function cleanUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export type LinkState = { href: string | null };

function link(value: string | undefined): LinkState {
  return { href: cleanUrl(value) };
}

export const outbound = {
  freeWhop: link(read('NEXT_PUBLIC_FREE_WHOP_URL')),
  paidWhop: link(read('NEXT_PUBLIC_PAID_WHOP_URL')),
  affiliate: link(read('NEXT_PUBLIC_AFFILIATE_URL')),
} as const;

function bool(value: string | undefined, fallback: boolean): boolean {
  const normalised = value?.trim().toLowerCase();
  if (!normalised) return fallback;
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalised);
}

export const waitlistConfig = {
  enabled: bool(read('NEXT_PUBLIC_APP_WAITLIST_ENABLED'), true),
  provider: (read('NEXT_PUBLIC_WAITLIST_PROVIDER')?.trim() || 'file').toLowerCase(),
} as const;

export const analyticsConfig = {
  plausibleDomain: read('NEXT_PUBLIC_PLAUSIBLE_DOMAIN')?.trim() || null,
  ga4Id: read('NEXT_PUBLIC_GA4_ID')?.trim() || null,
} as const;

export const socialLinks = {
  x: link(read('NEXT_PUBLIC_SOCIAL_X')),
  linkedin: link(read('NEXT_PUBLIC_SOCIAL_LINKEDIN')),
  tiktok: link(read('NEXT_PUBLIC_SOCIAL_TIKTOK')),
  pinterest: link(read('NEXT_PUBLIC_SOCIAL_PINTEREST')),
  facebook: link(read('NEXT_PUBLIC_SOCIAL_FACEBOOK')),
} as const;

/** Absolute URL helper that degrades to a relative path without a configured origin. */
export function absoluteUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return SITE_ORIGIN ? `${SITE_ORIGIN}${clean}` : clean;
}

export const navLinks = [
  { href: '/free', label: 'Start Free' },
  { href: '/complete', label: 'Complete Edition' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/resources', label: 'Resources' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
] as const;

/**
 * Routes whose first screen is a dark hero band, so the header can sit
 * transparently over it. Everything else gets the solid light header.
 */
export const overlayHeaderRoutes = ['/', '/free', '/complete', '/app', '/affiliates'] as const;

export function usesOverlayHeader(pathname: string): boolean {
  return overlayHeaderRoutes.some((route) =>
    route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`)
  );
}

export const routes = {
  home: '/',
  free: '/free',
  complete: '/complete',
  howItWorks: '/how-it-works',
  app: '/app',
  affiliates: '/affiliates',
  resources: '/resources',
  faq: '/faq',
  about: '/about',
  privacy: '/privacy',
  terms: '/terms',
} as const;
