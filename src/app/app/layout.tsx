import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getEntitlementState } from "@/services/entitlement-service";
import { DesktopNav, MobileNav } from "@/components/nav";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [entitlement, unreadNotifications] = await Promise.all([
    getEntitlementState(user.id),
    prisma.notification.count({ where: { userId: user.id, status: "UNREAD" } }),
  ]);

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <header
        className="app-header sticky top-0 z-30 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-3 py-2.5 sm:px-4">
          <a href="/app" className="flex items-center gap-2 no-underline">
            <Logo size={30} />
          </a>
          <span className="hidden text-xs text-[var(--text-muted)] md:inline">
            Better Opportunities Ahead
          </span>

          <div className="ml-auto flex items-center gap-2">
            <a
              href="/app/notifications"
              className="btn-ghost relative"
              aria-label={`${unreadNotifications} unread notifications`}
            >
              <span aria-hidden>NOTICES</span>
              {unreadNotifications > 0 ? (
                <span className="badge badge-partial px-1.5 py-0 text-[10px]">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              ) : null}
            </a>
            <a
              href="/app/ask"
              className="btn-ghost hidden sm:inline-flex"
              style={{ border: "1px solid var(--border)" }}
            >
              Acme Assistant
            </a>
            <span
              className="badge"
              style={{
                background: entitlement.isComplete
                  ? "var(--brand-accent-soft)"
                  : "var(--surface-muted)",
                color: entitlement.isComplete
                  ? "var(--brand-accent)"
                  : "var(--text-muted)",
              }}
            >
              {entitlement.isComplete ? "Complete" : "Starter"}
            </span>
            {user.isAdmin || user.isInternal ? (
              <a href="/admin" className="btn-ghost hidden md:inline-flex">
                Debug
              </a>
            ) : null}
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="btn-ghost" aria-label="Sign out">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 gap-5 px-3 py-4 sm:px-4">
        <DesktopNav />
        <main id="main" className="min-w-0 flex-1 pb-20">
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
