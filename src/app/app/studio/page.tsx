import { requireUser } from "@/lib/auth";
import { hasCapability } from "@/services/entitlement-service";
import { STUDIO_WORKFLOWS } from "@/services/studio-service";
import { studioDescriptorAction } from "@/app/actions/studio-actions";
import { StudioSection } from "@/components/studio-section";
import { Alert } from "@/components/ui/primitives";

/**
 * The Writing Studio.
 *
 * Every remaining AI workflow is declared once in the service registry and
 * rendered by one generic panel. This page only decides which workflows belong
 * here, in what order, and under which heading.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Writing Studio" };

const GROUPS: Array<{
  heading: string;
  blurb: string;
  workflows: string[];
}> = [
  {
    heading: "Tailoring to a job",
    blurb:
      "Built from that job's requirements and the resume you actually sent, so you are never preparing against something the employer never saw.",
    workflows: ["RESUME_TAILORING", "RESUME_BULLET"],
  },
  {
    heading: "Documents employers receive",
    blurb:
      "Drafts are saved for you to review. Acme Jobs never sends an application and never overwrites a version you already sent.",
    workflows: ["COVER_LETTER", "APPLICATION_ANSWER", "LINKEDIN_OPTIMIZER"],
  },
  {
    heading: "Your voice and your story",
    blurb:
      "These learn preferences and structure your own account. Nothing here is treated as a confirmed fact until you accept it.",
    workflows: ["CAREER_NARRATIVE", "VOICE_PROFILE", "STAR_STORY"],
  },
  {
    heading: "After you have been in touch",
    blurb:
      "Drafts only. Acme Jobs has no email integration and never sends anything on your behalf.",
    workflows: ["FOLLOW_UP"],
  },
];

export default async function StudioPage() {
  const user = await requireUser();

  const groups = await Promise.all(
    GROUPS.map(async (group) => {
      const resolved = await Promise.all(
        group.workflows.map(async (id) => {
          const workflow = STUDIO_WORKFLOWS[id];
          if (!workflow) return null;
          const can = await hasCapability(user.id, workflow.capability);
          const descriptor = can
            ? await studioDescriptorAction(workflow.id)
            : null;
          return {
            workflow,
            can,
            descriptor:
              descriptor && "fields" in descriptor ? descriptor : null,
          };
        }),
      );
      return {
        ...group,
        entries: resolved.filter((r): r is NonNullable<typeof r> => r !== null),
      };
    }),
  );

  const unlocked = groups.reduce(
    (n, g) => n + g.entries.filter((e) => e.can).length,
    0,
  );
  const total = groups.reduce((n, g) => n + g.entries.length, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Writing Studio
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Every writing tool in one place. Each one works in Manual Mode by
          default, so it costs $0 and needs no API key: copy the prompt, use any
          assistant you like, paste the response back, and Acme Jobs validates
          it against the schema before saving anything.
        </p>
      </header>

      <Alert
        tone={unlocked > 0 ? "success" : "info"}
        title={`${unlocked} of ${total} tools available on your plan`}
      >
        {unlocked > 0
          ? "Generated text is always a draft. Read it, check the cited evidence, then decide."
          : "These tools are part of Complete Edition. Your Starter plan still includes the full Evidence Ledger, job analysis, evidence matrix and a five-question mock interview."}
      </Alert>

      {groups.map((group) => (
        <section key={group.heading} className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">
              {group.heading}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {group.blurb}
            </p>
          </div>
          {group.entries.map((entry) => (
            <StudioSection
              key={entry.workflow.id}
              workflow={entry.workflow}
              descriptor={entry.descriptor}
              can={entry.can}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
