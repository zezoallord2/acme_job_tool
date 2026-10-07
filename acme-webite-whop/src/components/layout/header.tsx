'use client';

import * as React from 'react';
import Link from '@/components/link';
import { usePathname } from '@/components/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { CtaLink } from '@/components/cta-link';
import { navLinks, usesOverlayHeader } from '@/lib/config';
import { cn } from '@/lib/utils';

/**
 * Sticky, translucent site header.
 *
 * On routes that open with a dark hero band the header sits transparently over
 * it (white logo and nav); everything else gets the solid light variant. It is a
 * client component so it can react to scroll and own the mobile drawer state.
 */
export function Header() {
  const pathname = usePathname() ?? '/';
  const prefersOverlay = usesOverlayHeader(pathname);
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const solid = !prefersOverlay || scrolled || open;

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300',
        solid
          ? 'border-line/80 bg-white/92 shadow-[0_1px_20px_-12px_rgba(7,35,57,0.35)] backdrop-blur-lg'
          : 'border-transparent bg-transparent'
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[78rem] items-center justify-between gap-4 px-5 sm:h-[4.5rem] sm:px-8">
        <Link
          href="/"
          aria-label="Acme Jobs — home"
          className="shrink-0 rounded-lg transition-opacity hover:opacity-90"
        >
          <Logo tone={solid ? 'dark' : 'light'} />
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 items-center rounded-full px-3 text-[0.88rem] font-semibold tracking-[-0.01em] transition-colors duration-200',
                    solid
                      ? isActive(link.href)
                        ? 'bg-navy-50 text-navy-900'
                        : 'text-ink-soft hover:bg-navy-50 hover:text-navy-900'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/app"
                className={cn(
                  'ml-1 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.75rem] font-bold tracking-[0.06em] uppercase transition-colors duration-200',
                  solid
                    ? 'border-brand-200 bg-brand-50 text-brand-900 hover:border-brand-400 hover:bg-brand-100 border'
                    : 'text-brand-100 border border-white/25 bg-white/10 hover:border-white/50 hover:bg-white/15'
                )}
              >
                App
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[0.75rem] tracking-[0.08em]',
                    solid ? 'bg-brand-600 text-white' : 'bg-brand-500 text-navy-950'
                  )}
                >
                  Coming soon
                </span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex items-center gap-2.5">
          <CtaLink
            intent="free"
            size="sm"
            compact
            variant={solid ? 'accent' : 'outline-light'}
            className="hidden sm:inline-flex"
            data-testid="header-cta"
          >
            Start free
          </CtaLink>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-200 lg:hidden',
              solid
                ? 'border-line text-navy-800 hover:border-brand-400 hover:bg-brand-50 bg-white'
                : 'border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20'
            )}
          >
            {open ? (
              <X aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Menu aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        hidden={!open}
        className="border-line max-h-[calc(100dvh-4rem)] overflow-y-auto border-t bg-white lg:hidden"
      >
        <nav aria-label="Mobile" className="px-5 pt-4 pb-8 sm:px-8">
          <ul className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-3 py-3 text-base font-semibold transition-colors duration-200',
                    isActive(link.href)
                      ? 'bg-brand-50 text-brand-900'
                      : 'text-navy-800 hover:bg-navy-50'
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/app"
                className="border-brand-200 bg-brand-50 text-brand-900 mt-1 flex items-center justify-between rounded-xl border px-3 py-3 text-base font-semibold"
              >
                Acme Jobs App
                <span className="bg-brand-600 rounded-full px-2 py-0.5 text-[0.75rem] font-bold tracking-[0.08em] text-white uppercase">
                  Coming soon
                </span>
              </Link>
            </li>
          </ul>
          <div className="mt-6 flex flex-col gap-3">
            <CtaLink intent="free" size="lg" className="w-full justify-center">
              Start free
            </CtaLink>
            <CtaLink
              intent="complete"
              variant="outline"
              size="lg"
              className="w-full justify-center"
            >
              Explore Complete Edition
            </CtaLink>
          </div>
          <p className="text-ink-muted mt-6 text-center text-xs font-medium tracking-[0.08em] uppercase">
            Better Opportunities Ahead.
          </p>
        </nav>
      </div>
    </header>
  );
}

export default Header;
