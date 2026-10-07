"use client";

import { useActionState } from "react";
import {
  createEmploymentAction,
  createSkillAction,
  createEducationAction,
} from "@/app/actions/career-actions";
import { IDLE } from "@/app/actions/state";
import type { ActionState } from "@/app/actions/state";
import { Alert, Field } from "@/components/ui/primitives";

export function EmploymentForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createEmploymentAction,
    IDLE,
  );
  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Job title" htmlFor="e-title" required>
          <input
            id="e-title"
            name="jobTitle"
            className="input"
            required
            maxLength={200}
          />
        </Field>
        <Field label="Company" htmlFor="e-company" required>
          <input
            id="e-company"
            name="companyName"
            className="input"
            required
            maxLength={200}
          />
        </Field>
        <Field label="Location" htmlFor="e-location">
          <input
            id="e-location"
            name="location"
            className="input"
            maxLength={200}
          />
        </Field>
        <Field
          label="Type"
          htmlFor="e-type"
          hint="Internship, contract, full-time…"
        >
          <input
            id="e-type"
            name="employmentType"
            className="input"
            maxLength={80}
          />
        </Field>
        <Field label="Start" htmlFor="e-start">
          <input id="e-start" name="startDate" type="date" className="input" />
        </Field>
        <Field label="End" htmlFor="e-end">
          <input id="e-end" name="endDate" type="date" className="input" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
        <input type="checkbox" name="isCurrent" value="true" /> I currently work
        here
      </label>
      <Field
        label="What did you do?"
        htmlFor="e-desc"
        hint="Used to build evidence. One achievement per line works best."
      >
        <textarea
          id="e-desc"
          name="description"
          className="input"
          style={{ minHeight: 70 }}
          maxLength={4000}
        />
      </Field>
      <Field label="Highlights" htmlFor="e-highlights" hint="One per line.">
        <textarea
          id="e-highlights"
          name="highlights"
          className="input"
          style={{ minHeight: 70 }}
        />
      </Field>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Add role"}
      </button>
    </form>
  );
}

export function EducationForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createEducationAction,
    IDLE,
  );
  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Institution" htmlFor="ed-inst" required>
          <input
            id="ed-inst"
            name="institution"
            className="input"
            required
            maxLength={200}
          />
        </Field>
        <Field label="Degree" htmlFor="ed-degree">
          <input
            id="ed-degree"
            name="degree"
            className="input"
            maxLength={160}
            placeholder="BSc"
          />
        </Field>
        <Field label="Field of study" htmlFor="ed-field">
          <input
            id="ed-field"
            name="fieldOfStudy"
            className="input"
            maxLength={160}
          />
        </Field>
        <Field label="Start" htmlFor="ed-start">
          <input id="ed-start" name="startDate" type="date" className="input" />
        </Field>
        <Field label="End" htmlFor="ed-end">
          <input id="ed-end" name="endDate" type="date" className="input" />
        </Field>
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Add education"}
      </button>
    </form>
  );
}

export function SkillForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createSkillAction,
    IDLE,
  );
  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}
      <Field
        label="Skill"
        htmlFor="sk-name"
        required
        hint="Be honest: only add what you could defend."
      >
        <input
          id="sk-name"
          name="name"
          className="input"
          required
          maxLength={80}
          placeholder="Excel"
        />
      </Field>
      <Field label="Category" htmlFor="sk-cat" hint="Optional.">
        <input
          id="sk-cat"
          name="category"
          className="input"
          maxLength={80}
          placeholder="analytics"
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
        <input type="checkbox" name="isCore" value="true" /> This is a core
        skill
      </label>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Add skill"}
      </button>
    </form>
  );
}
