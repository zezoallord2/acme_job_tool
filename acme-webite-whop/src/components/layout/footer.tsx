import Link from '@/components/link';
import { Logo } from '@/components/brand/logo';
import { BrandMark } from '@/components/brand/logo';
import { socialLinks } from '@/lib/config';
import type { LinkState } from '@/lib/config';
import { brandPromise, brandTagline, freeProduct, paidProduct } from '@/content/marketing';

const columns: { title: string; links: { label: string; href: string; external?: LinkState }[] }[] =
  [
    {
      title: 'Products',
      links: [
        { label: 'Free Starter Guide', href: '/free' },
        { label: 'Complete Edition', href: '/complete' },
        { label: 'Compare Free vs Complete', href: '/complete#compare' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'How it works', href: '/how-it-works' },
        { label: 'Resources', href: '/resources' },
        { label: 'FAQ', href: '/faq' },
      ],
    },
    {
      title: 'Coming soon',
      links: [
        { label: 'Acme Jobs App', href: '/app' },
        { label: 'Early access list', href: '/app#early-access' },
      ],
    },
    {
      title: 'Earn',
      links: [{ label: 'Affiliate Programme', href: '/affiliates' }],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
        { label: 'Disclaimer', href: '/terms#disclaimer' },
      ],
    },
  ];

const socials: { key: keyof typeof socialLinks; label: string; path: string }[] = [
  { key: 'tiktok', label: 'TikTok', path: 'M12 3a9 9 0 1 0 9 9h-2.6a6.4 6.4 0 1 1-6.4-6.4V3z' },
  {
    key: 'pinterest',
    label: 'Pinterest',
    path: 'M12 3a9 9 0 0 0-3.3 17.4c-.1-.7-.2-1.9 0-2.7l1.1-4.6s-.3-.6-.3-1.4c0-1.3.8-2.3 1.7-2.3.8 0 1.2.6 1.2 1.4 0 .8-.5 2.1-.8 3.3-.2 1 .5 1.8 1.5 1.8 1.8 0 3.1-2.3 3.1-5 0-2.1-1.4-3.6-3.9-3.6a4.4 4.4 0 0 0-4.6 4.4c0 .8.2 1.4.6 1.9.2.2.2.3.1.5l-.2.7c0 .3-.2.3-.4.2-1.2-.5-1.8-1.9-1.8-3.5 0-2.6 2.2-5.7 6.6-5.7 3.5 0 5.8 2.5 5.8 5.3 0 3.6-2 6.3-4.9 6.3-1 0-1.9-.5-2.2-1.1l-.6 2.4c-.2.8-.7 1.7-1.1 2.3A9 9 0 1 0 12 3z',
  },
  {
    key: 'x',
    label: 'X',
    path: 'M17.2 3h3.1l-6.8 7.8L21.8 21h-6.2l-4.9-6.4L5 21H1.9l7.3-8.3L2.2 3h6.4l4.4 5.8L17.2 3zm-1.1 16.2h1.7L7 4.7H5.2l10.9 14.5z',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    path: 'M6.9 8.5v10.6H3.4V8.5h3.5zM5.2 3.1a2 2 0 1 1 0 4.1 2 2 0 0 1 0-4.1zM20.6 19.1h-3.5v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.3H9.7V8.5h3.4v1.6h.1c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5v5.4z',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    path: 'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z',
  },
];

export function Footer() {
  const year = 2026;
  return (
    <footer className="bg-navy-950 text-brand-100 relative overflow-hidden">
      <div className="grain-overlay absolute inset-0" aria-hidden="true" />
      <div
        className="via-brand-500/60 absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent"
        aria-hidden="true"
      />
      <div className="relative mx-auto w-full max-w-[78rem] px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2.2fr)]">
          <div className="max-w-sm">
            <Link href="/" aria-label="Acme Jobs — home" className="inline-flex">
              <Logo tone="light" showTagline />
            </Link>
            <p className="text-brand-100/75 mt-5 text-sm leading-relaxed">
              Acme Jobs helps job seekers use AI to build stronger, more targeted applications from
              their real experience — without inventing qualifications, metrics or career history.
            </p>
            <p className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3.5 text-sm leading-snug font-semibold text-white">
              {brandPromise}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {socials.map((social) => {
                const state = socialLinks[social.key];
                const content = (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="currentColor"
                    >
                      <path d={social.path} />
                    </svg>
                    <span className="sr-only">{social.label}</span>
                  </>
                );
                const className =
                  'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-brand-100/85 transition-colors duration-200 hover:border-brand-400 hover:bg-white/10 hover:text-white';

                if (!state.href) {
                  return (
                    <span
                      key={social.key}
                      className={className}
                      title={`${social.label} profile link not published yet`}
                      aria-hidden="true"
                    >
                      {content}
                    </span>
                  );
                }
                return (
                  <a
                    key={social.key}
                    href={state.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                  >
                    {content}
                  </a>
                );
              })}
            </div>
            <p className="text-brand-100/45 mt-3 text-xs">
              Social profiles are added once the official accounts are live.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="text-brand-300 text-[0.75rem] font-bold tracking-[0.16em] uppercase">
                  {column.title}
                </h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-brand-100/75 text-sm underline-offset-4 transition-colors duration-200 hover:text-white hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <BrandMark className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">
                Start with the free guide — {freeProduct.name}
              </p>
              <p className="text-brand-100/70 mt-1 text-sm">
                Then upgrade to {paidProduct.name} — {paidProduct.edition} at{' '}
                {paidProduct.launchPrice} launch price.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/free"
              className="inline-flex h-10 items-center rounded-full border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/20"
            >
              Start free
            </Link>
            <Link
              href="/complete"
              className="from-brand-600 to-brand-500 inline-flex h-10 items-center rounded-full bg-gradient-to-r px-4 text-sm font-semibold text-white transition-colors duration-200 hover:brightness-110"
            >
              Complete Edition
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-brand-100/60 text-xs">
            © {year} Acme Jobs. {brandTagline}
          </p>
          <p className="text-brand-100/55 max-w-xl text-xs leading-relaxed">
            Acme Jobs provides educational and career-preparation tools. We do not guarantee
            employment, interviews or offers. You remain responsible for verifying the accuracy of
            any application content before you submit it.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
