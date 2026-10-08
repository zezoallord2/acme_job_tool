import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getEntitlementState } from "@/services/entitlement-service";
import { Alert, Card, CardHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "How Acme Works" };

const STEPS = [
  {
    number: "1",
    title: "Build your facts",
    description:
      "Career Profile stores your background. Evidence & Proof stores the examples and results that support it. Suggested Facts lets you approve anything Acme noticed—nothing is added silently.",
    links: [
      ["Career Profile", "/app/career"],
      ["Evidence & Proof", "/app/evidence"],
      ["Suggested Facts", "/app/learning"],
    ],
  },
  {
    number: "2",
    title: "Check a job before spending time",
    description:
      "Jobs reads the description. Compare Jobs helps you decide where to focus. Applications tracks each opportunity from saved to offer or rejection.",
    links: [
      ["Analyze a Job", "/app/jobs/new"],
      ["Compare Jobs", "/app/opportunities"],
      ["Applications", "/app/applications"],
    ],
  },
  {
    number: "3",
    title: "Create honest application material",
    description:
      "Resumes tailors verified experience. Application Writing creates cover letters, LinkedIn text and application answers. Check AI Claims catches wording your evidence cannot support.",
    links: [
      ["Resumes", "/app/resumes"],
      ["Application Writing", "/app/studio"],
      ["Check AI Claims", "/app/claims"],
    ],
  },
  {
    number: "4",
    title: "Prepare, send and learn",
    description:
      "Interviews provides practice and preparation. Follow-ups keeps messages on time. Analytics shows outcomes without pretending correlation proves causation.",
    links: [
      ["Interviews", "/app/interviews"],
      ["Follow-ups", "/app/follow-ups"],
      ["Analytics", "/app/analytics"],
    ],
  },
] as const;

export default async function GuidePage() {
  const user = await requireUser();
  const entitlement = await getEntitlementState(user.id);

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">A simple path through Acme Jobs</p>
        <h1 className="mt-1 page-title text-[var(--text)]">
          What each part does
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">
          You do not need to use every tab. Start with your facts, check one
          job, then create only the material that application needs.
        </p>
      </header>

      <Alert tone="info" title="The rule behind every feature">
        Your experience. AI-assisted. Never invented. Acme can organize and
        improve your wording, but you decide what is true before anything is
        ready to send.
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        {STEPS.map((step) => (
          <Card key={step.number}>
            <CardHeader
              title={`${step.number}. ${step.title}`}
              description={step.description}
            />
            <div className="flex flex-wrap gap-2">
              {step.links.map(([label, href]) => (
                <Link key={href} href={href} className="btn-secondary">
                  {label}
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Other useful areas"
          description="Use these when you want structure or need to change how the app works."
        />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="card-muted p-3">
            <dt className="font-semibold text-[var(--text)]">14-Day Sprint</dt>
            <dd className="mt-1 text-[var(--text-muted)]">
              A day-by-day plan that turns the full workflow into manageable
              sessions.
            </dd>
          </div>
          <div className="card-muted p-3">
            <dt className="font-semibold text-[var(--text)]">Notifications</dt>
            <dd className="mt-1 text-[var(--text-muted)]">
              Deadlines, follow-ups and items that need your decision.
            </dd>
          </div>
          <div className="card-muted p-3">
            <dt className="font-semibold text-[var(--text)]">Settings</dt>
            <dd className="mt-1 text-[var(--text-muted)]">
              AI mode, exports, account preferences and diagnostic information.
            </dd>
          </div>
        </dl>
      </Card>

      {!entitlement.isComplete ? (
        <Alert tone="info" title="Starter keeps your work">
          Free features and everything you create remain available. Complete
          Edition unlocks deeper analysis and full workflows; reaching a limit
          never deletes your existing data.
        </Alert>
      ) : null}
    </div>
  );
}
