"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transitionApplicationAction } from "@/app/actions/app-actions";
import { STATUS_LABELS, allowedTransitions } from "@/domain/application-state";
import type { ApplicationStatus } from "@prisma/client";

export function TransitionButtons({
  applicationId,
  status,
  allowed,
}: {
  applicationId: string;
  status: ApplicationStatus;
  allowed: ApplicationStatus[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [reason, setReason] = useState("");

  const move = (to: ApplicationStatus) => {
    const fd = new FormData();
    fd.set("applicationId", applicationId);
    fd.set("to", to);
    fd.set("reason", reason);
    // Sealing happens atomically with the transition to APPLIED.
    if (to === "APPLIED") fd.set("seal", "true");
    startTransition(async () => {
      const result = await transitionApplicationAction({ ok: true }, fd);
      setMessage({ ok: result.ok, text: result.message ?? "" });
      if (result.ok) router.refresh();
    });
  };

  if (allowed.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        This application is {STATUS_LABELS[status].toLowerCase()} and has no
        further transitions.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="transition-reason">
          Reason (optional, recorded in history)
        </label>
        <input
          id="transition-reason"
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder="Recruiter confirmed interview"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {allowed.map((to) => (
          <button
            key={to}
            type="button"
            className={
              to === "APPLIED"
                ? "btn-primary"
                : to === "REJECTED"
                  ? "btn-danger"
                  : "btn-secondary"
            }
            onClick={() => move(to)}
            disabled={pending}
          >
            Move to {STATUS_LABELS[to]}
            {to === "APPLIED" ? " (seals snapshot)" : ""}
          </button>
        ))}
      </div>

      {message ? (
        <p
          role="status"
          className="text-sm"
          style={{
            color: message.ok
              ? "var(--color-evidence-strong)"
              : "var(--color-evidence-missing)",
          }}
        >
          {message.text}
        </p>
      ) : null}

      <p className="text-xs text-[var(--text-muted)]">
        Currently {STATUS_LABELS[status]}. Allowed next:{" "}
        {allowed.map((s) => STATUS_LABELS[s]).join(", ")}. Any other move is
        rejected by the server and recorded in the Debug Center.
      </p>
      <span className="hidden">{allowedTransitions(status).length}</span>
    </div>
  );
}
