"use client";

import { useActionState } from "react";
import { savePostReviewAction } from "@/app/actions/interview-actions";
import { IDLE } from "@/app/actions/state";
import type { ActionState } from "@/app/actions/state";
import { Alert, Field } from "@/components/ui/primitives";

export function PostReviewForm({
  interviewId,
  initial,
}: {
  interviewId: string;
  initial: Record<string, string> | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    savePostReviewAction,
    IDLE,
  );

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="interviewId" value={interviewId} />
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <Field label="What questions were you asked?" htmlFor="p-questions">
        <textarea
          id="p-questions"
          name="questionsAsked"
          className="input"
          style={{ minHeight: 70 }}
          defaultValue={initial?.questionsAsked ?? ""}
          maxLength={8000}
        />
      </Field>

      <Field label="What went well?" htmlFor="p-well">
        <textarea
          id="p-well"
          name="wentWell"
          className="input"
          style={{ minHeight: 70 }}
          defaultValue={initial?.wentWell ?? ""}
          maxLength={8000}
        />
      </Field>

      <Field label="What felt weak?" htmlFor="p-weak">
        <textarea
          id="p-weak"
          name="feltWeak"
          className="input"
          style={{ minHeight: 70 }}
          defaultValue={initial?.feltWeak ?? ""}
          maxLength={8000}
        />
      </Field>

      <Field label="What surprised you?" htmlFor="p-surprise">
        <textarea
          id="p-surprise"
          name="surprises"
          className="input"
          style={{ minHeight: 60 }}
          defaultValue={initial?.surprises ?? ""}
          maxLength={8000}
        />
      </Field>

      <Field
        label="What experience did you remember having?"
        htmlFor="p-remembered"
        hint="Anything you said in the interview that is not yet in your Evidence Ledger. This is what becomes a proposal."
      >
        <textarea
          id="p-remembered"
          name="rememberedExperience"
          className="input"
          style={{ minHeight: 90 }}
          defaultValue={initial?.rememberedExperience ?? ""}
          maxLength={8000}
          placeholder="I described training the two new support agents I onboarded in March."
        />
      </Field>

      <Field label="What did the interviewer focus on?" htmlFor="p-focus">
        <textarea
          id="p-focus"
          name="interviewerFocus"
          className="input"
          style={{ minHeight: 60 }}
          defaultValue={initial?.interviewerFocus ?? ""}
          maxLength={8000}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          name="followUpNeeded"
          value="true"
          defaultChecked={initial?.followUpNeeded === "true"}
        />
        Send a thank-you note
      </label>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save review"}
      </button>
    </form>
  );
}
