"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { proposalAction } from "@/app/actions/app-actions";

export function ProposalActions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const decide = (decision: "ACCEPT" | "IGNORE") => {
    const fd = new FormData();
    fd.set("proposalId", proposalId);
    fd.set("decision", decision);
    startTransition(async () => {
      const result = await proposalAction({ ok: true }, fd);
      setMessage({ ok: result.ok, text: result.message ?? "" });
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => decide("ACCEPT")}
          disabled={pending}
        >
          Add
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => decide("IGNORE")}
          disabled={pending}
        >
          Ignore
        </button>
        <a href="/app/evidence/new" className="btn-ghost">
          Review
        </a>
      </div>
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
