"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimDecisionAction } from "@/app/actions/app-actions";

export function ClaimActions({
  claimId,
  claimText,
}: {
  claimId: string;
  claimText: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(claimText);
  const [acceptWithoutEvidence, setAcceptWithoutEvidence] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const decide = (decision: "CONFIRM" | "REJECT") => {
    const fd = new FormData();
    fd.set("claimId", claimId);
    fd.set("decision", decision);
    startTransition(async () => {
      const result = await claimDecisionAction({ ok: true }, fd);
      setMessage({ ok: result.ok, text: result.message ?? "" });
      if (result.ok) router.refresh();
    });
  };

  const saveEdit = () => {
    const fd = new FormData();
    fd.set("claimId", claimId);
    fd.set("decision", "EDIT");
    fd.set("newText", text);
    fd.set("acceptWithoutEvidence", String(acceptWithoutEvidence));
    startTransition(async () => {
      const result = await claimDecisionAction({ ok: true }, fd);
      setMessage({ ok: result.ok, text: result.message ?? "" });
      if (result.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => decide("CONFIRM")}
          disabled={pending}
        >
          Confirm
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setEditing((v) => !v)}
          disabled={pending}
        >
          {editing ? "Cancel" : "Edit"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => decide("REJECT")}
          disabled={pending}
        >
          Remove
        </button>
        <a href="/app/evidence" className="btn-ghost">
          Add evidence
        </a>
      </div>

      {editing ? (
        <div className="mt-2 w-full max-w-sm space-y-2">
          <label className="label" htmlFor={`claim-edit-${claimId}`}>
            Corrected wording
          </label>
          <textarea
            id={`claim-edit-${claimId}`}
            className="input"
            style={{ minHeight: 80 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={acceptWithoutEvidence}
              onChange={(e) => setAcceptWithoutEvidence(e.target.checked)}
            />
            I can defend this without linking evidence (it stays marked as
            needing confirmation)
          </label>
          <button
            type="button"
            className="btn-secondary"
            onClick={saveEdit}
            disabled={pending}
          >
            Save correction
          </button>
        </div>
      ) : null}

      {message ? (
        <span
          className="text-xs"
          style={{
            color: message.ok
              ? "var(--color-evidence-strong)"
              : "var(--color-evidence-missing)",
          }}
        >
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
