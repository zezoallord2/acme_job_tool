"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/primitives";

/**
 * Manual Mode client component: the secondary path when the user chooses it or
 * when hosted AI is unavailable. AI is the default everywhere; this panel only
 * appears after an explicit "Use manual mode" click or an AI failure.
 *
 * Flow: build prompt -> copy -> user runs it in their own assistant -> paste ->
 * validate -> continue.
 */
export interface ManualPromptPayload {
  workflowId: string;
  promptVersion: string;
  title: string;
  instructions: string;
  systemPrompt: string;
  userPrompt: string;
  outputContract: string;
  fullPrompt: string;
  expectedShape: string;
  pasteHint: string;
  validationNotes: string[];
  zeroCostNote: string;
}

export interface ManualWorkflowState {
  step: "PROMPT" | "AWAITING_PASTE" | "VALIDATED";
  copied: boolean;
  validationErrors: string[];
  repaired: boolean;
}

export function ManualModePanel({
  prompt,
  onValidate,
  busy,
  validationResult,
  actionLabel = "Validate and continue",
}: {
  prompt: ManualPromptPayload;
  onValidate: (
    raw: string,
  ) => Promise<{ ok: boolean; errors: string[]; repaired: boolean }>;
  busy?: boolean;
  validationResult?: { ok: boolean; errors: string[] } | null;
  actionLabel?: string;
}) {
  const [state, setState] = useState<ManualWorkflowState>({
    step: "PROMPT",
    copied: false,
    validationErrors: [],
    repaired: false,
  });
  const [raw, setRaw] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt.fullPrompt);
      setState((s) => ({ ...s, copied: true, step: "AWAITING_PASTE" }));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(
        () => setState((s) => ({ ...s, copied: false })),
        2500,
      );
    } catch {
      setState((s) => ({
        ...s,
        copied: false,
        validationErrors: [
          "Clipboard access was blocked. Select the text and copy it manually.",
        ],
      }));
    }
  }, [prompt.fullPrompt]);

  const validate = useCallback(async () => {
    if (!raw.trim()) return;
    const result = await onValidate(raw);
    setState({
      step: result.ok ? "VALIDATED" : "AWAITING_PASTE",
      copied: false,
      validationErrors: result.errors,
      repaired: result.repaired,
    });
  }, [raw, onValidate]);

  return (
    <div className="space-y-4">
      <Alert tone="info" title={`Manual Mode — ${prompt.zeroCostNote}`}>
        {prompt.instructions}
      </Alert>

      <ol
        className="flex flex-wrap items-center gap-2 text-xs"
        aria-label="Manual mode steps"
      >
        {(
          ["Copy prompt", "Paste response", "Validate", "Continue"] as const
        ).map((label, i) => {
          const activeIndex =
            state.step === "PROMPT"
              ? 0
              : state.step === "AWAITING_PASTE"
                ? 1
                : 3;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                style={{
                  background:
                    i <= activeIndex
                      ? "var(--brand-accent)"
                      : "var(--surface-muted)",
                  color: i <= activeIndex ? "#fff" : "var(--text-muted)",
                }}
                aria-hidden
              >
                {i + 1}
              </span>
              <span
                className={
                  i === activeIndex
                    ? "font-semibold text-[var(--text)]"
                    : "text-[var(--text-muted)]"
                }
              >
                {label}
              </span>
              {i < 3 ? (
                <span className="text-[var(--text-muted)]">→</span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--text)]">
              1. Copy the prompt
            </h3>
            <button type="button" className="btn-primary" onClick={copy}>
              {state.copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
          <p className="hint mb-2">
            Prompt version{" "}
            <code className="font-mono">{prompt.promptVersion}</code>. The
            prompt is self-contained: it includes the rules and everything Acme
            Jobs knows about this request.
          </p>
          <textarea
            className="input font-mono"
            style={{ minHeight: 320 }}
            readOnly
            value={prompt.fullPrompt}
            aria-label="AI prompt to copy"
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">
            2. Paste the AI response
          </h3>
          <p className="hint mb-2">{prompt.pasteHint}</p>
          <textarea
            className="input font-mono"
            style={{ minHeight: 320 }}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={
              prompt.expectedShape === "JSON"
                ? '{ "...": "..." }'
                : "Paste the assistant response here…"
            }
            aria-label="AI response to validate"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={validate}
              disabled={busy || !raw.trim()}
            >
              {busy ? "Validating…" : "3. Validate response"}
            </button>
            {state.step === "VALIDATED" ? (
              <span className="text-sm font-medium text-[var(--color-evidence-strong)]">
                Response accepted.
              </span>
            ) : null}
          </div>

          {state.validationErrors.length > 0 ? (
            <div className="mt-3">
              <Alert tone="error" title="That response was not accepted">
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {state.validationErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                <p className="mt-2">
                  Nothing was changed. Correct the response and validate again —
                  Acme Jobs never guesses at a malformed result.
                </p>
              </Alert>
            </div>
          ) : null}

          {state.repaired ? (
            <div className="mt-3">
              <Alert tone="warning">
                Local repair was applied (fenced block, trailing commas or
                quotes). Review the result before continuing.
              </Alert>
            </div>
          ) : null}

          {validationResult && !validationResult.ok ? (
            <div className="mt-3">
              <Alert tone="error" title="Validation failed">
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {validationResult.errors.slice(0, 6).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Alert>
            </div>
          ) : null}
        </div>
      </div>

      <details className="card-muted p-3">
        <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">
          Expected output contract
        </summary>
        <p className="hint mt-2">
          Accepts a bare JSON object or one wrapped in a ```json fence.
        </p>
        <pre className="code-block mt-2">{prompt.outputContract}</pre>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-[var(--text-muted)]">
          {prompt.validationNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>

      <p className="text-xs text-[var(--text-muted)]">
        {actionLabel} runs after validation succeeds.
      </p>
    </div>
  );
}
