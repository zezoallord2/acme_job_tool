"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navigation.
 *
 * Written by asking one question of every label: "if you had never seen this
 * product, would you know what this screen does?" The previous set failed that
 * test badly -- "Evidence & Proof", "Check AI Claims", "Suggested Facts" and
 * "Best Jobs" are internal vocabulary, not user vocabulary.
 *
 * The order is the order a person actually works in: fix the CV, find a job,
 * track it, prepare for the interview. Everything else follows.
 *
 * URLs are unchanged; only the words a user reads moved.
 */
export const NAV_ITEMS = [
  { href: "/app", label: "Dashboard", short: "Home", icon: "grid" },
  { href: "/app/jobs", label: "Jobs", short: "Jobs", icon: "briefcase" },
  {
    href: "/app/job-analysis",
    label: "Job Analysis",
    short: "Analyze",
    icon: "check",
  },
  { href: "/app/resumes", label: "Resume", short: "Resume", icon: "file" },
  {
    href: "/app/applications",
    label: "Applications",
    short: "Applications",
    icon: "send",
  },
  {
    href: "/app/interviews",
    label: "Interview",
    short: "Interview",
    icon: "calendar",
  },
  { href: "/app/profile", label: "Profile", short: "Profile", icon: "user" },
] as const;

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  const paths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
      </>
    ),
    send: (
      <>
        <path d="M21 3L3 10.5l7 3 3 7z" />
        <path d="M21 3l-11 10.5" />
      </>
    ),
    file: (
      <>
        <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
        <path d="M14 3v5h5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
    star: (
      <>
        <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
      </>
    ),
    check: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </>
    ),
    scale: (
      <>
        <path d="M12 3v18M5 7h14M5 7l-3 6h6zM19 7l-3 6h6z" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    brain: (
      <>
        <path d="M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 001 5 3 3 0 005 2V4z" />
        <path d="M15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-1 5 3 3 0 01-5 2V4z" />
      </>
    ),
    cog: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
        <path d="M13.7 21a2 2 0 01-3.4 0" />
      </>
    ),
    menu: (
      <>
        <path d="M3 6h18M3 12h18M3 18h18" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </>
    ),
    spark: (
      <>
        <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z" />
      </>
    ),
    sprint: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2M8 3l-2-1M16 3l2-1" />
      </>
    ),
    back: (
      <>
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </>
    ),
    pen: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
      </>
    ),
    map: (
      <>
        <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
  };
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>;
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="hidden w-[206px] shrink-0 lg:block">
      <div className="editorial-sidebar">
        <p className="sidebar-eyebrow">Your workspace</p>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/app" && pathname.startsWith(`${item.href}/`));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="nav-link flex items-center gap-2.5 px-2.5 py-[9px] text-[13px] no-underline"
                  style={{
                    background: active
                      ? "var(--brand-accent-soft)"
                      : "transparent",
                    color: active ? "var(--brand-accent)" : "var(--text-muted)",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <Icon name={item.icon} size={18} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/app/settings"
          className="nav-link mt-5 flex items-center gap-2.5 px-2.5 py-[9px] text-[13px] no-underline"
          aria-current={pathname === "/app/settings" ? "page" : undefined}
        >
          <Icon name="cog" size={18} /> Settings
        </Link>
        <div className="sidebar-note">
          <svg
            className="sidebar-botanical"
            viewBox="0 0 130 150"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M28 145C44 104 66 68 106 16M44 110L18 65M62 79L56 31M78 56L119 45"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M44 112C19 108 11 87 18 65C35 72 43 85 44 112ZM61 83C41 65 43 45 56 31C69 50 71 63 61 83ZM77 60C83 34 96 23 106 16C111 37 101 52 77 60ZM78 58C93 42 111 40 124 45C112 61 96 66 78 58ZM48 106C70 88 85 88 97 93C86 108 70 113 48 106ZM31 139C13 127 7 113 10 97C29 106 36 120 31 139Z"
              fill="currentColor"
              fillOpacity=".22"
              stroke="currentColor"
              strokeOpacity=".5"
            />
          </svg>
          <p>
            A more fulfilling career
            <br />
            starts with your next move.
          </p>
        </div>
      </div>
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS;
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-30 border-t lg:hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-0.5 px-1 py-3 text-[10px] font-semibold uppercase tracking-tight no-underline"
                style={{
                  color: active ? "var(--brand-accent)" : "var(--text-muted)",
                }}
              >
                <Icon name={item.icon} size={18} />
                <span className="w-full truncate text-center">
                  {item.short}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
