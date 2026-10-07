"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ManualModePanel,
  type ManualPromptPayload,
} from "@/components/manual-mode-panel";
import { Alert, Field } from "@/components/ui/primitives";
import {
  buildAchievementPrompt,
  buildCoachPrompt,
  buildDefensePrompt,
  buildExtractionPrompt,
  buildQuestionsPrompt,
  finishMiningAction,
  submitAchievementTurnAction,
  submitCoachAction,
  submitDefenseAction,
  submitExtractionAction,
  submitQuestionsAction,
} from "@/app/actions/coaching-actions";
import type { CoachingSubmitResult } from "@/app/actions/state";
import type {
  AchievementInterviewOutput,
  DefendClaimOutput,
  EvidenceExtractionOutput,
  InterviewFeedbackOutput,
  InterviewQuestionsOutput,
} from "@/ai/schemas";

/**
 * Shared Manual Mode shell for the coaching workflows.
 *
 * Every panel follows the same contract as job analysis: build a prompt, copy it,
 * paste a response back, validate, then show the real result. Nothing is treated
 * as success until the server has accepted it.
 */

/** Typed idle states so each panel keeps its own result shape. */
const IDLE_EXTRACTION: CoachingSubmitResult<EvidenceExtractionOutput> = {
  ok: true,
};
const IDLE_TURN: CoachingSubmitResult<AchievementInterviewOutput> = {
  ok: true,
};
const IDLE_FINISH: CoachingSubmitResult<{ proposalIds: string[] }> = {
  ok: true,
};
const IDLE_DEFENSE: CoachingSubmitResult<DefendClaimOutput> = { ok: true };
const IDLE_QUESTIONS: CoachingSubmitResult<InterviewQuestionsOutput> = {
  ok: true,
};
const IDLE_COACH: CoachingSubmitResult<InterviewFeedbackOutput> = { ok: true };
function fieldsToFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function readPrompt(result: unknown): ManualPromptPayload | null {
  const r = result as { ok?: boolean; prompt?: ManualPromptPayload } | null;
  return r && r.ok && r.prompt ? r.prompt : null;
}

function readError(result: unknown): string | null {
  const r = result as { ok?: boolean; message?: string } | null;
  return r && r.ok === false && r.message ? r.message : null;
}

/** The prompt-request half: renders the Manual Mode panel once a prompt exists. */
function PromptStage({
  prompt,
  busy,
  onValidate,
  actionLabel,
}: {
  prompt: ManualPromptPayload;
  busy: boolean;
  onValidate: (raw: string) => Promise<{
    ok: boolean;
    errors: string[];
    repaired: boolean;
  }>;
  actionLabel: string;
}) {
  return (
    <ManualModePanel
      prompt={prompt}
      busy={busy}
      onValidate={onValidate}
      actionLabel={actionLabel}
    />
  );
}

function PromptLoader({
  busy,
  onBuild,
  disabled,
  children,
}: {
  busy: boolean;
  onBuild: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {children}
      <button
        type="button"
        className="btn-primary"
        onClick={onBuild}
        disabled={busy || disabled}
      >
        {busy ? "Building the prompt…" : "Build the prompt"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence Extraction
// ---------------------------------------------------------------------------

export function EvidenceExtractionPanel() {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [narrative, setNarrative] = useState("");
  const [prompt, setPrompt] = useState<ManualPromptPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] =
    useState<CoachingSubmitResult<EvidenceExtractionOutput>>(IDLE_EXTRACTION);

  const build = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await buildExtractionPrompt(fieldsToFormData({ narrative }));
      const p = readPrompt(res);
      if (p) setPrompt(p);
      else setError(readError(res) ?? "The prompt could not be built.");
    });
  }, [narrative]);

  const validate = useCallback(
    (raw: string) =>
      new Promise<{ ok: boolean; errors: string[]; repaired: boolean }>(
        (resolve) => {
          startTransition(async () => {
            setSubmitted(true);
            const fd = fieldsToFormData({ narrative });
            fd.set("raw", raw);
            const r = await submitExtractionAction(IDLE_EXTRACTION, fd);
            setResult(r);
            resolve({
              ok: r.ok,
              errors: r.errors ?? [],
              repaired: false,
            });
            if (r.ok) router.refresh();
          });
        },
      ),
    [narrative, router],
  );

  if (submitted && result.ok && result.data) {
    return (
      <div className="space-y-3">
        <Alert tone="success" title="Statements extracted">
          {result.message}
        </Alert>
        <ul className="space-y-1.5">
          {result.data.statements.map((s, i) => (
            <li key={`${s.statement}-${i}`} className="card-muted p-2.5">
              <p className="text-sm text-[var(--text)]">{s.statement}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {s.claimType}
                {s.metricValue != null
                  ? ` · ${s.metricValue}${s.metricUnit ? ` ${s.metricUnit}` : ""}`
                  : ""}
                {s.tags.length > 0 ? ` · ${s.tags.join(", ")}` : ""}
              </p>
            </li>
          ))}
        </ul>
        {result.data.needsInput.length > 0 ? (
          <Alert tone="warning" title="Still missing detail">
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {result.data.needsInput.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {prompt ? (
        <>
          {submitted && !result.ok && result.message ? (
            <Alert tone="error" title="Nothing was saved">
              {result.message}
            </Alert>
          ) : null}
          <PromptStage
            prompt={prompt}
            busy={busy}
            onValidate={validate}
            actionLabel="Filing each statement as a proposal you must approve"
          />
        </>
      ) : (
        <PromptLoader
          busy={busy}
          onBuild={build}
          disabled={narrative.trim().length < 40}
        >
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field
            label="Describe the work in your own words"
            htmlFor="ex-narrative"
            required
            hint="What you did, on what, with which tools, and what came of it. Include every number you actually know."
          >
            <textarea
              id="ex-narrative"
              className="input min-h-[160px]"
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              maxLength={8000}
            />
          </Field>
          <p className="hint">
            Anything extracted becomes a proposal on the Learning page. Nothing
            enters your Evidence Ledger until you approve it.
          </p>
        </PromptLoader>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Achievement Mining
// ---------------------------------------------------------------------------

interface MinedFact {
  statement: string;
  claimType: string;
  metricValue: number | null;
  metricUnit: string | null;
}

export function AchievementMiningPanel() {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [topic, setTopic] = useState("");
  const [known, setKnown] = useState<Record<string, unknown>>({});
  const [questionCount, setQuestionCount] = useState(0);
  const [facts, setFacts] = useState<MinedFact[]>([]);
  const [turn, setTurn] = useState<AchievementInterviewOutput | null>(null);
  const [answer, setAnswer] = useState("");
  const [prompt, setPrompt] = useState<ManualPromptPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [turnResult, setTurnResult] =
    useState<CoachingSubmitResult<AchievementInterviewOutput>>(IDLE_TURN);
  const [fileResult, setFileResult] =
    useState<CoachingSubmitResult<{ proposalIds: string[] }>>(IDLE_FINISH);

  const build = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const fd = fieldsToFormData({
        known: JSON.stringify(known),
        questionCount: String(questionCount),
      });
      const res = await buildAchievementPrompt(fd);
      const p = readPrompt(res);
      if (p) setPrompt(p);
      else setError(readError(res) ?? "The prompt could not be built.");
    });
  }, [known, questionCount]);

  const validateTurn = useCallback(
    (raw: string) =>
      new Promise<{ ok: boolean; errors: string[]; repaired: boolean }>(
        (resolve) => {
          startTransition(async () => {
            setSubmitted(true);
            const fd = fieldsToFormData({
              known: JSON.stringify(known),
              questionCount: String(questionCount),
              raw,
            });
            const r = await submitAchievementTurnAction(IDLE_TURN, fd);
            setTurnResult(r);
            resolve({
              ok: r.ok,
              errors: r.errors ?? [],
              repaired: false,
            });

            if (r.ok && r.data) {
              const learned = r.data.factsLearned;
              setFacts((prev) => {
                const seen = new Set(prev.map((f) => f.statement));
                return [
                  ...prev,
                  ...learned.filter((f) => !seen.has(f.statement)),
                ];
              });
              setKnown((prev) => ({
                ...prev,
                asked: r.data?.questionType ?? prev.asked,
                lastQuestion: r.data?.nextQuestion ?? null,
                missingFields: r.data?.missingFields ?? [],
              }));
              setQuestionCount((n) => n + 1);
              setTurn(r.data);
              setPrompt(null);
              setSubmitted(false);
              setAnswer("");
            }
          });
        },
      ),
    [known, questionCount],
  );

  const file = () => {
    startTransition(async () => {
      const fd = fieldsToFormData({ facts: JSON.stringify(facts) });
      const r = await finishMiningAction(IDLE_FINISH, fd);
      setFileResult(r);
      if (r.ok) router.refresh();
    });
  };

  if (turn && facts.length > 0 && fileResult.ok) {
    return (
      <div className="space-y-3">
        <Alert tone="success" title="Filed as proposals">
          {fileResult.message}
        </Alert>
        <ul className="space-y-1.5">
          {facts.map((f) => (
            <li key={f.statement} className="card-muted p-2.5">
              <p className="text-sm text-[var(--text)]">{f.statement}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {f.claimType}
                {f.metricValue != null
                  ? ` · ${f.metricValue}${f.metricUnit ? ` ${f.metricUnit}` : ""}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {turn ? (
        <Alert
          tone="info"
          title={`Question ${questionCount}: ${turn.questionType.replace(/_/g, " ").toLowerCase()}`}
        >
          {turn.nextQuestion}
        </Alert>
      ) : (
        <Alert tone="info" title="Achievement Mining">
          Acme Jobs asks one question at a time until the story can be defended.
          It never writes the bullet for you.
        </Alert>
      )}

      {error ? <Alert tone="error">{error}</Alert> : null}
      {submitted && !turnResult.ok && turnResult.message ? (
        <Alert tone="error" title="That response was rejected">
          {turnResult.message}
        </Alert>
      ) : null}
      {fileResult.ok === false && fileResult.message ? (
        <Alert tone="error">{fileResult.message}</Alert>
      ) : null}

      {facts.length > 0 ? (
        <div className="card-muted p-3">
          <p className="text-sm font-medium text-[var(--text)]">
            Learned so far ({facts.length})
          </p>
          <ul className="mt-1.5 space-y-1">
            {facts.map((f) => (
              <li
                key={f.statement}
                className="text-xs text-[var(--text-muted)]"
              >
                • {f.statement}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {turn ? (
        <Field
          label="Your answer"
          htmlFor="am-answer"
          hint="Answer in your own words. Include the number if you know it."
        >
          <textarea
            id="am-answer"
            className="input min-h-[120px]"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={4000}
          />
        </Field>
      ) : (
        <Field
          label="What achievement do you want to make defensible?"
          htmlFor="am-topic"
        >
          <input
            id="am-topic"
            className="input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={200}
            placeholder="e.g. the month-end reporting rebuild"
          />
        </Field>
      )}

      {prompt ? (
        <PromptStage
          prompt={prompt}
          busy={busy}
          onValidate={validateTurn}
          actionLabel="Asking the next single question"
        />
      ) : (
        <PromptLoader
          busy={busy}
          onBuild={build}
          disabled={!turn || answer.trim().length < 10}
        >
          <button
            type="button"
            className="btn-primary"
            onClick={build}
            disabled={busy || !turn || answer.trim().length < 10}
          >
            {busy
              ? "Building the prompt…"
              : turn
                ? "Ask the next question"
                : "Start the interview"}
          </button>
        </PromptLoader>
      )}

      {facts.length >= 3 ? (
        <button
          type="button"
          className="btn-secondary"
          onClick={file}
          disabled={busy}
        >
          {busy ? "Filing…" : "File what we learned as proposals"}
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Claim Defense
// ---------------------------------------------------------------------------

export function ClaimDefensePanel({ initialClaim }: { initialClaim?: string }) {
  const [busy, startTransition] = useTransition();
  const [claim, setClaim] = useState(initialClaim ?? "");
  const [userAccount, setUserAccount] = useState("");
  const [prompt, setPrompt] = useState<ManualPromptPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] =
    useState<CoachingSubmitResult<DefendClaimOutput>>(IDLE_DEFENSE);

  const build = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await buildDefensePrompt(
        fieldsToFormData({ claim, userAccount }),
      );
      const p = readPrompt(res);
      if (p) setPrompt(p);
      else setError(readError(res) ?? "The prompt could not be built.");
    });
  }, [claim, userAccount]);

  const validate = useCallback(
    (raw: string) =>
      new Promise<{ ok: boolean; errors: string[]; repaired: boolean }>(
        (resolve) => {
          startTransition(async () => {
            setSubmitted(true);
            const fd = fieldsToFormData({ claim, userAccount });
            fd.set("raw", raw);
            const r = await submitDefenseAction(IDLE_DEFENSE, fd);
            setResult(r);
            resolve({
              ok: r.ok,
              errors: r.errors ?? [],
              repaired: false,
            });
          });
        },
      ),
    [claim, userAccount],
  );

  if (submitted && result.ok && result.data) {
    const d = result.data;
    const tone =
      d.verdict === "DEFENSIBLE"
        ? "success"
        : d.verdict === "OVERSTATED"
          ? "error"
          : "warning";
    return (
      <div className="space-y-3">
        <Alert
          tone={tone}
          title={`Verdict: ${d.verdict.replace(/_/g, " ").toLowerCase()}`}
        >
          {d.reason}
        </Alert>
        {result.warnings && result.warnings.length > 0 ? (
          <Alert tone="warning" title="Numbers you should check">
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        <div className="card-muted p-3">
          <p className="text-sm font-medium text-[var(--text)]">
            What you can actually say
          </p>
          <dl className="mt-2 space-y-2 text-sm">
            {d.whatHappened ? (
              <div>
                <dt className="text-xs font-semibold text-[var(--text-muted)]">
                  What happened
                </dt>
                <dd className="text-[var(--text)]">{d.whatHappened}</dd>
              </div>
            ) : null}
            {d.whatYouDid ? (
              <div>
                <dt className="text-xs font-semibold text-[var(--text-muted)]">
                  What you did
                </dt>
                <dd className="text-[var(--text)]">{d.whatYouDid}</dd>
              </div>
            ) : null}
            {d.whatWasTheResult ? (
              <div>
                <dt className="text-xs font-semibold text-[var(--text-muted)]">
                  What the result was
                </dt>
                <dd className="text-[var(--text)]">{d.whatWasTheResult}</dd>
              </div>
            ) : null}
            {d.suggestedHonestWording ? (
              <div>
                <dt className="text-xs font-semibold text-[var(--text-muted)]">
                  Suggested honest wording
                </dt>
                <dd className="text-[var(--text)]">
                  {d.suggestedHonestWording}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            This is a suggestion, not a change. Your resume was not modified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {prompt ? (
        <>
          {submitted && !result.ok && result.message ? (
            <Alert tone="error" title="Nothing was saved">
              {result.message}
            </Alert>
          ) : null}
          <PromptStage
            prompt={prompt}
            busy={busy}
            onValidate={validate}
            actionLabel="Classifying the claim honestly"
          />
        </>
      ) : (
        <PromptLoader
          busy={busy}
          onBuild={build}
          disabled={claim.trim().length < 10}
        >
          <Field
            label="The claim as it appears on your resume"
            htmlFor="cd-claim"
            required
          >
            <textarea
              id="cd-claim"
              className="input min-h-[90px]"
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              maxLength={1000}
            />
          </Field>
          <Field
            label="Your account of what really happened"
            htmlFor="cd-account"
            hint="Optional, but it makes the verdict far more useful."
          >
            <textarea
              id="cd-account"
              className="input min-h-[120px]"
              value={userAccount}
              onChange={(e) => setUserAccount(e.target.value)}
              maxLength={4000}
            />
          </Field>
        </PromptLoader>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interview Question Builder
// ---------------------------------------------------------------------------

export function QuestionBuilderPanel({
  applications,
}: {
  applications: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [mode, setMode] = useState("GENERAL");
  const [role, setRole] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState("5");
  const [prompt, setPrompt] = useState<ManualPromptPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] =
    useState<CoachingSubmitResult<InterviewQuestionsOutput>>(IDLE_QUESTIONS);

  const build = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await buildQuestionsPrompt(
        fieldsToFormData({ mode, role, applicationId, difficulty, count }),
      );
      const p = readPrompt(res);
      if (p) setPrompt(p);
      else setError(readError(res) ?? "The prompt could not be built.");
    });
  }, [mode, role, applicationId, difficulty, count]);

  const validate = useCallback(
    (raw: string) =>
      new Promise<{ ok: boolean; errors: string[]; repaired: boolean }>(
        (resolve) => {
          startTransition(async () => {
            setSubmitted(true);
            const fd = fieldsToFormData({
              mode,
              role,
              applicationId,
              difficulty,
              count,
            });
            fd.set("raw", raw);
            const r = await submitQuestionsAction(IDLE_QUESTIONS, fd);
            setResult(r);
            resolve({
              ok: r.ok,
              errors: r.errors ?? [],
              repaired: false,
            });
            if (r.ok) router.refresh();
          });
        },
      ),
    [mode, role, applicationId, difficulty, count, router],
  );

  if (submitted && result.ok && result.data) {
    return (
      <div className="space-y-3">
        <Alert tone="success" title="Questions ready">
          {result.message} Answer them in the mock interview to record your
          responses.
        </Alert>
        <ol className="space-y-2">
          {result.data.questions.map((q, i) => (
            <li key={`${q.question}-${i}`} className="card-muted p-3">
              <p className="text-sm font-medium text-[var(--text)]">
                {i + 1}. {q.question}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {q.category.replace(/_/g, " ").toLowerCase()}
                {q.rationale ? ` · ${q.rationale}` : ""}
              </p>
              {q.expectedSignals.length > 0 ? (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Listen for: {q.expectedSignals.join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {prompt ? (
        <>
          {submitted && !result.ok && result.message ? (
            <Alert tone="error" title="Nothing was saved">
              {result.message}
            </Alert>
          ) : null}
          <PromptStage
            prompt={prompt}
            busy={busy}
            onValidate={validate}
            actionLabel="Saving the questions onto a practice session"
          />
        </>
      ) : (
        <PromptLoader busy={busy} onBuild={build}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mode" htmlFor="qb-mode">
              <select
                id="qb-mode"
                className="input"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="GENERAL">General</option>
                <option value="BEHAVIORAL">Behavioural</option>
                <option value="ROLE_SPECIFIC">Role specific</option>
                <option value="TECHNICAL">Technical</option>
                <option value="RESUME_BASED">Resume based</option>
                <option value="GRADUATE">Graduate</option>
                <option value="CAREER_CHANGE">Career change</option>
                <option value="MANAGERIAL">Managerial</option>
              </select>
            </Field>
            <Field label="Difficulty" htmlFor="qb-diff">
              <select
                id="qb-diff"
                className="input"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="easy">Gentle</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </Field>
            <Field
              label="Role"
              htmlFor="qb-role"
              hint="Filled from the application if you pick one."
            >
              <input
                id="qb-role"
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                maxLength={200}
              />
            </Field>
            <Field label="How many" htmlFor="qb-count">
              <input
                id="qb-count"
                className="input"
                type="number"
                min={1}
                max={15}
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Prepare against an application"
            htmlFor="qb-app"
            hint="Acme Jobs uses the SENT resume and the job's requirements, so you prepare against exactly what the employer received."
          >
            <select
              id="qb-app"
              className="input"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
            >
              <option value="">No application — general practice</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
        </PromptLoader>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Answer Coach
// ---------------------------------------------------------------------------

const SCORE_LABELS: Array<[keyof InterviewFeedbackOutput, string]> = [
  ["relevance", "Relevance"],
  ["specificity", "Specificity"],
  ["evidence", "Evidence"],
  ["structure", "Structure"],
  ["clarity", "Clarity"],
];

export function AnswerCoachPanel() {
  const [busy, startTransition] = useTransition();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [jobRequirements, setJobRequirements] = useState("");
  const [prompt, setPrompt] = useState<ManualPromptPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] =
    useState<CoachingSubmitResult<InterviewFeedbackOutput>>(IDLE_COACH);

  const build = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await buildCoachPrompt(
        fieldsToFormData({ question, answer, jobRequirements }),
      );
      const p = readPrompt(res);
      if (p) setPrompt(p);
      else setError(readError(res) ?? "The prompt could not be built.");
    });
  }, [question, answer, jobRequirements]);

  const validate = useCallback(
    (raw: string) =>
      new Promise<{ ok: boolean; errors: string[]; repaired: boolean }>(
        (resolve) => {
          startTransition(async () => {
            setSubmitted(true);
            const fd = fieldsToFormData({
              question,
              answer,
              jobRequirements,
            });
            fd.set("raw", raw);
            const r = await submitCoachAction(IDLE_COACH, fd);
            setResult(r);
            resolve({
              ok: r.ok,
              errors: r.errors ?? [],
              repaired: false,
            });
          });
        },
      ),
    [question, answer, jobRequirements],
  );

  if (submitted && result.ok && result.data) {
    const d = result.data;
    return (
      <div className="space-y-3">
        <Alert
          tone={d.wasVague ? "warning" : "success"}
          title={d.wasVague ? "That answer was too vague" : "Scored"}
        >
          {d.coachNote || result.message}
        </Alert>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SCORE_LABELS.map(([key, label]) => {
            const value = Number(d[key] ?? 0);
            return (
              <div key={label} className="card-muted p-2 text-center">
                <p className="text-lg font-semibold tabular-nums text-[var(--text)]">
                  {value}
                  <span className="text-xs text-[var(--text-muted)]">/5</span>
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
              </div>
            );
          })}
        </div>
        {d.unsupportedClaims.length > 0 ? (
          <Alert tone="error" title="Claims your evidence does not support">
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {d.unsupportedClaims.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {d.followUpQuestion ? (
          <Alert tone="info" title="Practise the follow-up">
            {d.followUpQuestion}
          </Alert>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {prompt ? (
        <>
          {submitted && !result.ok && result.message ? (
            <Alert tone="error" title="Nothing was saved">
              {result.message}
            </Alert>
          ) : null}
          <PromptStage
            prompt={prompt}
            busy={busy}
            onValidate={validate}
            actionLabel="Scoring the answer against five criteria"
          />
        </>
      ) : (
        <PromptLoader
          busy={busy}
          onBuild={build}
          disabled={question.trim().length < 8 || answer.trim().length < 20}
        >
          <Field label="The question you were asked" htmlFor="ac-q" required>
            <input
              id="ac-q"
              className="input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={600}
            />
          </Field>
          <Field
            label="The answer you gave"
            htmlFor="ac-a"
            required
            hint="Paste a rough answer. It does not have to be polished."
          >
            <textarea
              id="ac-a"
              className="input min-h-[140px]"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              maxLength={8000}
            />
          </Field>
          <Field
            label="Job requirements"
            htmlFor="ac-req"
            hint="Optional. One requirement per line."
          >
            <textarea
              id="ac-req"
              className="input min-h-[80px]"
              value={jobRequirements}
              onChange={(e) => setJobRequirements(e.target.value)}
              maxLength={2000}
            />
          </Field>
        </PromptLoader>
      )}
    </div>
  );
}
