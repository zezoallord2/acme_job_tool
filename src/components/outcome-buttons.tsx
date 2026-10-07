"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordOutcomeAction } from "@/app/actions/app-actions";

const OUTCOMES = [
  { type: "REPLIED", label: "Reply received" },
  { type: "SCREENING", label: "Moved to screening" },
  { type: "INTERVIEW", label: "Interview scheduled" },
  { type: "OFFER", label: "Offer received" },
  { type: "REJECTED", label: "Rejected" },
  { type: "WITHDRAWN", label: "I withdrew" },
] as const;

export function OutcomeButtons({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [detail, setDetail] = useState("");

  const record = (type: string) => {
    const fd = new FormData();
    fd.set("applicationId", applicationId);
    fd.set("type", type);
    fd.set("detail", detail);
    startTransition(async () => {
      const result = await recordOutcomeAction({ ok: true }, fd);
      setMessage({ ok: result.ok, text: result.message ?? "" });
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="space-y-2.5">
      <div>
        <label className="label" htmlFor="outcome-detail">
          Detail (optional)
        </label>
        <input
          id="outcome-detail"
          className="input"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          maxLength={200}
          placeholder="Rejected after first interview"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {OUTCOMES.map((o) => (
          <button
            key={o.type}
            type="button"
            className="btn-ghost"
            onClick={() => record(o.type)}
            disabled={pending}
          >
            {o.label}
          </button>
        ))}
      </div>
      {message ? (
        <p
          role="status"
          className="text-xs"
          style={{
            color: message.ok
              ? "var(--color-evidence-strong)"
              : "var(--color-evidence-missing)",
          }}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
