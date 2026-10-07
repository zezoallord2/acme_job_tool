"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AI_MODES, type AIMode } from "@/domain/ai-modes";

/**
 * The AI mode picker.
 *
 * Deliberately three cards rather than a dropdown of provider names, because the
 * only decision a customer is making is who pays. A dropdown listing GEMINI /
 * OPENAI / ANTHROPIC answers a question nobody asked and hides the cost.
 */
export function AiModePicker({
  current,
  isComplete,
  saved,
  error,
}: {
  current: AIMode;
  isComplete: boolean;
  saved: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function choose(mode: AIMode) {
    if (mode === current) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/ai-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const visible = AI_MODES.filter((m) => {
    // Basic AI requires a paid plan. Everyone else can see it, but not select
    // it, so the offer stays visible without lying about availability.
    return m.availableOn !== "PAID" || isComplete;
  });

  return (
    <div className="space-y-3">
      {error ? (
        <p
          className="text-sm"
          style={{ color: "var(--color-evidence-missing)" }}
        >
          {error}
        </p>
      ) : null}
      {saved ? (
        <p
          className="text-sm"
          style={{ color: "var(--color-evidence-strong)" }}
        >
          Saved.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {visible.map((m) => {
          const locked = m.availableOn === "PAID" && !isComplete;
          const active = m.id === current;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => choose(m.id)}
              disabled={busy || locked || active}
              aria-pressed={active}
              className={`rounded-lg border p-3 text-left transition ${
                active ? "border-[var(--brand-accent)]" : ""
              }`}
              style={{
                background: "var(--color-surface-raised)",
                borderColor: active
                  ? "var(--brand-accent)"
                  : "var(--color-border)",
                opacity: locked ? 0.6 : 1,
                cursor: locked ? "not-allowed" : "pointer",
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--text)]">
                  {m.label}
                </span>
                {active ? (
                  <span className="badge badge-strong">Current</span>
                ) : null}
                {locked ? (
                  <span className="badge badge-partial">Paid plan</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {m.tagline}
              </p>
              <p className="mt-1.5 text-xs font-medium text-[var(--text)]">
                {m.costOwner}
              </p>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Manual Mode always remains available. Choosing Basic AI means every
        request is answered by a model rather than handed back as a brief.
      </p>
    </div>
  );
}
