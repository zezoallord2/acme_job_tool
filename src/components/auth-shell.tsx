import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/nav";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center px-4 py-10"
    >
      <div className="w-full max-w-[420px]">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 no-underline"
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold text-white"
            style={{ background: "var(--brand)" }}
            aria-hidden
          >
            A
          </span>
          <span className="text-base font-semibold tracking-tight text-[var(--text)]">
            Acme Jobs
          </span>
        </Link>

        <div className="card p-6">
          <h1 className="text-xl font-semibold text-[var(--text)]">{title}</h1>
          <p className="mt-1 mb-5 text-sm text-[var(--text-muted)]">
            {subtitle}
          </p>
          {children}
        </div>

        <p className="mt-5 flex items-center justify-center gap-1 text-center text-xs text-[var(--text-muted)]">
          <Icon name="shield" size={12} />
          Your career data stays in your own database.
        </p>
      </div>
    </main>
  );
}
