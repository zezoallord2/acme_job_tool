import { describe, it, expect } from "vitest";
import { extractJson, validateWorkflowOutput, safetyScan } from "@/ai/validate";
import { ManualAIProvider, buildManualPrompt } from "@/ai/providers/manual";
import { AIProviderError } from "@/ai/provider";
import { LocalAIProvider } from "@/ai/providers/local";
import { resolveProvider, aiCostSummary } from "@/ai/router";
import { PROMPTS, buildPrompt } from "@/ai/prompts";
import { activePromptVersion, WORKFLOW_IDS } from "@/ai/workflow-ids";

describe("JSON extraction from pasted AI output", () => {
  it("parses clean JSON", () => {
    const result = extractJson('{"a":1}');
    expect(result.ok).toBe(true);
    expect(result.repaired).toBe(false);
  });

  it("unwraps a fenced block", () => {
    const result = extractJson('```json\n{"a":1}\n```');
    expect(result.ok).toBe(true);
    expect(result.repaired).toBe(true);
  });

  it("scans out a JSON object surrounded by prose", () => {
    const result = extractJson('Here you go:\n{"a":1}\nHope that helps!');
    expect(result.ok).toBe(true);
  });

  it("repairs trailing commas", () => {
    const result = extractJson('{"a":1,}');
    expect(result.ok).toBe(true);
  });

  it("refuses unparseable text and explains why", () => {
    const result = extractJson("I cannot do that.");
    expect(result.ok).toBe(false);
    expect(result.problems.length).toBeGreaterThan(0);
  });

  it("never treats a string containing braces as JSON", () => {
    const result = extractJson("not json { this is prose }");
    expect(result.ok).toBe(false);
  });
});

describe("Workflow output schema validation", () => {
  const validAnalysis = {
    role: "Data Analyst",
    company: "Acme",
    seniority: "Mid",
    summary: "Reporting role",
    mustHaveRequirements: ["Advanced Excel"],
    preferredRequirements: ["Power BI"],
    responsibilities: ["Build weekly reports"],
    hardSkills: ["Excel"],
    softSkills: ["Communication"],
    tools: ["Excel"],
    educationRequirements: [],
    certificationRequirements: [],
    experienceRequirement: "2+ years",
    repeatedThemes: ["reporting"],
    importantLanguage: ["weekly reports"],
    dealBreakers: [],
    needsInput: [],
  };

  it("accepts a well-formed analysis", () => {
    const result = validateWorkflowOutput<typeof validAnalysis>(
      "JOB_ANALYSIS",
      JSON.stringify(validAnalysis),
    );
    expect(result.ok).toBe(true);
  });

  it("reports which field is wrong rather than guessing", () => {
    const result = validateWorkflowOutput(
      "JOB_ANALYSIS",
      JSON.stringify({ ...validAnalysis, mustHaveRequirements: "nope" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain("mustHaveRequirements");
    }
  });

  it("rejects malformed JSON before schema validation", () => {
    const result = validateWorkflowOutput("JOB_ANALYSIS", "not json at all");
    expect(result.ok).toBe(false);
  });

  it("flags an out-of-range score", () => {
    const result = validateWorkflowOutput(
      "INTERVIEW_FEEDBACK",
      JSON.stringify({
        relevance: 9,
        specificity: 3,
        evidence: 3,
        structure: 3,
        clarity: 3,
        wasVague: false,
        unsupportedClaims: [],
        followUpQuestion: null,
        coachNote: "",
      }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("Safety scanning", () => {
  it("detects banned buzzword phrasing", () => {
    const report = safetyScan(
      "I am a results-driven dynamic professional who leveraged synergy.",
    );
    expect(report.bannedPhrasesFound.length).toBeGreaterThan(0);
  });

  it("detects unsubstantiated superlatives", () => {
    const report = safetyScan("I am a world-class engineer.");
    expect(report.hedges).toContain("unsubstantiated superlative");
  });

  it("accepts plain writing", () => {
    const report = safetyScan(
      "I rebuilt the weekly report in Excel and cut preparation to two days.",
    );
    expect(report.bannedPhrasesFound).toHaveLength(0);
    expect(report.hedges).toHaveLength(0);
  });
});

describe("Manual AI Mode is a first-class mode", () => {
  it("is always configured and available", async () => {
    const provider = new ManualAIProvider();
    expect(await provider.isConfigured()).toBe(true);
    expect(await provider.isAvailable()).toBe(true);
    expect((await provider.health()).ok).toBe(true);
  });

  it("costs Acme Jobs nothing", () => {
    expect(new ManualAIProvider().costModel).toBe("FREE_MANUAL");
  });

  it("produces a self-contained prompt with the output contract", () => {
    const prompt = buildManualPrompt(
      "JOB_ANALYSIS",
      { description: "A job description", targetRole: "Analyst" },
      "v4",
    );
    expect(prompt.fullPrompt).toContain("A job description");
    expect(prompt.fullPrompt).toContain("Never invent experience");
    expect(prompt.fullPrompt).toContain("OUTPUT FORMAT");
    expect(prompt.expectedShape).toBe("JSON");
    expect(prompt.validationNotes.length).toBeGreaterThan(0);
    expect(prompt.zeroCostNote).toContain("$0");
  });

  it("builds a prompt for every workflow id", () => {
    for (const id of WORKFLOW_IDS) {
      expect(PROMPTS[id]).toBeDefined();
      expect(() => buildPrompt(id, {})).not.toThrow();
      expect(activePromptVersion(id)).toMatch(/v\d+$/);
    }
  });

  it("states the safety contract in every system prompt", () => {
    for (const id of WORKFLOW_IDS) {
      const prompt = PROMPTS[id].systemPrompt.toLowerCase();
      expect(prompt).toContain("never invent");
    }
  });
});

describe("Provider resolution in zero-cost mode", () => {
  it("resolves to Manual Mode when nothing is configured", async () => {
    const resolution = await resolveProvider();
    expect(resolution.provider.name).toBe("MANUAL");
    expect(resolution.provider.costModel).toBe("FREE_MANUAL");
  });

  it("reports honest cost responsibility for every provider", () => {
    const costs = aiCostSummary();
    const manual = costs.find((c) => c.provider === "Manual Mode")!;
    expect(manual.costModel).toBe("FREE_MANUAL");
    expect(manual.label).toContain("$0");

    const acme = costs.find((c) => c.provider === "Acme Integrated AI")!;
    expect(acme.available).toBe(false);
    expect(acme.label).toContain("Disabled until");

    for (const provider of ["OpenAI (BYOK)", "Anthropic (BYOK)"]) {
      const entry = costs.find((c) => c.provider === provider)!;
      expect(entry.costModel).toBe("BYOK");
    }
  });

  it("reports local AI as unavailable when not configured, without failing", async () => {
    const local = new LocalAIProvider({ baseUrl: "", model: "" });
    expect(await local.isConfigured()).toBe(false);
    const health = await local.health();
    expect(health.ok).toBe(false);
  });

  it("blocks remote Ollama endpoints unless the operator explicitly opts in", async () => {
    const local = new LocalAIProvider({
      baseUrl: "http://example.com:11434",
      model: "acme-jobs",
    });
    expect(await local.isConfigured()).toBe(false);
    expect((await local.health()).detail).toContain("remote");
  });

  it("rejects oversized prompts before sending career data", async () => {
    const local = new LocalAIProvider({
      baseUrl: "http://127.0.0.1:11434",
      model: "acme-jobs",
      maxContext: 512,
    });
    await expect(
      local.generate({
        workflowId: "JOB_ANALYSIS",
        promptVersion: "test-v1",
        systemPrompt: "safe",
        userPrompt: "x".repeat(2_100),
      }),
    ).rejects.toMatchObject({ kind: "CONTENT_TOO_LARGE", retryable: false });
  });
});

describe("AI provider failure taxonomy", () => {
  it("classifies timeouts, rate limits and outages as retryable", async () => {
    const provider = new ManualAIProvider();
    expect(provider).toBeDefined();

    const { classifyProviderFailure } = await import("@/ai/provider");
    expect(classifyProviderFailure("Request timed out")).toBe("TIMEOUT");
    expect(classifyProviderFailure("Rate limit exceeded", 429)).toBe(
      "RATE_LIMIT",
    );
    expect(classifyProviderFailure("Service unavailable", 503)).toBe("OUTAGE");
    expect(classifyProviderFailure("model refused to answer")).toBe("REFUSAL");
    expect(classifyProviderFailure("Unexpected token in JSON")).toBe(
      "MALFORMED_JSON",
    );
  });

  it("treats an unconfigured provider as non-retryable", () => {
    const err = new AIProviderError(
      "OPENAI",
      "NOT_CONFIGURED",
      "no key",
      false,
    );
    expect(err.retryable).toBe(false);
  });
});
