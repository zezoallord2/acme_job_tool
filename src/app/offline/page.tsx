import Link from "next/link";

export const metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

/**
 * Shown when the app is launched without a connection.
 *
 * It says plainly what is and is not available. Nothing here pretends a cached
 * claim is current, because a stale career fact is worse than no answer.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6 py-16">
      <div>
        <p className="text-xs font-semibold tracking-wide text-[var(--brand-accent)] uppercase">
          No connection
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)]">
          Acme Jobs cannot reach the server
        </h1>
      </div>

      <p className="text-sm text-[var(--text-muted)]">
        Your career data is stored on the server, not on this device, so there
        is nothing safe to show you from a cache. Evidence, claims and
        applications are never served from a stale copy.
      </p>

      <ul className="card-muted space-y-2 p-4 text-sm text-[var(--text-muted)]">
        <li>Check your internet connection and try again.</li>
        <li>
          If you are running this locally, confirm the server is up:{" "}
          <code className="font-mono">npm run dev</code>
        </li>
        <li>
          If the server is running but still unreachable, check{" "}
          <Link href="/api/health" className="underline">
            the health endpoint
          </Link>
          .
        </li>
      </ul>

      <Link href="/app" className="btn-primary self-start">
        Try again
      </Link>
    </main>
  );
}
