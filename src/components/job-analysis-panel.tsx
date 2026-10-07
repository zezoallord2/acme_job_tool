"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitAnalysisAction } from "@/app/actions/job-actions";
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
            View evidence matrix
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

      <ManualModePanel
        prompt={prompt}
        busy={isPending}
        onValidate={validate}
        actionLabel="Saving the analysis and rebuilding the evidence matrix"
      />

      <details className="card-muted p-3">
        <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">
          Already have a response? Paste and save
        </summary>
        <textarea
          className="input mt-2 font-mono"
          style={{ minHeight: 200 }}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Paste the JSON or fenced JSON here"
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
