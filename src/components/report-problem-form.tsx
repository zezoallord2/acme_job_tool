"use client";

import { useActionState, useState } from "react";
import { reportProblemAction } from "@/app/actions/app-actions";
import { IDLE } from "@/app/actions/state";
import type { ActionState } from "@/app/actions/state";
import { Alert, Field } from "@/components/ui/primitives";

export function ReportProblemForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reportProblemAction,
    IDLE,
  );
  const [diagnostics, setDiagnostics] = useState(false);
  const [route, setRoute] = useState("");

  return (
    <form
      action={formAction}
      className="space-y-3"
      noValidate
      onSubmit={() => {
        setRoute(typeof window !== "undefined" ? window.location.pathname : "");
      }}
    >
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <Field label="What were you trying to do?" htmlFor="b-attempted" required>
        <textarea
          id="b-attempted"
          name="whatAttempted"
          className="input"
          style={{ minHeight: 60 }}
          required
          maxLength={2000}
        />
      </Field>

      <Field label="What happened?" htmlFor="b-happened" required>
        <textarea
          id="b-happened"
          name="whatHappened"
          className="input"
          style={{ minHeight: 80 }}
          required
          maxLength={4000}
        />
      </Field>

      <Field label="Steps to reproduce" htmlFor="b-steps" hint="Optional.">
        <textarea
          id="b-steps"
          name="steps"
          className="input"
          style={{ minHeight: 60 }}
          maxLength={4000}
        />
      </Field>

      <label className="flex items-start gap-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          name="includeDiagnostics"
          value="true"
          checked={diagnostics}
          onChange={(e) => setDiagnostics(e.target.checked)}
          className="mt-1"
        />
        <span>
          Include technical diagnostics
          <span className="block text-xs text-[var(--text-muted)]">
            Route, app version, browser, OS, feature flags, prompt versions and
            trace id. Never your resume text, answers or credentials.
          </span>
        </span>
      </label>

      <input type="hidden" name="route" value={route} />

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Sending…" : "Report a problem"}
      </button>
    </form>
  );
}
