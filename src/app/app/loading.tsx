export default function WorkspaceLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4 py-4">
      <p className="text-sm text-[var(--text-muted)]">Loading your workspace…</p>
      <div aria-hidden="true" className="animate-pulse space-y-4">
        <div className="h-8 w-1/3 rounded bg-[var(--surface-muted)]" />
        <div className="h-40 rounded-xl bg-[var(--surface-muted)]" />
      </div>
    </div>
  );
}
