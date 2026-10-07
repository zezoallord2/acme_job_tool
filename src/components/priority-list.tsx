"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { PriorityItem } from "@/domain/priorities";

export function PriorityList({ items }: { items: PriorityItem[] }) {
  const [local, setLocal] = useState(items);
  const [pending, startTransition] = useTransition();

  if (local.length === 0) {
    return (
      <div className="card-muted p-4 text-sm text-[var(--text-muted)]">
        Nothing is due today. Add an interview date, set a follow-up reminder,
        or paste a job description to get useful priorities.
      </div>
    );
  }

  const handle = (key: string, action: "complete" | "snooze" | "dismiss") => {
    const target = local.find((i) => i.key === key);
    if (!target) return;
    startTransition(async () => {
      // Session-local dismissal: priorities are derived state, and persisting a
      // dismissal without a durable model would fake it.
      setLocal((prev) =>
        action === "snooze"
          ? prev.filter((i) => i.key !== key)
          : prev.filter((i) => i.key !== key),
      );
    });
  };

  return (
    <ol className="space-y-2.5">
      {local.map((item) => (
        <li
          key={item.key}
          className="card-muted p-3"
          style={{ opacity: pending ? 0.7 : 1 }}
        >
          <div className="flex flex-wrap items-start gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{
                background:
                  item.action === "OPTIONAL"
                    ? "var(--text-muted)"
                    : "var(--brand-accent)",
              }}
              aria-hidden
            >
              {item.rank}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--text)]">
                  {item.title}
                </h3>
                <span className="badge badge-unknown">{item.minutes} min</span>
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {item.detail}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                <span className="font-medium">Why:</span> {item.reason}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={item.href} className="btn-secondary">
                  Open
                </Link>
                {item.action === "DO" ? (
                  <>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => handle(item.key, "complete")}
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => handle(item.key, "snooze")}
                    >
                      Snooze
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => handle(item.key, "dismiss")}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
