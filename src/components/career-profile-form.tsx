"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { saveCareerProfileAction } from "@/app/actions/career-actions";
import { IDLE } from "@/app/actions/state";
import type { ActionState } from "@/app/actions/state";
import { Alert, Field } from "@/components/ui/primitives";

export function CareerProfileForm({
  career,
  profile,
}: {
  career: Record<string, string | boolean>;
  profile: Record<string, string>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveCareerProfileAction,
    IDLE,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[var(--text)]">
          Personal
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" htmlFor="p-first">
            <input
              id="p-first"
              name="firstName"
              className="input"
              defaultValue={profile.firstName}
              maxLength={80}
            />
          </Field>
          <Field label="Last name" htmlFor="p-last">
            <input
              id="p-last"
              name="lastName"
              className="input"
              defaultValue={profile.lastName}
              maxLength={80}
            />
          </Field>
          <Field
            label="Email"
            htmlFor="p-email"
            hint="Required before you can apply."
          >
            <input
              id="p-email"
              name="email"
              type="email"
              className="input"
              defaultValue={profile.email}
              maxLength={200}
            />
          </Field>
          <Field
            label="Phone"
            htmlFor="p-phone"
            hint="Required before you can apply."
          >
            <input
              id="p-phone"
              name="phone"
              className="input"
              defaultValue={profile.phone}
              maxLength={40}
            />
          </Field>
          <Field
            label="City"
            htmlFor="p-city"
            hint="A city is enough. A precise address is never required."
          >
            <input
              id="p-city"
              name="locationCity"
              className="input"
              defaultValue={profile.locationCity}
              maxLength={120}
            />
          </Field>
          <Field label="LinkedIn" htmlFor="p-linkedin" hint="Optional.">
            <input
              id="p-linkedin"
              name="linkedinUrl"
              className="input"
              defaultValue={profile.linkedinUrl}
              maxLength={300}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[var(--text)]">
          Target
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Primary target role" htmlFor="c-role">
            <input
              id="c-role"
              name="targetRolePrimary"
              className="input"
              defaultValue={String(career.targetRolePrimary ?? "")}
              maxLength={120}
            />
          </Field>
          <Field label="Secondary role" htmlFor="c-role2" hint="Optional.">
            <input
              id="c-role2"
              name="targetRoleSecondary"
              className="input"
              defaultValue={String(career.targetRoleSecondary ?? "")}
              maxLength={120}
            />
          </Field>
          <Field label="Target industry" htmlFor="c-industry">
            <input
              id="c-industry"
              name="targetIndustry"
              className="input"
              defaultValue={String(career.targetIndustry ?? "")}
              maxLength={120}
            />
          </Field>
          <Field label="Primary goal" htmlFor="c-goal">
            <select
              id="c-goal"
              name="primaryGoal"
              className="input"
              defaultValue={String(career.primaryGoal ?? "FULL_SYSTEM")}
            >
              <option value="IMPROVE_RESUME">Improve my resume</option>
              <option value="BETTER_TARGETING">Target the right jobs</option>
              <option value="INTERVIEW_PREP">Prepare for interviews</option>
              <option value="ORGANIZE_APPLICATIONS">
                Organise my applications
              </option>
              <option value="FULL_SYSTEM">Build the full system</option>
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            name="isCareerChanger"
            value="true"
            defaultChecked={Boolean(career.isCareerChanger)}
          />
          I am changing careers
        </label>

        {career.isCareerChanger ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Changing from" htmlFor="c-from">
              <input
                id="c-from"
                name="careerChangeFrom"
                className="input"
                defaultValue={String(career.careerChangeFrom ?? "")}
                maxLength={120}
              />
            </Field>
            <Field label="Changing to" htmlFor="c-to">
              <input
                id="c-to"
                name="careerChangeTo"
                className="input"
                defaultValue={String(career.careerChangeTo ?? "")}
                maxLength={120}
              />
            </Field>
          </div>
        ) : null}
      </fieldset>

      <Field
        label="Headline"
        htmlFor="c-headline"
        hint="One line, used by the LinkedIn Optimizer."
      >
        <input
          id="c-headline"
          name="headline"
          className="input"
          defaultValue={String(career.headline ?? "")}
          maxLength={160}
        />
      </Field>

      <Field
        label="Professional summary"
        htmlFor="c-summary"
        hint="Be plain. Acme Jobs will not add claims for you."
      >
        <textarea
          id="c-summary"
          name="professionalSummary"
          className="input"
          style={{ minHeight: 110 }}
          defaultValue={String(career.professionalSummary ?? "")}
          maxLength={4000}
        />
      </Field>

      <button
        type="submit"
        className="btn-primary"
        disabled={pending}
        onClick={() => setTimeout(() => router.refresh(), 500)}
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
