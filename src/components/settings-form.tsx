"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateSettingsAction } from "@/app/actions/app-actions";
import { IDLE, type ActionState } from "@/app/actions/state";
import { Alert, Field } from "@/components/ui/primitives";

export interface SettingsValue {
  theme: string;
  aiProvider: string;
  productLearningEnabled: boolean;
  analyticsEnabled: boolean;
  notifyInterviews: boolean;
  notifyFollowUps: boolean;
  notifyDeadlines: boolean;
  notifyDrafts: boolean;
}

export function SettingsForm({ settings }: { settings: SettingsValue }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateSettingsAction as never,
    IDLE,
  );
  const [theme, setTheme] = useState(settings.theme.toLowerCase());
  useEffect(() => {
    const sync = () => setTheme(localStorage.getItem("acme-theme") || "light");
    sync();
    window.addEventListener("acme-theme-change", sync);
    return () => window.removeEventListener("acme-theme-change", sync);
  }, []);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <Field label="Theme" htmlFor="s-theme">
        <select
          id="s-theme"
          name="theme"
          className="input"
          value={theme}
          onChange={(e) => {
            const value = e.target.value;
            setTheme(value);
            if (value === "system") {
              localStorage.setItem("acme-theme", "system");
              document.documentElement.classList.toggle(
                "dark",
                window.matchMedia("(prefers-color-scheme: dark)").matches,
              );
            } else {
              localStorage.setItem("acme-theme", value);
              document.documentElement.classList.toggle(
                "dark",
                value === "dark",
              );
            }
          }}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </Field>

      <fieldset className="space-y-2">
        <legend className="label">
          Notifications (in-app, no external provider needed)
        </legend>
        {(
          [
            ["notifyInterviews", "Interview tomorrow"],
            ["notifyFollowUps", "Follow-up due"],
            ["notifyDeadlines", "Deadline approaching"],
            ["notifyDrafts", "Unfinished draft"],
          ] as const
        ).map(([name, label]) => (
          <label
            key={name}
            className="flex items-center gap-2 text-sm text-[var(--text)]"
          >
            <input
              type="checkbox"
              name={name}
              value="true"
              defaultChecked={settings[name]}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="label">Data and learning</legend>
        <label className="flex items-start gap-2 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            name="productLearningEnabled"
            value="true"
            defaultChecked={settings.productLearningEnabled}
            className="mt-1"
          />
          <span>
            Improve my suggestions from my own outcomes and feedback.
            <span className="block text-xs text-[var(--text-muted)]">
              Still requires confirmation before anything becomes a career fact.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            name="analyticsEnabled"
            value="true"
            defaultChecked={settings.analyticsEnabled}
            className="mt-1"
          />
          <span>
            Store anonymised product metrics (workflow started/completed,
            suggestion accepted/rejected).
            <span className="block text-xs text-[var(--text-muted)]">
              Internal PostgreSQL only. No external analytics service.
            </span>
          </span>
        </label>
      </fieldset>

      <button
        type="submit"
        className="btn-primary"
        disabled={pending}
        onClick={() => {
          setTimeout(() => router.refresh(), 500);
        }}
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
