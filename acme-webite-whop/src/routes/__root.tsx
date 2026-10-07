import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import { Link } from '@/components/link';
import { BrandMark } from '@/components/brand/logo';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SkipLink } from '@/components/layout/skip-link';
import { OG_IMAGE_ALT } from '@/lib/head';
import { siteConfig } from '@/lib/config';

import appCss from '../styles-acme.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'theme-color', content: '#0B2D4D' },
      { name: 'application-name', content: siteConfig.name },
      { name: 'author', content: siteConfig.name },
      { name: 'format-detection', content: 'telephone=no, address=no, email=no' },
      { property: 'og:image:alt', content: OG_IMAGE_ALT },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
      { rel: 'sitemap', href: '/sitemap.xml' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-white antialiased">
        <SkipLink />
        <div className="flex min-h-dvh flex-col">
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  const suggestions = [
    { label: 'Home', to: '/' },
    { label: 'Free Starter Guide', to: '/free' },
    { label: 'Complete Edition', to: '/complete' },
    { label: 'How it works', to: '/how-it-works' },
    { label: 'Resources', to: '/resources' },
    { label: 'FAQ', to: '/faq' },
  ];

  return (
    <section className="relative overflow-hidden bg-navy-900 pt-32 pb-20 sm:pt-40 sm:pb-24">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(85%_70%_at_15%_0%,rgba(17,142,148,0.28),transparent_65%)]"
      />
      <div aria-hidden="true" className="absolute inset-0 grain-overlay" />
      <div className="relative mx-auto w-full max-w-[78rem] px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[0.72rem] font-bold tracking-[0.18em] text-brand-300 uppercase">
            Error 404
          </p>
          <h1 className="mt-4 text-[2.15rem] leading-[1.1] font-bold tracking-[-0.03em] text-white sm:text-[2.85rem]">
            This page does not exist.
          </h1>
          <p className="mt-6 text-[1.0625rem] leading-relaxed text-brand-100/85 sm:text-lg">
            The link may be out of date, or the address may have a typo. Here is where everything
            actually lives.
          </p>

          <ul className="mx-auto mt-9 flex max-w-xl flex-wrap justify-center gap-2.5">
            {suggestions.map((item) => (
              <li key={item.to}>
                <Link
                  href={item.to}
                  className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors duration-200 hover:border-white/50 hover:bg-white/20"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col items-center justify-center gap-3.5 sm:flex-row sm:gap-4">
            <Link
              href="/free"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-7 text-base font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 sm:w-auto"
            >
              Start free
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/30 bg-white/10 px-7 text-base font-semibold text-white backdrop-blur-sm transition-colors duration-200 hover:border-white/60 hover:bg-white/15 sm:w-auto"
            >
              Back to home
            </Link>
          </div>

          <p className="mt-10 inline-flex items-center gap-2 text-xs font-medium tracking-[0.08em] text-brand-100/50 uppercase">
            <BrandMark className="h-5 w-5" />
            {siteConfig.tagline}
          </p>
        </div>
      </div>
    </section>
  );
}

