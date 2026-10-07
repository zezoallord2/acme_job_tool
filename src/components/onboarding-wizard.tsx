"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { saveOnboardingStepAction } from "@/app/actions/onboarding-actions";
import { IDLE, type ActionState } from "@/app/actions/state";
import { Field, Alert, ProgressBar } from "@/components/ui/primitives";

type Step =
  | "FIRST_NAME"
  | "EXPERIENCE_LEVEL"
  | "CURRENT_SITUATION"
  | "TARGET_ROLE"
  | "TARGET_INDUSTRY"
  | "CAREER_CHANGER"
  | "LOCATION_PREFERENCE"
  | "WORK_PREFERENCE"
  | "PRIMARY_GOAL";

const ORDER: Step[] = [
  "FIRST_NAME",
  "EXPERIENCE_LEVEL",
  "CURRENT_SITUATION",
  "TARGET_ROLE",
  "TARGET_INDUSTRY",
  "CAREER_CHANGER",
  "LOCATION_PREFERENCE",
  "WORK_PREFERENCE",
  "PRIMARY_GOAL",
];

const TITLES: Record<Step, { title: string; hint: string }> = {
  FIRST_NAME: {
    title: "What should we call you?",
    hint: "Just a first name is fine.",
  },
  EXPERIENCE_LEVEL: {
    title: "Where are you in your career?",
    hint: "This changes how much we help you explain your experience.",
  },
  CURRENT_SITUATION: {
    title: "What is your situation right now?",
    hint: 'One line. For example: "Final-year student, looking for a first role" or "Between roles, three months into a break".',
  },
  TARGET_ROLE: {
    title: "What role are you targeting?",
    hint: "One role is more useful than five.",
  },
  TARGET_INDUSTRY: {
    title: "Any industry preference?",
    hint: "Optional. Leave blank if you are open.",
  },
  CAREER_CHANGER: {
    title: "Are you changing careers?",
    hint: "This unlocks the career-change narrative tools in Complete Edition.",
  },
  LOCATION_PREFERENCE: {
    title: "Where do you want to work?",
    hint: "Optional city or region. No precise address is ever required.",
  },
  WORK_PREFERENCE: {
    title: "Remote, hybrid or on-site?",
    hint: "Used to prioritise roles that match how you want to work.",
  },
  PRIMARY_GOAL: {
    title: "What matters most right now?",
    hint: "This drives your Daily Priorities.",
  },
};

const EXPERIENCE_OPTIONS = [
  { value: "FRESH_GRADUATE", label: "Fresh graduate" },
  { value: "ENTRY_LEVEL", label: "Early career (0–2 years)" },
  { value: "MID_LEVEL", label: "Mid-career (3–7 years)" },
  { value: "SENIOR", label: "Senior (8+ years)" },
  { value: "EXECUTIVE", label: "Executive" },
  { value: "CAREER_CHANGER", label: "Career changer" },
];

const WORK_OPTIONS = [
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ON_SITE", label: "On-site" },
  { value: "NO_PREFERENCE", label: "No preference" },
];

const GOAL_OPTIONS = [
  { value: "IMPROVE_RESUME", label: "Improve my resume" },
  { value: "BETTER_TARGETING", label: "Target the right jobs" },
  { value: "INTERVIEW_PREP", label: "Prepare for interviews" },
  { value: "ORGANIZE_APPLICATIONS", label: "Organise my applications" },
  { value: "FULL_SYSTEM", label: "Build the full system" },
];

export interface OnboardingInitial {
  step: Step | string;
  firstName: string | null;
  experienceLevel: string | null;
  currentSituation: string | null;
  targetRole: string | null;
  targetIndustry: string | null;
  isCareerChanger: boolean | null;
  locationPreference: string | null;
  workArrangement: string | null;
  primaryGoal: string | null;
}

export function OnboardingWizard({
  initial,
}: {
  initial: OnboardingInitial | null;
}) {
  const [step, setStep] = useState<Step>(() => {
    const s = initial?.step as Step | undefined;
    return s && ORDER.includes(s) ? s : "FIRST_NAME";
  });
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveOnboardingStepAction as never,
    IDLE,
  );
  const index = ORDER.indexOf(step);
  const meta = TITLES[step];

  // Focus the first field of whichever step is showing. Done in an effect rather
  // than with `autoFocus`, which fires before hydration and can move focus out
  // from under a keyboard or screen-reader user.
  const firstFieldRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, [step]);

  return (
    <form action={formAction} className="space-y-5">
      <ProgressBar
        value={index / ORDER.length}
        label={`Step ${index + 1} of ${ORDER.length}`}
      />

      <input type="hidden" name="step" value={step} />

      <div>
        <h2 className="text-base font-semibold text-[var(--text)]">
          {meta.title}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{meta.hint}</p>
      </div>

      {state.message && !state.ok ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      {step === "FIRST_NAME" ? (
        <Field label="First name" htmlFor="firstName" required>
          <input
            id="firstName"
            name="firstName"
            className="input"
            defaultValue={initial?.firstName ?? ""}
            maxLength={80}
            required
            ref={firstFieldRef}
          />
        </Field>
      ) : null}

      {step === "EXPERIENCE_LEVEL" ? (
        <RadioGroup
          name="experienceLevel"
          options={EXPERIENCE_OPTIONS}
          defaultValue={initial?.experienceLevel ?? ""}
        />
      ) : null}

      {step === "CURRENT_SITUATION" ? (
        <Field label="Current situation" htmlFor="currentSituation" required>
          <textarea
            id="currentSituation"
            name="currentSituation"
            className="input"
            style={{ minHeight: 84 }}
            defaultValue={initial?.currentSituation ?? ""}
            maxLength={300}
            required
          />
        </Field>
      ) : null}

      {step === "TARGET_ROLE" ? (
        <Field label="Target role" htmlFor="targetRole" required>
          <input
            id="targetRole"
            name="targetRole"
            className="input"
            placeholder="Data Analyst"
            defaultValue={initial?.targetRole ?? ""}
            maxLength={120}
            required
          />
        </Field>
      ) : null}

      {step === "TARGET_INDUSTRY" ? (
        <Field
          label="Target industry"
          htmlFor="targetIndustry"
          hint="Optional."
        >
          <input
            id="targetIndustry"
            name="targetIndustry"
            className="input"
            defaultValue={initial?.targetIndustry ?? ""}
            maxLength={120}
          />
        </Field>
      ) : null}

      {step === "CAREER_CHANGER" ? (
        <RadioGroup
          name="isCareerChanger"
          options={[
            { value: "false", label: "No — continuing in the same field" },
            { value: "true", label: "Yes — moving into a different field" },
          ]}
          defaultValue={
            initial?.isCareerChanger === null ||
            initial?.isCareerChanger === undefined
              ? ""
              : String(initial.isCareerChanger)
          }
        />
      ) : null}

      {step === "LOCATION_PREFERENCE" ? (
        <Field
          label="Location preference"
          htmlFor="locationPreference"
          hint="Optional. A city or region is enough."
        >
          <input
            id="locationPreference"
            name="locationPreference"
            className="input"
            defaultValue={initial?.locationPreference ?? ""}
            maxLength={120}
          />
        </Field>
      ) : null}

      {step === "WORK_PREFERENCE" ? (
        <RadioGroup
          name="workArrangement"
          options={WORK_OPTIONS}
          defaultValue={initial?.workArrangement ?? ""}
        />
      ) : null}

      {step === "PRIMARY_GOAL" ? (
        <>
          <RadioGroup
            name="primaryGoal"
            options={GOAL_OPTIONS}
            defaultValue={initial?.primaryGoal ?? ""}
          />
          <Alert tone="success" title="Your Career Snapshot is ready">
            Next: analyze your first job. Acme Jobs will compare its
            requirements against your evidence and tell you honestly what is
            strong, partial and missing.
          </Alert>
        </>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex gap-2">
          {index > 0 ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep(ORDER[index - 1]!)}
            >
              Back
            </button>
          ) : null}
          <Link href="/app" className="btn-ghost">
            Skip for now
          </Link>
        </div>

        {index >= ORDER.length - 1 ? (
          <Link href="/app/jobs/new" className="btn-primary">
            Analyze Your First Job
          </Link>
        ) : (
          <button
            type="submit"
            className="btn-primary"
            disabled={pending}
            onClick={() => {
              const next = ORDER[index + 1];
              if (next) window.setTimeout(() => setStep(next), 50);
            }}
          >
            {pending ? "Saving…" : "Save and continue"}
          </button>
        )}
      </div>
    </form>
  );
}

function RadioGroup({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="label">Choose one</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={defaultValue === o.value}
            className="accent-[var(--brand-accent)]"
          />
          <span className="text-[var(--text)]">{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
