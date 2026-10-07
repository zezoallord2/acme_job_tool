import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getEntitlementState } from "@/services/entitlements-pro";
import {
  PRICING,
  COMPLETE_CAPABILITIES,
  FREE_CAPABILITIES,
} from "@/domain/entitlements";
import { PageHero } from "@/components/marketing";

export const metadata = {
  title: "Complete Edition",
  description:
    "The full evidence-first job search system: evidence ledger, claim inspector, readiness gate, immutable sent versions, interview command centre and analytics.",
};

export const dynamic = "force-dynamic";

const GROUPS: Array<{ title: string; keys: string[] }> = [
  {
    title: "Know what is true",
    keys: [
      "CAREER_MASTER_PROFILE",
      "EVIDENCE_LEDGER_FULL",
      "ACHIEVEMENT_MINING",
      "VOICE_PROFILE",
      "CAREER_NARRATIVE",
    ],
  },
  {
    title: "Decide what is worth it",
    keys: [
      "TARGET_ROLE_BLUEPRINT",
      "JOB_ANALYZER_DEEP",
      "EVIDENCE_MATRIX_FULL",
      "FIT_RECOMMENDATION",
      "EFFORT_VS_OPPORTUNITY",
    ],
  },
  {
    title: "Build the application",
    keys: [
      "MASTER_RESUME",
      "RESUME_VERSIONS",
      "RESUME_TAILORING_ADVANCED",
      "RESUME_BULLET_BUILDER",
      "CLAIM_INSPECTOR",
      "CONSISTENCY_ENGINE",
      "READINESS_GATE",
      "COVER_LETTER_BUILDER",
      "LINKEDIN_OPTIMIZER",
      "APPLICATION_QUESTION_BUILDER",
    ],
  },
  {
    title: "Perform and improve",
    keys: [
      "STAR_BANK_FULL",
      "MOCK_INTERVIEW_ADVANCED",
      "DEFEND_THIS_CLAIM",
      "INTERVIEW_COMMAND_CENTER",
      "POST_INTERVIEW_REVIEW",
      "FOLLOW_UP_BUILDER",
    ],
  },
  {
    title: "Track and learn",
    keys: [
      "APPLICATION_CAPSULE",
      "IMMUTABLE_SENT_VERSIONS",
      "APPLICATION_TRACKER",
      "ANALYTICS",
      "DAILY_PRIORITY_ENGINE",
      "ASK_ACME",
      "SPRINT_14_DAY",
      "COMPLETE_BOOK",
    ],
  },
];

const LABELS: Record<string, string> = Object.fromEntries(
  [...FREE_CAPABILITIES, ...COMPLETE_CAPABILITIES].map((c) => [
    c,
    c
      .split("_")
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" "),
  ]),
);

export default async function CompletePage() {
  const user = await getSessionUser();
  const entitlement = user ? await getEntitlementState(user.id) : null;
  const complete = PRICING[1]!;

  return (
    <main id="main" className="mx-auto max-w-[1000px] px-4 py-10">
      <PageHero
        eyebrow="Paid product"
        title="AI Job Hunter — Complete Edition"
        lede="Build, execute and repeat. Every workflow runs on a verified evidence ledger, every suggestion explains itself, and every sent application is preserved exactly as submitted."
      >
        {entitlement?.isComplete ? (
          <>
            <Link href="/app" className="btn-primary">
              Launch the app
            </Link>
            <Link href="/api/complete-book/pdf" className="btn-secondary">
              Download the book (PDF)
            </Link>
          </>
        ) : user ? (
          <Link href="/app/settings" className="btn-primary">
            Upgrade in settings
          </Link>
        ) : (
          <Link href="/signup" className="btn-primary">
            Create an account to upgrade
          </Link>
        )}
      </PageHero>

      {entitlement?.isComplete ? (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">
              You have Complete Edition access
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Granted via {entitlement.source}.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/app" className="btn-secondary">
              Open Book
            </Link>
            <Link href="/api/complete-book/pdf" className="btn-secondary">
              Download Book
            </Link>
          </div>
        </div>
      ) : null}

      <div className="card mb-8 p-5">
        <p className="text-sm font-semibold text-[var(--text)]">
          Launch ${complete.launchPriceUsd.toFixed(2)} · regular $
          {complete.regularPriceUsd.toFixed(2)}
        </p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          One price, no usage meters. Manual AI Mode means AI cost is optional:
          run everything with your own assistant at $0, or bring your own API
          key.
        </p>
      </div>

      <div className="space-y-6">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="text-base font-semibold text-[var(--text)]">
              {g.title}
            </h2>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {g.keys.map((k) => (
                <li key={k} className="text-sm text-[var(--text-muted)]">
                  <span style={{ color: "var(--brand-accent)" }} aria-hidden>
                    ✓{" "}
                  </span>
                  {LABELS[k] ?? k}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-[var(--text-muted)]">
        Not ready?{" "}
        <Link href="/free" className="underline">
          Start with the Free Edition
        </Link>{" "}
        and upgrade when the free workflows have already paid for themselves.
      </p>
    </main>
  );
}
