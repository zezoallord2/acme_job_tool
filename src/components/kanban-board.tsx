"use client";

import Link from "next/link";
import type { TrackerRow } from "@/services/application-service";

export function KanbanBoard({
  columns,
}: {
  columns: Array<{ label: string; rows: TrackerRow[] }>;
}) {
  if (columns.every((c) => c.rows.length === 0)) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No applications to place yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {columns.map((col) => (
        <section key={col.label} aria-label={col.label}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {col.label} ({col.rows.length})
          </h3>
          <ul className="space-y-2">
            {col.rows.length === 0 ? (
              <li className="text-xs text-[var(--text-muted)]">Empty</li>
            ) : (
              col.rows.map((r) => (
                <li key={r.id} className="card-muted p-2.5">
                  <Link
                    href={`/app/applications/${r.id}`}
                    className="text-xs font-medium text-[var(--text)] underline"
                  >
                    {r.company ?? "Unnamed"}
                  </Link>
                  <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                    {r.role ?? "Role not set"}
                  </span>
                  {r.nextAction ? (
                    <span className="mt-1 block text-[11px] text-[var(--text-muted)]">
                      {r.nextAction}
                    </span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
