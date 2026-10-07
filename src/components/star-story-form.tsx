"use client";

import { useActionState } from "react";
import { createStarStoryAction } from "@/app/actions/interview-actions";
import { IDLE } from "@/app/actions/state";
import type { ActionState } from "@/app/actions/state";
import { Alert, Field } from "@/components/ui/primitives";

const CATEGORIES = [
  ["ACHIEVEMENT", "Achievement"],
  ["LEADERSHIP", "Leadership"],
  ["FAILURE", "Failure"],
  ["CONFLICT", "Conflict"],
  ["TEAMWORK", "Teamwork"],
  ["PROBLEM_SOLVING", "Problem solving"],
  ["DEADLINE", "Deadline"],
  ["CUSTOMER", "Customer"],
  ["LEARNING", "Learning"],
  ["INITIATIVE", "Initiative"],
] as const;

export function StarStoryForm({ disabled }: { disabled: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createStarStoryAction,
    IDLE,
  );

  if (disabled) {
    return (
      <Alert tone="warning">
        You have reached the Starter limit of one STAR story. Upgrade in
        Settings to build a full bank.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" htmlFor="s-title" required>
          <input
            id="s-title"
            name="title"
            className="input"
            required
            maxLength={200}
            placeholder="Rebuilt the weekly operations report"
          />
        </Field>
        <Field label="Category" htmlFor="s-category" required>
          <select
            id="s-category"
            name="category"
            className="input"
            defaultValue="ACHIEVEMENT"
          >
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Situation" htmlFor="s-situation" required>
        <textarea
          id="s-situation"
          name="situation"
          className="input"
          style={{ minHeight: 60 }}
          required
          minLength={3}
        />
      </Field>
      <Field label="Task" htmlFor="s-task" required>
        <textarea
          id="s-task"
          name="task"
          className="input"
          style={{ minHeight: 60 }}
          required
          minLength={3}
        />
      </Field>
      <Field
        label="Action"
        htmlFor="s-action"
        required
        hint="What you personally did. Not what the team did."
      >
        <textarea
          id="s-action"
          name="action"
          className="input"
          style={{ minHeight: 80 }}
          required
          minLength={3}
        />
      </Field>
      <Field
        label="Result"
        htmlFor="s-result"
        required
        hint="Only include a number you can actually defend."
      >
        <textarea
          id="s-result"
          name="result"
          className="input"
          style={{ minHeight: 60 }}
          required
          minLength={3}
        />
      </Field>
      <Field label="What you learned" htmlFor="s-learning" hint="Optional.">
        <textarea
          id="s-learning"
          name="learning"
          className="input"
          style={{ minHeight: 50 }}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Evidence ids"
          htmlFor="s-evidence"
          hint="Comma separated, from your Evidence Ledger."
        >
          <input id="s-evidence" name="evidenceIds" className="input" />
        </Field>
        <Field
          label="Skills demonstrated"
          htmlFor="s-skills"
          hint="Comma separated."
        >
          <input id="s-skills" name="skills" className="input" />
        </Field>
      </div>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save story"}
      </button>
    </form>
  );
}
