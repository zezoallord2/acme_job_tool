import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOnboarding } from "@/app/actions/onboarding-actions";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { Card, Alert } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const onboarding = await getOnboarding();
  if (onboarding?.completedAt) redirect("/app");

  const profileName = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { firstName: true },
  });

  return (
    <main id="main" className="mx-auto max-w-[720px] px-4 py-8">
      <div className="mb-6 text-center">
        <p
          className="text-xs font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--brand-accent)" }}
        >
          Career Snapshot
        </p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-[var(--text)]">
          {profileName?.firstName
            ? `Welcome, ${profileName.firstName}.`
            : "Welcome to Acme Jobs."}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Your experience. AI-assisted. Never invented.
        </p>
      </div>

      <div className="mb-4">
        <Alert tone="info">
          Nine short questions. You can skip anything and come back later —
          nothing is invented for you, so the less you add now, the more the
          system will honestly tell you it does not know.
        </Alert>
      </div>

      <Card>
        <OnboardingWizard initial={onboarding} />
      </Card>

      <p className="mt-4 text-center text-sm">
        <Link href="/app" className="underline">
          Skip for now and go to the dashboard
        </Link>
      </p>
    </main>
  );
}
