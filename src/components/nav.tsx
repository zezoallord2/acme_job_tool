"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS = [
  { href: "/app", label: "Dashboard", short: "Home", icon: "grid" },
  {
    href: "/app/guide",
    label: "How Acme Works",
    short: "Guide",
    icon: "map",
  },
  {
    href: "/app/career",
    label: "Career Profile",
    short: "Career",
    icon: "user",
  },
  {
    href: "/app/evidence",
    label: "Evidence & Proof",
    short: "Evidence",
    icon: "shield",
  },
  { href: "/app/jobs", label: "Jobs", short: "Jobs", icon: "briefcase" },
  {
    href: "/app/applications",
    label: "Applications",
    short: "Apps",
    icon: "send",
  },
  { href: "/app/resumes", label: "Resumes", short: "Resumes", icon: "file" },
  {
    href: "/app/interviews",
    label: "Interviews",
    short: "Interviews",
    icon: "calendar",
  },
  {
    href: "/app/follow-ups",
    label: "Follow-ups",
    short: "Follow-ups",
    icon: "bell",
  },
  {
    href: "/app/studio",
    label: "Application Writing",
    short: "Writing",
    icon: "pen",
  },
  {
    href: "/app/claims",
    label: "Check AI Claims",
    short: "Claims",
    icon: "check",
  },
  {
    href: "/app/opportunities",
    label: "Compare Jobs",
    short: "Compare",
    icon: "scale",
  },
  { href: "/app/analytics", label: "Analytics", short: "Stats", icon: "chart" },
  {
    href: "/app/learning",
    label: "Suggested Facts",
    short: "Suggestions",
    icon: "brain",
  },
  {
    href: "/app/sprint",
    label: "14-Day Sprint",
    short: "Sprint",
    icon: "sprint",
  },
  {
    href: "/app/notifications",
    label: "Notifications",
    short: "Alerts",
    icon: "bell",
  },
  { href: "/app/settings", label: "Settings", short: "Settings", icon: "cog" },
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
      <ul className="sticky top-[62px] space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] no-underline transition-colors"
                style={{
                  background: active
                    ? "var(--brand-accent-soft)"
                    : "transparent",
                  color: active ? "var(--brand-accent)" : "var(--text-muted)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon name={item.icon} />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.slice(0, 5);
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-30 border-t lg:hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] no-underline"
                style={{
                  color: active ? "var(--brand-accent)" : "var(--text-muted)",
                }}
              >
                <Icon name={item.icon} size={17} />
                <span className="w-full truncate text-center">
                  {item.short}
                </span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <Link
            href="/app/settings"
            className="flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] no-underline"
            style={{
              color: pathname.startsWith("/app/settings")
                ? "var(--brand-accent)"
                : "var(--text-muted)",
            }}
          >
            <Icon name="menu" size={17} />
            <span>More</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
