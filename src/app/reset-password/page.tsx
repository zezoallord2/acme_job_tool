import { ResetPasswordForm } from "@/components/reset-password-form";
import { env } from "@/lib/env";
import { inspectResetToken } from "@/services/password-reset-service";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

/**
 * Landing page for a password reset link.
 *
 * The token is read from the query string only to decide whether the form can be
 * shown. It is never rendered into the page output: it travels back to the
 * server as a form field, so it does not end up in a cached document.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";

  let tokenError: string | null = null;
  if (token) {
    const check = await inspectResetToken(token).catch(() => ({
      valid: false,
      reason: "This reset link is not valid.",
    }));
    if (!check.valid) tokenError = check.reason ?? "This link cannot be used.";
  } else {
    tokenError = "This link is missing its token.";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-xs font-semibold tracking-wide text-[var(--brand-accent)] uppercase">
          Acme Jobs
        </p>
        <h1 className="mt-2 page-title text-[var(--text)]">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Setting a new password signs out every other session on your account.
        </p>
      </div>

      <ResetPasswordForm
        token={token}
        tokenError={tokenError}
        minLength={env().PASSWORD_MIN_LENGTH}
      />
    </main>
  );
}
