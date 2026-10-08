import type {
  ApplicationStatus,
  InterviewFormat,
  TaskPriorityAction,
} from "@prisma/client";

/**
 * Today's Priorities. Deterministic ranking over real deadlines — the reason is
 * always included so the user can judge it themselves.
 */

export interface PriorityInput {
  interviews: Array<{
    id: string;
    company: string;
    role: string;
    scheduledAt: Date | null;
    prepComplete: boolean;
  }>;
  followUps: Array<{
    id: string;
    applicationId: string;
    company: string;
    role: string;
    scheduledFor: Date | null;
    status: "DRAFT" | "SENT" | "CANCELLED";
  }>;
  unfinishedWork: Array<{
    id: string;
    applicationId: string;
    company: string;
    role: string;
    kind:
      | "RESUME_NOT_TAILORED"
      | "APPLICATION_NOT_SUBMITTED"
      | "REQUIREMENTS_NOT_REVIEWED";
    status: ApplicationStatus;
    deadline: Date | null;
  }>;
  deadApplications: Array<{
    id: string;
    company: string;
    role: string;
    deadline: Date | null;
    savedAt: Date;
  }>;
  userGoal:
    | "IMPROVE_RESUME"
    | "BETTER_TARGETING"
    | "INTERVIEW_PREP"
    | "ORGANIZE_APPLICATIONS"
    | "FULL_SYSTEM";
}

export interface PriorityItem {
  key: string;
  action: TaskPriorityAction;
  title: string;
  detail: string;
  minutes: number;
  href: string;
  rank: number;
  reason: string;
  score: number;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

export function buildPriorities(
  input: PriorityInput,
  now = new Date(),
): PriorityItem[] {
  const items: PriorityItem[] = [];

  for (const iv of input.interviews) {
    if (!iv.scheduledAt) continue;
    const ms = iv.scheduledAt.getTime() - now.getTime();
    if (ms < -DAY) continue;
    const hoursAway = ms / HOUR;
    const minutes = iv.prepComplete ? 5 : 20;
    const score = 1000 - Math.max(0, hoursAway) - (iv.prepComplete ? 60 : 0);
    items.push({
      key: `interview:${iv.id}`,
      action: "DO",
      title:
        `Prepare for ${iv.company} interview${iv.company ? " " : ""}${iv.role ? `— ${iv.role}` : ""}`.replace(
          " interview—",
          " interview —",
        ),
      detail: iv.prepComplete
        ? "Brief is ready. Re-read Interview Prep."
        : "Open Interview Prep: requirements, sent resume, strongest evidence, questions to ask.",
      minutes,
      href: `/app/interviews/${iv.id}`,
      rank: 0,
      reason:
        hoursAway < 0
          ? "Interview already scheduled — prep is overdue."
          : hoursAway < 24
            ? "Interview is within 24 hours."
            : hoursAway < 48
              ? "Interview is tomorrow."
              : `Interview is in ${Math.round(hoursAway / 24)} days.`,
      score,
    });
  }

  for (const f of input.followUps) {
    if (f.status === "SENT" || f.status === "CANCELLED" || !f.scheduledFor)
      continue;
    const ms = f.scheduledFor.getTime() - now.getTime();
    if (ms > DAY) continue;
    const score = 900 - Math.abs(ms / HOUR) - (ms < 0 ? 100 : 0);
    items.push({
      key: `followup:${f.id}`,
      action: "DO",
      title: `Follow up with ${f.company}${f.role ? ` — ${f.role}` : ""}`,
      detail:
        "Short, specific, references your application. Use the Follow-Up Message.",
      minutes: 5,
      href: `/app/applications/${f.applicationId}`,
      rank: 0,
      reason:
        ms < 0
          ? `Follow-up was due ${formatOverdue(-ms)} ago.`
          : "Follow-up is due today.",
      score,
    });
  }

  for (const w of input.unfinishedWork) {
    const label =
      w.kind === "RESUME_NOT_TAILORED"
        ? "Finish resume tailoring"
        : w.kind === "REQUIREMENTS_NOT_REVIEWED"
          ? "Review job requirements"
          : "Complete and submit application";
    const minutes = w.kind === "RESUME_NOT_TAILORED" ? 15 : 10;
    let score = 600 - input.unfinishedWork.indexOf(w);
    if (w.deadline) {
      const ms = w.deadline.getTime() - now.getTime();
      if (ms < DAY * 3) score += 150;
      if (ms < 0) score += 250;
    }
    items.push({
      key: `work:${w.kind}:${w.id}`,
      action: "DO",
      title: `${label} for ${w.company}${w.role ? ` — ${w.role}` : ""}`,
      detail:
        w.kind === "RESUME_NOT_TAILORED"
          ? "Tailor from your main resume using only evidence that supports each bullet."
          : w.kind === "REQUIREMENTS_NOT_REVIEWED"
            ? "Confirm which requirements are must-have before you invest time."
            : "Run Ready to Apply?, then send.",
      minutes,
      href: `/app/applications/${w.applicationId}`,
      rank: 0,
      reason: w.deadline
        ? `Application deadline ${formatRelative(w.deadline, now)}.`
        : `Still ${STATUS_LABELS[w.status]}.`,
      score,
    });
  }

  for (const d of input.deadApplications) {
    const ageDays = (now.getTime() - d.savedAt.getTime()) / DAY;
    if (ageDays < 7) continue;
    items.push({
      key: `review:${d.id}`,
      action: "OPTIONAL",
      title: `Review saved role: ${d.company}${d.role ? ` — ${d.role}` : ""}`,
      detail:
        "Still undecided after 7+ days. Apply, or archive it so it stops diluting your list.",
      minutes: 5,
      href: `/app/applications/${d.id}`,
      rank: 0,
      reason: `Saved ${Math.floor(ageDays)} days ago and not actioned.`,
      score: 300 - ageDays,
    });
  }

  const goalBoost = goalWeights(input.userGoal);
  const withBoost = items.map((i) => ({
    ...i,
    score: i.score * (goalBoost[categoryFor(i.key)] ?? 1),
  }));

  return withBoost
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function categoryFor(
  key: string,
): "INTERVIEW" | "FOLLOWUP" | "WORK" | "REVIEW" {
  if (key.startsWith("interview")) return "INTERVIEW";
  if (key.startsWith("followup")) return "FOLLOWUP";
  if (key.startsWith("review")) return "REVIEW";
  return "WORK";
}

function goalWeights(goal: PriorityInput["userGoal"]): Record<string, number> {
  switch (goal) {
    case "INTERVIEW_PREP":
      return { INTERVIEW: 1.5, FOLLOWUP: 1.2, WORK: 0.8, REVIEW: 0.6 };
    case "IMPROVE_RESUME":
      return { WORK: 1.4, INTERVIEW: 0.9, FOLLOWUP: 1.0, REVIEW: 0.7 };
    case "BETTER_TARGETING":
      return { REVIEW: 1.4, WORK: 1.2, INTERVIEW: 1.0, FOLLOWUP: 0.9 };
    case "ORGANIZE_APPLICATIONS":
      return { FOLLOWUP: 1.4, WORK: 1.2, REVIEW: 1.2, INTERVIEW: 1.0 };
    case "FULL_SYSTEM":
    default:
      return { INTERVIEW: 1.2, FOLLOWUP: 1.1, WORK: 1.0, REVIEW: 0.9 };
  }
}

function formatOverdue(ms: number): string {
  const hours = Math.floor(ms / HOUR);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function formatRelative(date: Date, now: Date): string {
  const days = Math.round((date.getTime() - now.getTime()) / DAY);
  if (days < 0) return `${Math.abs(days)} day(s) ago`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SAVED: "Saved",
  ANALYZING: "Analyzing",
  READY_TO_APPLY: "Ready to apply",
  APPLIED: "Applied",
  SCREENING: "In screening",
  INTERVIEW: "At interview stage",
  FINAL_INTERVIEW: "At final interview",
  OFFER: "Offer received",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  ARCHIVED: "Archived",
};

export const INTERVIEW_FORMAT_LABELS: Record<InterviewFormat, string> = {
  PHONE: "Phone",
  VIDEO: "Video call",
  ONSITE: "On-site",
  UNKNOWN: "Format not set",
};
