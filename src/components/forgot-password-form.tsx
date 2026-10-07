"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/auth-actions";
import { Alert, Field } from "@/components/ui/primitives";

/**
 * Request a password reset.
 *
 * The response never reveals whether an account exists, and in development the
 * link is returned so the flow can be completed without an email account. That
 * development affordance is never populated in production.
 */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction as never,
    {
      ok: false as boolean,
      message: undefined as string | undefined,
      developmentLink: undefined as string | undefined,
    },
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <Field label="Email address" htmlFor="fp-email" required>
        <input
          id="fp-email"
          name="email"
          type="email"
          className="input"
          autoComplete="email"
          required
          maxLength={320}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
        <Link href="/login" className="btn-ghost">
          Back to sign in
        </Link>
      </div>

      {state.developmentLink ? (
        <Alert tone="info" title="Development only">
          <p>
            No mail server is configured, so the link was written to the local
            mail log instead of being sent.
          </p>
          <p className="mt-2">
            <a href={state.developmentLink} className="font-medium underline">
              Open the reset link
            </a>
          </p>
        </Alert>
      ) : null}
    </form>
  );
}
