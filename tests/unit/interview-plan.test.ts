import { describe, expect, it } from "vitest";
import {
  alignToPlan,
  buildQuestionPlan,
  DEPTHS,
  guardStrongerAnswer,
  summarizeSession,
  type QuestionSlot,
} from "@/domain/interview-plan";

const count = (plan: Array<{ slot: QuestionSlot }>, slot: QuestionSlot) =>
  plan.filter((p) => p.slot === slot).length;

describe("mock interview question plan", () => {
  it("Standard = 1 opener, 3 behavioural, 2 role, 1 gap, 1 closer", () => {
    const plan = buildQuestionPlan("STANDARD", ["SQL"]);
    expect(plan).toHaveLength(8);
    expect(plan[0]!.slot).toBe("OPENER");
    expect(plan[plan.length - 1]!.slot).toBe("CLOSER");
    expect(count(plan, "BEHAVIOURAL")).toBe(3);
    expect(count(plan, "ROLE")).toBe(2);
    expect(plan.find((p) => p.slot === "GAP")?.requirement).toBe("SQL");
  });

  it("Quick and Deep scale the same mix", () => {
    expect(buildQuestionPlan("QUICK", ["a"])).toHaveLength(DEPTHS.QUICK.count);
    const deep = buildQuestionPlan("DEEP", ["a", "b"]);
    expect(deep).toHaveLength(12);
    expect(count(deep, "GAP")).toBe(2);
    expect(count(deep, "OPENER")).toBe(1);
    expect(count(deep, "CLOSER")).toBe(1);
  });

  it("probes the weakest area when no gap was identified", () => {
    const plan = buildQuestionPlan("STANDARD", []);
    expect(count(plan, "GAP")).toBe(0);
    expect(count(plan, "ROLE")).toBe(3);
  });

  it("aligns model questions to the plan and fills a missing opener/closer", () => {
    const plan = buildQuestionPlan("QUICK", ["Kubernetes"]);
    const aligned = alignToPlan(
      plan,
      [
        {
          question: "Tell me about a time you shipped under pressure.",
          slot: "BEHAVIOURAL" as const,
        },
        {
          question: "How would you design our onboarding flow?",
          slot: "ROLE" as const,
        },
        {
          question: "How would you get up to speed on Kubernetes?",
          slot: "GAP" as const,
        },
      ],
      "Product Designer",
    );
    expect(aligned.map((a) => a.slot)).toEqual([
      "OPENER",
      "BEHAVIOURAL",
      "ROLE",
      "GAP",
      "CLOSER",
    ]);
    expect(aligned[0]!.text).toMatch(/Tell me about yourself/);
    expect(aligned[4]!.text).toMatch(/questions for us/);
  });
});

describe("stronger answer guard", () => {
  it("drops sentences that introduce numbers the user never stated", () => {
    const { text, removed } = guardStrongerAnswer(
      "I rebuilt the reporting pack in Excel. It cut close from 5 days to 2. Revenue grew 40% as a result.",
      "I rebuilt the month-end reporting pack; preparation went from 5 days to 2.",
    );
    expect(text).toContain("5 days to 2");
    expect(text).not.toContain("40%");
    expect(removed).toHaveLength(1);
  });
});

describe("session summary", () => {
  it("takes strengths from the best answers and fixes from the weakest", () => {
    const s = summarizeSession([
      {
        question: "q1",
        relevance: 5,
        specificity: 5,
        evidence: 4,
        structure: 5,
        strength: "Clear STAR structure",
        improvement: "Name the tool",
      },
      {
        question: "q2",
        relevance: 2,
        specificity: 1,
        evidence: 1,
        structure: 2,
        strength: "Honest about the gap",
        improvement: "Give one concrete example",
      },
      {
        question: "q3",
        relevance: null,
        specificity: null,
        evidence: null,
        structure: null,
        strength: null,
        improvement: null,
      },
    ]);
    expect(s.strengths[0]).toBe("Clear STAR structure");
    expect(s.fixes[0]).toBe("Give one concrete example");
    expect(s.average).toBeCloseTo(3.1, 1);
  });
});
