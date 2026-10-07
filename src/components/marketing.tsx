import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/nav";

export function MarketingNav({ current }: { current?: string }) {
  const links = [
    { href: "/free", label: "Free" },
    { href: "/complete", label: "Complete Edition" },
    { href: "/pricing", label: "Pricing" },
    { href: "/about", label: "About" },
    { href: "/faq", label: "FAQ" },
  ];
  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="mx-auto flex max-w-[1160px] items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-white"
            style={{ background: "var(--brand)" }}
            aria-hidden
          >
            A
          </span>
          <span className="text-sm font-semibold tracking-tight text-[var(--text)]">
            Acme Jobs
          </span>
        </Link>
        <nav
          aria-label="Public"
          className="ml-2 hidden items-center gap-1 md:flex"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={current === l.href ? "page" : undefined}
              className="rounded-md px-2.5 py-1.5 text-[13px] no-underline"
              style={{
                color:
                  current === l.href
                    ? "var(--brand-accent)"
                    : "var(--text-muted)",
                fontWeight: current === l.href ? 600 : 500,
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="btn-ghost">
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary">
            Start free
          </Link>
        </div>
      </div>
      <nav
        aria-label="Public mobile"
        className="flex gap-1 overflow-x-auto border-t px-3 py-1.5 md:hidden"
        style={{ borderColor: "var(--border)" }}
      >
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-md px-2 py-1 text-xs no-underline"
            style={{ color: "var(--text-muted)" }}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t py-8" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto flex max-w-[1160px] flex-col gap-4 px-4 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center">
        <span>
          © {new Date().getFullYear()} Acme Jobs. Better Opportunities Ahead.
        </span>
        <div className="flex flex-wrap gap-4 sm:ml-auto">
          <Link href="/about" className="underline">
            About
          </Link>
          <Link href="/faq" className="underline">
            FAQ
          </Link>
          <Link href="/pricing" className="underline">
            Pricing
          </Link>
          <span className="inline-flex items-center gap-1">
            <Icon name="shield" size={12} /> Self-hosted, zero mandatory cost
          </span>
        </div>
      </div>
    </footer>
  );
}

export function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede: string;
  children?: ReactNode;
}) {
  return (
    <section className="px-4 pb-8 pt-10">
      <div className="mx-auto max-w-[880px]">
        {eyebrow ? (
          <p
            className="text-xs font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--brand-accent)" }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-[26px] font-semibold leading-[1.2] tracking-tight text-[var(--text)] sm:text-[34px]">
          {title}
        </h1>
        <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-[var(--text-muted)]">
          {lede}
        </p>
        {children ? (
          <div className="mt-6 flex flex-wrap gap-2.5">{children}</div>
        ) : null}
      </div>
    </section>
  );
}
