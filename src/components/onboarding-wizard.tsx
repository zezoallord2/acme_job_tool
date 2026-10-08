"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { finishSimpleOnboardingAction } from "@/app/actions/onboarding-actions";
import { CvImportCard } from "@/components/cv-import-card";
import { Alert, Field, ProgressBar } from "@/components/ui/primitives";

export interface OnboardingInitial {
  firstName: string | null;
  targetRole: string | null;
  locationPreference: string | null;
  workArrangement: string | null;
}

const STEPS = ["goal", "cv", "preferences", "ready"] as const;

export function OnboardingWizard({
  initial,
}: {
  initial: OnboardingInitial | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [targetRole, setTargetRole] = useState(initial?.targetRole ?? "");
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [location, setLocation] = useState(initial?.locationPreference ?? "");
  const [work, setWork] = useState(initial?.workArrangement ?? "NO_PREFERENCE");
  const [state, action, pending] = useActionState(
    finishSimpleOnboardingAction,
    { ok: false, message: "" },
  );

  useEffect(() => {
    if (state.ok)
      router.push(`/app/jobs?title=${encodeURIComponent(targetRole)}`);
  }, [router, state.ok, targetRole]);

  const current = STEPS[step]!;
  return (
    <form action={action} className="space-y-5">
      <ProgressBar
        value={(step + 1) / STEPS.length}
        label={`Step ${step + 1} of ${STEPS.length}`}
      />
      <input type="hidden" name="targetRole" value={targetRole} />
      <input type="hidden" name="firstName" value={firstName} />
      <input type="hidden" name="locationPreference" value={location} />
      <input type="hidden" name="workArrangement" value={work} />

      {state.message && !state.ok ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      {current === "goal" ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">
              What job are you looking for?
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Start with one clear title. You can change it whenever you search.
            </p>
          </div>
          <Field label="Target job title" htmlFor="ob-role">
            <input
              id="ob-role"
              className="input"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Data analyst"
              required
            />
          </Field>
          <Field
            label="What should we call you?"
            htmlFor="ob-name"
            hint="Optional if it is already on your CV."
          >
            <input
              id="ob-name"
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
            />
          </Field>
        </div>
      ) : null}

      {current === "cv" ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Add your experience
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Fastest option: upload your CV, review what Acme found, then
              confirm it. Nothing is saved before your review.
            </p>
          </div>
          <CvImportCard hasProfile={false} isComplete={false} />
          <p className="text-sm text-[var(--text-muted)]">
            No CV handy? Skip this step and add your experience manually from
            Profile later.
          </p>
        </div>
      ) : null}

      {current === "preferences" ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Where and how do you want to work?
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              These preferences help rank jobs. They never hide results
              permanently.
            </p>
          </div>
          <Field
            label="Location"
            htmlFor="ob-location"
            hint="City, country, region, or leave blank."
          >
            <input
              id="ob-location"
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Cairo"
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="label">Work style</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["NO_PREFERENCE", "Any"],
                ["REMOTE", "Remote"],
                ["HYBRID", "Hybrid"],
                ["ON_SITE", "On-site"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border p-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <input
                    type="radio"
                    checked={work === value}
                    onChange={() => setWork(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      {current === "ready" ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent-soft)] text-xl text-[var(--brand-accent)]">
            ✓
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Ready to see jobs for you
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Acme will search real public job listings for{" "}
              <strong>{targetRole || "your target role"}</strong>, explain the
              match, and keep anything you save organized.
            </p>
          </div>
          <Alert tone="info">
            AI suggestions are drafts. You always review factual claims before
            they enter your profile, resume or application.
          </Alert>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          className="btn-ghost"
          disabled={step === 0 || pending}
          onClick={() => setStep((value) => Math.max(0, value - 1))}
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn-primary"
            disabled={step === 0 && !targetRole.trim()}
            onClick={() =>
              setStep((value) => Math.min(STEPS.length - 1, value + 1))
            }
          >
            {current === "cv" ? "Continue" : "Next"}
          </button>
        ) : (
          <button
            type="submit"
            className="btn-primary"
            disabled={pending || !targetRole.trim()}
          >
            {pending ? "Finding jobs…" : "Show my Jobs for You"}
          </button>
        )}
      </div>
    </form>
  );
}
