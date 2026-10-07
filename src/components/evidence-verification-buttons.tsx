"use client";

import { useActionState } from "react";
import { changeVerificationAction } from "@/app/actions/app-actions";
import { IDLE } from "@/app/actions/state";
import type { ActionState } from "@/app/actions/state";
import type { VerificationStatus } from "@prisma/client";

export function EvidenceVerificationButtons({
  evidenceId,
  current,
}: {
  evidenceId: string;
  current: VerificationStatus;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    changeVerificationAction,
    IDLE,
  );

  const options: Array<{ to: VerificationStatus; label: string }> = [
    { to: "USER_CONFIRMED", label: "Confirm" },
    { to: "VERIFIED", label: "Mark verified" },
    { to: "REJECTED", label: "Reject" },
  ];

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        {options
          .filter((o) => o.to !== current)
          .map((o) => (
            <form key={o.to} action={formAction}>
              <input type="hidden" name="evidenceId" value={evidenceId} />
              <input type="hidden" name="to" value={o.to} />
              <button type="submit" className="btn-ghost" disabled={pending}>
                {o.label}
              </button>
            </form>
          ))}
      </div>
      {state.message ? (
        <span
          className="text-xs"
          style={{
            color: state.ok
              ? "var(--color-evidence-strong)"
              : "var(--color-evidence-missing)",
          }}
        >
          {state.message}
        </span>
      ) : null}
    </div>
  );
}
