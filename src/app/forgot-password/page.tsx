import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-xs font-semibold tracking-wide text-[var(--brand-accent)] uppercase">
          Acme Jobs
        </p>
        <h1 className="mt-2 page-title text-[var(--text)]">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Enter the email on your account. If it exists, we will send a link
          that works once and expires.
        </p>
      </div>

      <ForgotPasswordForm />
    </main>
  );
}
