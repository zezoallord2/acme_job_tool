"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction, loginAction } from "@/app/actions/auth-actions";
import { IDLE, type ActionState } from "@/app/actions/state";
import { Field, Alert } from "@/components/ui/primitives";

export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const action =
    mode === "signup" ? (signupAction as never) : (loginAction as never);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    IDLE,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message && !state.ok ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      {mode === "signup" ? (
        <Field
          label="Full name"
          htmlFor="name"
          hint="Used to personalise your Career Snapshot."
        >
          <input
            id="name"
            name="name"
            className="input"
            autoComplete="name"
            maxLength={120}
          />
        </Field>
      ) : null}

      <Field
        label="Email"
        htmlFor="email"
        required
        error={state.fieldErrors?.email}
      >
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="email"
          required
          maxLength={200}
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        error={state.fieldErrors?.password}
        hint={
          mode === "signup"
            ? `At least 10 characters. Nothing you type is ever sent to a third party.`
            : undefined
        }
      >
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          maxLength={200}
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending
          ? "Working…"
          : mode === "signup"
            ? "Create account"
            : "Sign in"}
      </button>

      <p className="text-center text-sm text-[var(--text-muted)]">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="underline">
              Create a free account
            </Link>
          </>
        )}
      </p>

      {mode === "login" ? (
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="underline">
            Forgotten your password?
          </Link>
        </p>
      ) : null}
    </form>
  );
}

export function PasswordResetForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async () => ({ ok: true }),
    IDLE,
  );
  void formAction;
  void state;
  void pending;
  return null;
}
