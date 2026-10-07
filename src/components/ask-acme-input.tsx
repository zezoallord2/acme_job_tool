"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AskAcmeInput({ examples }: { examples: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/app/ask?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="label" htmlFor="ask-q">
        Your question
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="ask-q"
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What should I work on today?"
          maxLength={400}
          required
        />
        <button type="submit" className="btn-primary">
          Ask
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {examples.slice(0, 4).map((e) => (
          <button
            key={e}
            type="button"
            className="btn-ghost"
            onClick={() => setQ(e)}
          >
            {e}
          </button>
        ))}
      </div>
    </form>
  );
}
