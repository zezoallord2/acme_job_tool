"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  analyzeJobAction,
  submitAnalysisAction,
} from "@/app/actions/job-actions";
import { IDLE_ANALYSIS, type AnalysisSubmitResult } from "@/app/actions/state";
import {
  ManualModePanel,
  type ManualPromptPayload,
} from "@/components/manual-mode-panel";
import { Alert } from "@/components/ui/primitives";

export function JobAnalysisPanel({
  jobId,
  prompt,
  initialMessage,
}: {
  jobId: string;
  prompt: ManualPromptPayload;
  initialMessage?: string | null;
}) {
  const router = useRouter();
  // `submitted` distinguishes "nothing has been sent yet" from a real result, so
  // the panel never claims success before the user has actually pasted a response.
  const [submitted, setSubmitted] = useState(false);
  const [state, setState] = useState<AnalysisSubmitResult>(IDLE_ANALYSIS);
  const [raw, setRaw] = useState("");
  const [isPending, startTransition] = useTransition();

  const validate = (
    text: string,
  ): Promise<{ ok: boolean; errors: string[]; repaired: boolean }> => {
    const fd = new FormData();
    fd.set("jobId", jobId);
    fd.set("raw", text);
    return new Promise((resolve) => {
      startTransition(async () => {
        setSubmitted(true);
        const result = await submitAnalysisAction(IDLE_ANALYSIS, fd);
        setState(result);
        resolve({
          ok: result.ok,
          errors: result.errors ?? [],
          repaired: Boolean(result.repaired),
        });
      });
    });
  };

  const analyze = () => {
    const fd = new FormData();
    fd.set("jobId", jobId);
    startTransition(async () => {
      setSubmitted(true);
      const result = await analyzeJobAction(IDLE_ANALYSIS, fd);
      setState(result);
      if (result.ok) router.refresh();
    });
  };

  if (submitted && state.ok) {
    return (
      <Alert
        tone="success"
        title="Analysis saved"
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => router.push(`/app/jobs/${jobId}`)}
          >
            View match breakdown
          </button>
        }
      >
        {state.message}
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {initialMessage ? <Alert tone="info">{initialMessage}</Alert> : null}

      {submitted && !state.ok && state.message ? (
        <Alert tone="error" title="Analysis not saved">
          {state.message}
        </Alert>
      ) : null}

      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)" }}
      >
        <h3 className="font-semibold text-[var(--text)]">
          Check this job with Acme
        </h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          One click finds the important requirements and compares them with your
          confirmed experience.
        </p>
        <button
          type="button"
          className="btn-primary mt-3"
          disabled={isPending}
          onClick={analyze}
        >
          {isPending ? "Analyzing…" : "Analyze Job"}
        </button>
      </div>

      <details className="card-muted p-3">
        <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">
          Manual Mode (advanced fallback)
        </summary>
        <div className="mt-3">
          <ManualModePanel
            prompt={prompt}
            busy={isPending}
            onValidate={validate}
            actionLabel="Saving the analysis and rebuilding the match breakdown"
          />
        </div>
        <textarea
          className="input mt-2 font-mono"
          style={{ minHeight: 200 }}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Paste the JSON response here"
          aria-label="AI response for analysis"
        />
        <button
          type="button"
          className="btn-primary mt-2"
          disabled={isPending || !raw.trim()}
          onClick={() => validate(raw)}
        >
          Validate and save
        </button>
      </details>
    </div>
  );
}
