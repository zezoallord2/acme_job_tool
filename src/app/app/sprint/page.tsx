import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasCapability } from "@/services/entitlement-service";
import {
  Alert,
  Card,
  CardHeader,
  EmptyState,
  ProgressBar,
  Stat,
} from "@/components/ui/primitives";
import {
  SprintTaskToggle,
  StartSprintButton,
} from "@/components/sprint-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "14-Day Sprint" };

export default async function SprintPage() {
  const user = await requireUser();
  const [canUse, sprint] = await Promise.all([
    hasCapability(user.id, "SPRINT_14_DAY"),
    prisma.sprint.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        days: {
          orderBy: { dayNumber: "asc" },
          include: { tasks: { orderBy: { orderIndex: "asc" } } },
        },
      },
    }),
  ]);

  const tasks = sprint?.days.flatMap((day) => day.tasks) ?? [];
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-[var(--text)]">14-Day Plan</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          One evidence-first task per day. The sprint reuses your real work; it
          does not create invented busywork.
        </p>
      </header>

      {!canUse ? (
        <>
          <Alert
            tone="info"
            title="The guided sprint is part of Complete Edition"
            action={
              <Link href="/pricing" className="btn-secondary">
                Compare plans
              </Link>
            }
          >
            Your Quick Profile, evidence and saved applications remain available
            on Starter.
          </Alert>
          <EmptyState
            title="A focused two-week operating rhythm"
            description="Complete Edition turns your profile, applications, interview practice and follow-ups into fourteen concrete daily actions."
          />
        </>
      ) : !sprint ? (
        <Card>
          <CardHeader
            title="Build your sprint"
            description="Fourteen days, one focused task each day, usually 30–45 minutes."
          />
          <StartSprintButton />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Status"
              value={sprint.status.replace(/_/g, " ").toLowerCase()}
            />
            <Stat label="Current day" value={sprint.currentDay} />
            <Stat
              label="Completed"
              value={`${completed} / ${tasks.length}`}
              tone={completed === tasks.length ? "positive" : undefined}
            />
            <Stat label="Time per day" value="30–45 min" />
          </div>
          <Card>
            <ProgressBar
              label="Sprint progress"
              value={tasks.length ? completed / tasks.length : 0}
            />
          </Card>
          <div className="grid gap-3 lg:grid-cols-2">
            {sprint.days.map((day) => {
              const done = day.status === "COMPLETED";
              return (
                <Card key={day.id} className={done ? "opacity-75" : undefined}>
                  <CardHeader
                    title={`Day ${day.dayNumber} · ${day.title}`}
                    description={`${day.focus ?? ""} · ${day.minutesTarget} minutes`}
                    action={
                      <span
                        className={`badge ${done ? "badge-strong" : "badge-unknown"}`}
                      >
                        {done
                          ? "Complete"
                          : day.status === "IN_PROGRESS"
                            ? "In progress"
                            : "Upcoming"}
                      </span>
                    }
                  />
                  <ul className="space-y-2">
                    {day.tasks.map((task) => (
                      <li
                        key={task.id}
                        className="card-muted flex flex-wrap items-center gap-3 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--text)]">
                            {task.title}
                          </p>
                          {task.description ? (
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {task.description}
                            </p>
                          ) : null}
                        </div>
                        <SprintTaskToggle
                          taskId={task.id}
                          completed={task.status === "COMPLETED"}
                        />
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
