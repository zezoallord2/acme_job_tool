"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { confirmPasswordResetAction } from "@/app/actions/auth-actions";
import { Alert, Field } from "@/components/ui/primitives";

/**
 * Consumes a reset token and sets a new password.
 *
 * The token arrives in the URL and is submitted with the form rather than read
 * from the query string on the server, so it is never rendered into server
 * component output or written to an access log that persists it.
 */
export function ResetPasswordForm({
  token,
  tokenError,
  minLength,
}: {
  token: string;
  tokenError: string | null;
  minLength: number;
}) {
  const [state, formAction, pending] = useActionState(
    confirmPasswordResetAction as never,
    { ok: false as const, message: undefined as string | undefined },
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState<string | null>(null);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Password changed">
          {state.message}
        </Alert>
        <Link href="/login" className="btn-primary">
          Sign in
        </Link>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="This link cannot be used">
          {tokenError}
        </Alert>
        <Link href="/forgot-password" className="btn-primary">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.message && !state.ok ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}
      {mismatch ? <Alert tone="error">{mismatch}</Alert> : null}

      <Field
        label="New password"
        htmlFor="rp-password"
        required
        hint={`At least ${minLength} characters, and not a common password.`}
      >
        <input
          id="rp-password"
          name="password"
          type="password"
          className="input"
          autoComplete="new-password"
          required
          minLength={minLength}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setMismatch(null);
          }}
        />
      </Field>

      <Field label="Confirm new password" htmlFor="rp-confirm" required>
        <input
          id="rp-confirm"
          name="confirm"
          type="password"
          className="input"
          autoComplete="new-password"
          required
          minLength={minLength}
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setMismatch(null);
          }}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="btn-primary"
          disabled={pending}
          onClick={() => {
            if (password !== confirm) {
              setMismatch("The two passwords do not match.");
            }
          }}
        >
          {pending ? "Saving…" : "Set new password"}
        </button>
        <span className="text-xs text-[var(--text-muted)]">
          This link works once. Every other session is signed out.
        </span>
      </div>
    </form>
  );
}
