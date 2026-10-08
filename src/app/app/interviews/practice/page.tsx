import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementState } from "@/services/entitlement-service";
import { Card, CardHeader, Alert, Stat } from "@/components/ui/primitives";
import { MockInterviewRunner } from "@/components/mock-interview-runner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mock interview" };

const MODES = [
  { value: "GENERAL", label: "General" },
  { value: "BEHAVIORAL", label: "Behavioural" },
  { value: "ROLE_SPECIFIC", label: "Role-specific" },
  { value: "TECHNICAL", label: "Technical" },
  { value: "RESUME_BASED", label: "Resume-based" },
  { value: "GRADUATE", label: "Graduate" },
  { value: "CAREER_CHANGE", label: "Career change" },
  { value: "MANAGERIAL", label: "Managerial" },
] as const;

export default async function PracticePage() {
  const user = await requireUser();
  const state = await getEntitlementState(user.id);
  const sessions = await prisma.interviewSession.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { _count: { select: { questions: true } } },
  });

  const career = await prisma.careerMasterProfile.findUnique({
    where: { userId: user.id },
    select: { targetRolePrimary: true },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-[var(--text)]">Mock interview</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          One question at a time. Answers are scored on relevance, specificity,
          evidence, structure and clarity. There is no hire probability — Acme
          Jobs cannot know that.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat
          label="Questions allowed"
          value={
            state.isComplete ? "Unlimited" : state.limits.mockInterviewQuestions
          }
          hint={state.isComplete ? "Complete Edition" : "Starter plan"}
        />
        <Stat label="Past sessions" value={sessions.length} />
        <Stat
          label="Sessions completed"
          value={sessions.filter((s) => s.status === "COMPLETED").length}
        />
      </div>

      {!state.isComplete ? (
        <Alert tone="info" title="Starter plan">
          Five questions per session. Complete Edition adds adaptive sessions
          that follow up on vague answers.
        </Alert>
      ) : null}

      <Card>
        <CardHeader title="Start a session" />
        <MockInterviewRunner
          modes={MODES.map((m) => ({ value: m.value, label: m.label }))}
          targetRole={career?.targetRolePrimary ?? ""}
          limit={state.isComplete ? 12 : state.limits.mockInterviewQuestions}
        />
      </Card>

      {sessions.length > 0 ? (
        <Card>
          <CardHeader title="Recent sessions" />
          <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
            {sessions.map((s) => (
              <li key={s.id}>
                {s.mode.toLowerCase()} · {s.status.toLowerCase()} ·{" "}
                {s._count.questions} question
                {s._count.questions === 1 ? "" : "s"}
                {s.targetRole ? ` · ${s.targetRole}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
