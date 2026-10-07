import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-[640px] px-4 py-16">
      <div className="card p-6 text-center">
        <h1 className="text-xl font-semibold text-[var(--text)]">Not found</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          That record does not exist, or it belongs to another account. We do
          not reveal which.
        </p>
        <Link href="/app" className="btn-primary mt-5">
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
