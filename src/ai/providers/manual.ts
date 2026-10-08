import {
  AIProviderError,
  type AIProvider,
  type AIRequest,
  type AIResponse,
} from "../provider";
import type { AIProviderName } from "@prisma/client";
import { PROMPTS, buildPrompt } from "../prompts";
import type { WorkflowId } from "../workflow-ids";
import { env } from "@/lib/env";

/**
 * Manual AI Mode — the default, always available, and a first-class product
 * mode rather than a degraded fallback.
 *
 * Acme Jobs produces a complete, self-contained prompt. The user runs it in any
 * assistant, pastes the result back, and Acme Jobs validates it. No API key, no
 * cost, no network call, no GPU.
 */
export class ManualAIProvider implements AIProvider {
  readonly name: AIProviderName = "MANUAL";
  readonly costModel = "FREE_MANUAL" as const;
  readonly costLabel = "Manual Mode — cost to Acme Jobs: $0";

  async isConfigured(): Promise<boolean> {
    return true;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    return { ok: true, detail: "always available" };
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const def = PROMPTS[request.workflowId];
    if (!def) {
      throw new AIProviderError(
        "MANUAL",
        "NOT_CONFIGURED",
        `Unknown workflow ${request.workflowId}`,
        false,
      );
    }
    return {
      rawText: "",
      provider: "MANUAL",
      model: "user-provided-assistant",
      promptVersion: request.promptVersion,
      durationMs: 0,
      manual: true,
      warnings: [
        "Manual Mode: copy the prompt into your preferred assistant and paste the response back.",
      ],
    };
  }
}

/**
 * The prompt handed to the user. Self-contained: it contains the safety rules,
 * the output contract, and everything Acme Jobs knows about this request, so the
 * external assistant cannot fill gaps with guesses any more than the app would.
 */
export interface ManualPromptPackage {
  workflowId: WorkflowId;
  promptVersion: string;
  title: string;
  instructions: string;
  systemPrompt: string;
  userPrompt: string;
  outputContract: string;
  /** One-click copy target: the whole package as a single block. */
  fullPrompt: string;
  expectedShape: string;
  pasteHint: string;
  validationNotes: string[];
  zeroCostNote: string;
}

const TITLES: Record<WorkflowId, string> = {
  JOB_ANALYSIS: "Analyze a job description",
  EVIDENCE_EXTRACTION: "Extract evidence from your experience",
  RESUME_TAILORING: "Tailor your resume",
  RESUME_BULLET: "Improve one resume bullet",
  COVER_LETTER: "Write a cover letter",
  LINKEDIN_OPTIMIZER: "Improve your LinkedIn",
  APPLICATION_ANSWER: "Answer an application question",
  STAR_STORY: "Structure a STAR story",
  INTERVIEW_QUESTION: "Prepare interview questions",
  INTERVIEW_FEEDBACK: "Get feedback on an interview answer",
  POST_INTERVIEW_REVIEW: "Review your interview",
  FOLLOW_UP: "Write a follow-up message",
  CAREER_NARRATIVE: "Build your career narrative",
  VOICE_PROFILE: "Infer your writing style",
  ACHIEVEMENT_INTERVIEW: "Interview about an achievement",
  ASK_ACME: "Ask about your job search",
  DEFEND_CLAIM: "Check whether you can defend a claim",
  PROFILE_IMPORT: "Build your profile from your CV",
  JOB_SEARCH_PLAN: "Plan a job search",
  JOB_RERANK: "Rank job listings for you",
};

const PASTE_HINTS: Record<"json" | "text", string> = {
  json: 'Paste the assistant response into the "Paste AI response" box. Acme Jobs validates it with a schema check and repairs it locally when that is safe; if it cannot, it tells you exactly which field is wrong.',
  text: "Paste the assistant response into the box below. Acme Jobs will validate it before using it.",
};

export function buildManualPrompt(
  workflowId: WorkflowId,
  context: Record<string, unknown>,
  promptVersion: string,
): ManualPromptPackage {
  const built = buildPrompt(workflowId, context);
  const expectJson = Boolean(built.jsonHint);
  const validationNotes = expectJson
    ? [
        "Must be valid JSON with exactly the requested keys.",
        "Unknown keys are ignored; missing required keys are reported.",
        "A JSON object wrapped in a ```json fence is accepted.",
      ]
    : ["Plain text is fine; no structured parsing is applied."];

  const fullPrompt = [
    "You are helping with a job search. Follow every rule exactly.",
    "",
    "=== SYSTEM RULES ===",
    built.systemPrompt,
    "",
    "=== YOUR TASK ===",
    built.userPrompt,
    "",
    expectJson
      ? `=== OUTPUT FORMAT (required) ===\nReturn a single JSON object and nothing else. No prose, no markdown fences.\nSchema example:\n${built.jsonHint}`
      : "=== OUTPUT FORMAT ===\nReturn the requested content as plain text.",
    "",
    "=== END ===",
  ].join("\n");

  return {
    workflowId,
    promptVersion,
    title: TITLES[workflowId],
    instructions:
      "Copy the prompt, paste it into ChatGPT, Claude, Gemini or any assistant you already use, then paste the response back into Acme Jobs.",
    systemPrompt: built.systemPrompt,
    userPrompt: built.userPrompt,
    outputContract: expectJson ? (built.jsonHint ?? "") : "Plain text",
    fullPrompt,
    expectedShape: expectJson ? "JSON" : "Text",
    pasteHint: expectJson ? PASTE_HINTS.json : PASTE_HINTS.text,
    validationNotes,
    zeroCostNote: `Acme Jobs is in Manual Mode (${env().ZERO_COST_MODE ? "ZERO_COST_MODE" : "manual"}). You are using your own assistant — Acme Jobs spends $0 on AI for this workflow.`,
  };
}
