import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect("/app");
  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center px-4 py-10"
    >
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold text-white"
            style={{ background: "var(--brand)" }}
            aria-hidden
          >
            A
          </span>
          <span className="text-base font-semibold tracking-tight text-[var(--text)]">
            Acme Jobs
          </span>
        </div>

        <div className="card p-6">
          <h1 className="text-xl font-semibold text-[var(--text)]">
            Create your free account
          </h1>
          <p className="mt-1 mb-5 text-sm text-[var(--text-muted)]">
            Free forever for Career Snapshot, Job Analyzer, basic tailoring, one
            STAR story and a five-question mock interview. No credit card.
          </p>
          <AuthForm mode="signup" />
        </div>

        <p className="mt-5 text-center text-xs text-[var(--text-muted)]">
          Acme Jobs never sends your data to a third party. Works with no paid
          AI service: Manual Mode is built in.
        </p>
      </div>
    </main>
  );
}
