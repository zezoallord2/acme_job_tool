export interface FunnelStage {
  label: string;
  value: number;
}

export function FunnelBar({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  const total = stages.reduce((s, x) => s + x.value, 0);

  if (total === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No applications recorded yet. The funnel fills in as you add and submit
        applications.
      </p>
    );
  }

  return (
    <div>
      <ul className="space-y-2">
        {stages.map((s) => (
          <li key={s.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">{s.label}</span>
              <span className="font-medium tabular-nums text-[var(--text)]">
                {s.value}
              </span>
            </div>
            <div
              className="mt-1 h-2 w-full overflow-hidden rounded-full"
              style={{ background: "var(--surface-muted)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(s.value / max) * 100}%`,
                  background:
                    s.label === "Offer"
                      ? "var(--color-evidence-strong)"
                      : "var(--brand-accent)",
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Total {total} application{total === 1 ? "" : "s"}. This is a count, not
        a prediction.
      </p>
    </div>
  );
}
