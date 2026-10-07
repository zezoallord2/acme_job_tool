"use client";

import { useActionState } from "react";
import { createEvidenceAction } from "@/app/actions/app-actions";
import { IDLE } from "@/app/actions/state";
import type { ActionState } from "@/app/actions/state";
import { Field, Alert } from "@/components/ui/primitives";

const CLAIM_TYPES = [
  ["ACHIEVEMENT", "Achievement"],
  ["RESPONSIBILITY", "Responsibility"],
  ["LEADERSHIP", "Leadership"],
  ["SKILL", "Skill"],
  ["TOOL", "Tool"],
  ["METRIC", "Metric"],
  ["SOFT_SKILL", "Soft skill"],
  ["EDUCATION", "Education"],
  ["CERTIFICATION", "Certification"],
] as const;

const SOURCE_TYPES = [
  ["EMPLOYMENT", "Employment record"],
  ["PROJECT", "Project"],
  ["VOLUNTEER", "Volunteer"],
  ["CERTIFICATION", "Certification"],
  ["SKILL", "Skill practice"],
  ["WORK_SAMPLE", "Work sample"],
  ["INTERVIEW_RECALL", "Remembered in an interview"],
  ["USER_STATEMENT", "Something you told us"],
  ["DOCUMENT", "A document you uploaded"],
  ["OTHER", "Other"],
] as const;

export function EvidenceForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createEvidenceAction,
    IDLE,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <Field
        label="What did you do?"
        htmlFor="statement"
        required
        hint="Write it the way you would say it in an interview. Be specific about your own contribution."
      >
        <textarea
          id="statement"
          name="statement"
          className="input"
          style={{ minHeight: 76 }}
          required
          minLength={5}
          maxLength={1000}
          placeholder="Handled approximately 40 support tickets per day across the operations queue."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="claimType" required>
          <select
            id="claimType"
            name="claimType"
            className="input"
            defaultValue="ACHIEVEMENT"
          >
            {CLAIM_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source" htmlFor="sourceType" required>
          <select
            id="sourceType"
            name="sourceType"
            className="input"
            defaultValue="EMPLOYMENT"
          >
            {SOURCE_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Where did this come from?"
        htmlFor="sourceDescription"
        required
      >
        <input
          id="sourceDescription"
          name="sourceDescription"
          className="input"
          required
          maxLength={300}
          placeholder="Customer Operations internship, Northwind"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Number (optional)"
          htmlFor="metricValue"
          hint="Only if you actually know it."
        >
          <input
            id="metricValue"
            name="metricValue"
            type="number"
            step="any"
            className="input"
            min={0}
          />
        </Field>
        <Field label="Unit" htmlFor="metricUnit" hint="tickets, %, hours…">
          <input
            id="metricUnit"
            name="metricUnit"
            className="input"
            maxLength={40}
          />
        </Field>
        <Field label="Metric status" htmlFor="metricStatus">
          <select
            id="metricStatus"
            name="metricStatus"
            className="input"
            defaultValue="NOT_APPLICABLE"
          >
            <option value="NOT_APPLICABLE">No number</option>
            <option value="USER_ESTIMATE">My estimate</option>
            <option value="VERIFIED">Verified figure</option>
            <option value="UNKNOWN">Not sure</option>
          </select>
        </Field>
      </div>

      <Field
        label="Tags"
        htmlFor="tags"
        hint="Comma separated. Helps match requirements."
      >
        <input
          id="tags"
          name="tags"
          className="input"
          maxLength={200}
          placeholder="excel, reporting, operations"
        />
      </Field>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Add to ledger"}
      </button>
    </form>
  );
}
