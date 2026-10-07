/**
 * Honest metrics. Every number carries its formula. When the sample is too small
 * we say so rather than implying a trend.
 */

export interface OutcomeEvent {
  type:
    | "SUBMITTED"
    | "REPLIED"
    | "REJECTED"
    | "SCREENING"
    | "INTERVIEW"
    | "OFFER"
    | "DECLINED"
    | "WITHDRAWN";
  occurredAt: Date;
  applicationId: string;
  /** Optional evidence/artifact ids referenced by the submitted application. */
  evidenceIds?: string[];
  resumeVersionId?: string | null;
  fitClassification?: string | null;
  company?: string | null;
  role?: string | null;
}

export interface AnalyticsResult {
  applicationsSubmitted: number;
  replies: number;
  interviews: number;
  offers: number;
  rejections: number;
  replyRate: number | null;
  interviewConversion: number | null;
  offerRate: number | null;
  averageResponseDays: number | null;
  applicationsPerWeek: number | null;
  sufficiency: Sufficiency;
  formulas: AnalyticsFormula[];
}

export interface Sufficiency {
  level: "INSUFFICIENT" | "DIRECTIONAL" | "RELIABLE";
  message: string;
  minimumForReliable: number;
}

export interface AnalyticsFormula {
  name: string;
  formula: string;
  value: string;
}

export const MINIMUM_SAMPLE_FOR_RELIABLE = 20;

/** A reply is any positive signal: screening, interview or offer. */
function isReply(e: OutcomeEvent): boolean {
  return (
    e.type === "REPLIED" ||
    e.type === "SCREENING" ||
    e.type === "INTERVIEW" ||
    e.type === "OFFER"
  );
}

export function computeAnalytics(
  events: readonly OutcomeEvent[],
  now = new Date(),
): AnalyticsResult {
  const submitted = events.filter((e) => e.type === "SUBMITTED");
  const replies = events.filter(isReply);
  const interviews = events.filter(
    (e) => e.type === "INTERVIEW" || e.type === "OFFER",
  );
  const offers = events.filter((e) => e.type === "OFFER");
  const rejections = events.filter((e) => e.type === "REJECTED");

  const replyRate = submitted.length ? replies.length / submitted.length : null;
  const interviewConversion = submitted.length
    ? interviews.length / submitted.length
    : null;
  const offerRate = submitted.length ? offers.length / submitted.length : null;

  const responseTimes = computeResponseTimes(events);
  const averageResponseDays = responseTimes.length
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null;

  const firstSubmit = submitted.length
    ? new Date(Math.min(...submitted.map((e) => e.occurredAt.getTime())))
    : null;
  const weeks = firstSubmit
    ? Math.max(1, (now.getTime() - firstSubmit.getTime()) / (7 * 86_400_000))
    : null;
  const applicationsPerWeek =
    weeks && submitted.length ? submitted.length / weeks : null;

  const sample = submitted.length;
  const level: Sufficiency["level"] =
    sample === 0
      ? "INSUFFICIENT"
      : sample < MINIMUM_SAMPLE_FOR_RELIABLE
        ? "DIRECTIONAL"
        : "RELIABLE";

  const sufficiencyMessage =
    sample === 0
      ? "Not enough data yet. Submit an application to start collecting signals."
      : sample < MINIMUM_SAMPLE_FOR_RELIABLE
        ? `Early result: ${replies.length} response${replies.length === 1 ? "" : "s"} from ${sample} submission${
            sample === 1 ? "" : "s"
          }. More data is needed before identifying a pattern.`
        : `${sample} submissions recorded. Patterns below are directional, not causal.`;

  const pct = (v: number | null) =>
    v === null ? "Not enough data yet" : `${Math.round(v * 100)}%`;

  return {
    applicationsSubmitted: sample,
    replies: replies.length,
    interviews: interviews.length,
    offers: offers.length,
    rejections: rejections.length,
    replyRate,
    interviewConversion,
    offerRate,
    averageResponseDays,
    applicationsPerWeek,
    sufficiency: {
      level,
      message: sufficiencyMessage,
      minimumForReliable: MINIMUM_SAMPLE_FOR_RELIABLE,
    },
    formulas: [
      {
        name: "Reply rate",
        formula: "Replies / Applications submitted",
        value: pct(replyRate),
      },
      {
        name: "Interview conversion",
        formula:
          "Applications reaching interview or offer / Applications submitted",
        value: pct(interviewConversion),
      },
      {
        name: "Offer rate",
        formula: "Offers / Applications submitted",
        value: pct(offerRate),
      },
      {
        name: "Average response time",
        formula: "Mean days from submission to first employer response",
        value:
          averageResponseDays === null
            ? "Not enough data yet"
            : `${averageResponseDays.toFixed(1)} days`,
      },
      {
        name: "Applications per week",
        formula: "Submissions / weeks since first submission",
        value:
          applicationsPerWeek === null
            ? "Not enough data yet"
            : applicationsPerWeek.toFixed(1),
      },
    ],
  };
}

function computeResponseTimes(events: readonly OutcomeEvent[]): number[] {
  const firstSubmit = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "SUBMITTED") continue;
    const prev = firstSubmit.get(e.applicationId);
    if (prev === undefined || e.occurredAt.getTime() < prev) {
      firstSubmit.set(e.applicationId, e.occurredAt.getTime());
    }
  }
  const out: number[] = [];
  for (const e of events) {
    if (!isReply(e) && e.type !== "REJECTED") continue;
    const submittedAt = firstSubmit.get(e.applicationId);
    if (submittedAt === undefined) continue;
    const days = (e.occurredAt.getTime() - submittedAt) / 86_400_000;
    if (days >= 0 && days < 365) out.push(days);
  }
  return out;
}

/**
 * Attribute-grouped observation.
 *
 * Allowed  : "Applications containing your analytics project received 4 replies from 11 submissions."
 * Forbidden: "Your analytics project increased your interview chance by 36%."
 *
 * The second requires a control group and a causal design, which we do not have.
 */
export interface AttributePattern {
  attribute: string;
  attributeValue: string;
  submissions: number;
  replies: number;
  replyRate: number;
  sufficiency: Sufficiency;
  statement: string;
  causal: false;
}

export function computeAttributePatterns(
  events: readonly OutcomeEvent[],
  attributeName: string,
  getValue: (e: OutcomeEvent) => string[],
): AttributePattern[] {
  const byValue = new Map<
    string,
    { submitted: Set<string>; replied: Set<string> }
  >();

  for (const e of events) {
    for (const value of getValue(e)) {
      const key = value;
      const bucket = byValue.get(key) ?? {
        submitted: new Set<string>(),
        replied: new Set<string>(),
      };
      if (e.type === "SUBMITTED") bucket.submitted.add(e.applicationId);
      if (isReply(e)) bucket.replied.add(e.applicationId);
      byValue.set(key, bucket);
    }
  }

  const patterns: AttributePattern[] = [];
  for (const [value, bucket] of byValue) {
    const submissions = bucket.submitted.size;
    const replies = bucket.replied.size;
    if (submissions === 0) continue;
    const replyRate = replies / submissions;
    const level: Sufficiency["level"] =
      submissions < MINIMUM_SAMPLE_FOR_RELIABLE
        ? submissions === 0
          ? "INSUFFICIENT"
          : "DIRECTIONAL"
        : "RELIABLE";
    patterns.push({
      attribute: attributeName,
      attributeValue: value,
      submissions,
      replies,
      replyRate: Math.round(replyRate * 1000) / 1000,
      sufficiency: {
        level,
        message:
          submissions < MINIMUM_SAMPLE_FOR_RELIABLE
            ? `${replies} response${replies === 1 ? "" : "s"} from ${submissions} submission${submissions === 1 ? "" : "s"}. More data is needed before identifying a pattern.`
            : `${replies} responses from ${submissions} submissions.`,
        minimumForReliable: MINIMUM_SAMPLE_FOR_RELIABLE,
      },
      statement: `Applications containing ${value} received ${replies} ${replies === 1 ? "reply" : "replies"} from ${submissions} submission${submissions === 1 ? "" : "s"}.`,
      causal: false,
    });
  }

  return patterns.sort((a, b) => b.submissions - a.submissions);
}
