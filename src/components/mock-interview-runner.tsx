"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  answerAiQuestionAction,
  interviewSummaryAction,
  startAiInterviewAction,
  type AiInterviewFailure,
} from "@/app/actions/interview-actions";
import type {
  MockFeedbackView,
  MockQuestionView,
} from "@/services/mock-interview-service";
import {
  ManualModePanel,
  type ManualPromptPayload,
} from "@/components/manual-mode-panel";
import { Alert, Field } from "@/components/ui/primitives";

/**
 * AI mock interview: pick the job and the length, then one question per
 * screen. Every answer gets a short score, one concrete improvement and a
 * stronger answer built only from the user's own evidence. Manual Mode is a
 * small secondary link at each AI step.
 */

const DEPTH_OPTIONS = [
  { value: "QUICK", label: "Quick", detail: "5 questions · ~10 min" },
  { value: "STANDARD", label: "Standard", detail: "8 questions · ~20 min" },
  { value: "DEEP", label: "Deep", detail: "12 questions · ~30 min" },
] as const;

type Summary = {
  role: string;
  answered: number;
  total: number;
  average: number | null;
  strengths: string[];
  fixes: string[];
};

type ManualStep =
  | { kind: "start"; prompt: ManualPromptPayload }
  | { kind: "answer"; prompt: ManualPromptPayload }
  | null;

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onend: (() => void) | null;
}

function speechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((Math.max(0, Math.min(5, value)) / 5) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-[var(--text-muted)]">
        <span>{label}</span>
        <span className="tabular-nums">{value}/5</span>
      </div>
      <div
        className="mt-1 h-2 rounded-full"
        style={{ background: "var(--surface-muted)" }}
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={5}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: "var(--brand-accent)" }}
        />
      </div>
    </div>
  );
}

export function MockInterviewRunner({
  applications,
  targetRole,
}: {
  applications: Array<{ id: string; label: string }>;
  targetRole: string;
}) {
  const [busy, startTransition] = useTransition();
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? "");
  const [role, setRole] = useState(targetRole);
  const [depth, setDepth] = useState<string>("STANDARD");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<MockQuestionView[]>([]);
  const [generatedBy, setGeneratedBy] = useState("");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<MockFeedbackView | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackPrompt, setFallbackPrompt] =
    useState<ManualPromptPayload | null>(null);
  const [manual, setManual] = useState<ManualStep>(null);

  // The timer is derived from when the current question appeared; handlers set
  // that moment, the interval only advances "now".
  const [questionStart, setQuestionStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const canDictate = speechRecognition() !== null;

  const current = questions[index];

  useEffect(() => {
    if (!current || feedback) return;
    // -1 means "a new question just appeared": the first tick stamps it.
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setQuestionStart((start) => (start < 0 ? t : start));
    }, 1000);
    return () => clearInterval(timer);
  }, [current, feedback]);
  const elapsed =
    questionStart < 0
      ? 0
      : Math.max(0, Math.floor((now - questionStart) / 1000));

  useEffect(() => () => recognition.current?.stop(), []);

  const failed = (res: AiInterviewFailure, kind: "start" | "answer") => {
    if (res.code === "MANUAL_REQUIRED" && res.prompt) {
      setManual({ kind, prompt: res.prompt as ManualPromptPayload });
      setError(null);
      return;
    }
    setError(res.message);
    setFallbackPrompt((res.prompt as ManualPromptPayload | undefined) ?? null);
  };

  const startPayload = (extra: Record<string, unknown> = {}) => ({
    applicationId: applicationId || undefined,
    targetRole: applicationId ? undefined : role,
    depth,
    ...extra,
  });

  const begin = (extra: Record<string, unknown> = {}) =>
    startTransition(async () => {
      setError(null);
      const res = await startAiInterviewAction(startPayload(extra));
      if (res.ok) {
        setSessionId(res.sessionId);
        setQuestions(res.questions);
        setGeneratedBy(res.generatedBy);
        setIndex(0);
        setQuestionStart(-1);
        setManual(null);
        setFallbackPrompt(null);
      } else failed(res, "start");
    });

  const submit = (extra: Record<string, unknown> = {}) =>
    startTransition(async () => {
      if (!sessionId || !current) return;
      setError(null);
      recognition.current?.stop();
      const res = await answerAiQuestionAction({
        sessionId,
        questionId: current.id,
        transcript: answer,
        ...extra,
      });
      if (res.ok) {
        setFeedback(res.feedback);
        setManual(null);
        setFallbackPrompt(null);
      } else failed(res, "answer");
    });

  const next = () => {
    setFeedback(null);
    setAnswer("");
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setQuestionStart(-1);
      return;
    }
    finish();
  };

  const finish = () =>
    startTransition(async () => {
      if (!sessionId) return;
      const res = await interviewSummaryAction(sessionId);
      if (res.ok) setSummary(res.summary);
      else setError(res.message);
    });

  const openManual = (kind: "start" | "answer") => {
    if (fallbackPrompt) {
      setManual({ kind, prompt: fallbackPrompt });
      return;
    }
    if (kind === "start") begin({ mode: "manual-prompt" });
    else submit({ mode: "manual-prompt" });
  };

  const pasteBack = (raw: string) =>
    new Promise<{ ok: boolean; errors: string[]; repaired: boolean }>(
      (resolve) => {
        const kind = manual?.kind;
        startTransition(async () => {
          const res =
            kind === "start"
              ? await startAiInterviewAction(startPayload({ manualInput: raw }))
              : await answerAiQuestionAction({
                  sessionId,
                  questionId: current?.id,
                  transcript: answer,
                  manualInput: raw,
                });
          if (res.ok) {
            if ("sessionId" in res) {
              setSessionId(res.sessionId);
              setQuestions(res.questions);
              setGeneratedBy(res.generatedBy);
              setIndex(0);
              setQuestionStart(-1);
            } else {
              setFeedback(res.feedback);
            }
            setManual(null);
          }
          resolve({
            ok: res.ok,
            errors: res.ok ? [] : (res.errors ?? [res.message]),
            repaired: false,
          });
        });
      },
    );

  const toggleDictation = () => {
    const Ctor = speechRecognition();
    if (!Ctor) return;
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (event) => {
      let added = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const r = event.results[i]!;
        if (r.isFinal) added += r[0].transcript;
      }
      if (added)
        setAnswer((prev) => `${prev}${prev ? " " : ""}${added.trim()}`);
    };
    rec.onend = () => setListening(false);
    recognition.current = rec;
    rec.start();
    setListening(true);
  };

  const errorBox = (kind: "start" | "answer") =>
    error ? (
      <Alert
        tone="error"
        title={
          kind === "start"
            ? "The interview did not start"
            : "This answer was not scored"
        }
        action={
          <button
            type="button"
            className="btn-secondary"
            onClick={() => openManual(kind)}
          >
            Use manual mode
          </button>
        }
      >
        {error}
      </Alert>
    ) : null;

  const manualPanel = manual ? (
    <ManualModePanel
      prompt={manual.prompt}
      busy={busy}
      onValidate={pasteBack}
      actionLabel={
        manual.kind === "start"
          ? "Starting the interview"
          : "Scoring your answer"
      }
    />
  ) : null;

  // --- Summary --------------------------------------------------------------
  if (summary) {
    return (
      <div className="space-y-4" data-testid="interview-summary">
        <h2 className="section-title">
          Interview summary{summary.role ? ` — ${summary.role}` : ""}
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          {summary.answered} of {summary.total} questions answered
          {summary.average !== null ? ` · average ${summary.average}/5` : ""}.
          Scores describe the answers, never your chance of being hired.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold">Top strengths</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {summary.strengths.length ? (
                summary.strengths.map((s) => <li key={s}>{s}</li>)
              ) : (
                <li>Answer a few more questions to see patterns.</li>
              )}
            </ol>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold">Top fixes</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {summary.fixes.length ? (
                summary.fixes.map((s) => <li key={s}>{s}</li>)
              ) : (
                <li>No recurring issues found.</li>
              )}
            </ol>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setSummary(null);
              setSessionId(null);
              setQuestions([]);
              setIndex(0);
              setQuestionStart(-1);
            }}
          >
            Start another interview
          </button>
          <Link href="/app/stories" className="btn-ghost">
            Turn a good answer into an interview story
          </Link>
        </div>
      </div>
    );
  }

  // --- Start screen ---------------------------------------------------------
  if (!sessionId) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Job"
            htmlFor="mi-job"
            hint="Questions come from this job's description, your resume and the requirements you have no evidence for yet."
          >
            <select
              id="mi-job"
              className="input"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
            >
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
              <option value="">No saved job — just a target role</option>
            </select>
          </Field>
          {!applicationId ? (
            <Field label="Target role" htmlFor="mi-role">
              <input
                id="mi-role"
                className="input"
                value={role}
                maxLength={200}
                placeholder="Product designer"
                onChange={(e) => setRole(e.target.value)}
              />
            </Field>
          ) : null}
        </div>

        <fieldset>
          <legend className="label">Length</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {DEPTH_OPTIONS.map((d) => (
              <label
                key={d.value}
                htmlFor={`mi-depth-${d.value}`}
                className="card flex cursor-pointer items-start gap-2 p-3"
                style={
                  depth === d.value
                    ? { borderColor: "var(--brand-accent)" }
                    : undefined
                }
              >
                <input
                  id={`mi-depth-${d.value}`}
                  type="radio"
                  name="depth"
                  value={d.value}
                  checked={depth === d.value}
                  onChange={() => setDepth(d.value)}
                  className="mt-1 accent-[var(--brand-accent)]"
                />
                <span className="text-sm">
                  <strong className="block">{d.label}</strong>
                  {d.detail}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={busy || (!applicationId && role.trim().length < 2)}
            onClick={() => begin()}
          >
            {busy ? "Preparing your questions…" : "Start"}
          </button>
          <button
            type="button"
            className="text-xs text-[var(--text-muted)] underline"
            disabled={busy || (!applicationId && role.trim().length < 2)}
            onClick={() => openManual("start")}
          >
            Use manual mode (copy prompt → paste answer)
          </button>
        </div>
        {errorBox("start")}
        {manualPanel}
      </div>
    );
  }

  // --- Question / feedback --------------------------------------------------
  if (!current) return null;
  const minutes = Math.floor(elapsed / 60);
  const seconds = String(elapsed % 60).padStart(2, "0");
  const over = elapsed > current.seconds;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
        <span>
          Question {index + 1} of {questions.length} · {current.slotLabel}
        </span>
        <span>Questions by {generatedBy}</span>
      </div>
      <div
        className="h-1.5 rounded-full"
        style={{ background: "var(--surface-muted)" }}
        aria-hidden
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${((index + (feedback ? 1 : 0)) / questions.length) * 100}%`,
            background: "var(--brand-accent)",
          }}
        />
      </div>

      <div className="card p-4">
        <p
          className="text-lg font-medium text-[var(--text)]"
          data-testid="interview-question"
        >
          {current.question}
        </p>

        {!feedback ? (
          <>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span
                className={
                  over
                    ? "text-[var(--color-evidence-partial)]"
                    : "text-[var(--text-muted)]"
                }
                aria-live="polite"
              >
                {minutes}:{seconds} · aim for about{" "}
                {Math.round(current.seconds / 60) || 1} min
                {current.slot === "BEHAVIOURAL"
                  ? " · use Situation, Task, Action, Result"
                  : ""}
              </span>
              {canDictate ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={toggleDictation}
                  aria-pressed={listening}
                >
                  {listening ? "■ Stop dictation" : "🎙 Dictate"}
                </button>
              ) : null}
            </div>
            <label className="sr-only" htmlFor="mi-answer">
              Your answer
            </label>
            <textarea
              id="mi-answer"
              className="input mt-2"
              style={{ minHeight: 170 }}
              value={answer}
              maxLength={8000}
              placeholder="Answer as you would out loud. Say what YOU did, with specifics."
              onChange={(e) => setAnswer(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-primary"
                disabled={busy || answer.trim().length < 20}
                onClick={() => submit()}
              >
                {busy ? "Scoring…" : "Submit answer"}
              </button>
              <button type="button" className="btn-ghost" onClick={next}>
                Skip
              </button>
              <button
                type="button"
                className="text-xs text-[var(--text-muted)] underline"
                disabled={busy || answer.trim().length < 20}
                onClick={() => openManual("answer")}
              >
                Use manual mode (copy prompt → paste answer)
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-4" data-testid="interview-feedback">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ScoreBar label="Relevance" value={feedback.relevance} />
              <ScoreBar label="Specifics" value={feedback.specificity} />
              <ScoreBar label="Evidence" value={feedback.evidence} />
              <ScoreBar label="Structure" value={feedback.structure} />
            </div>
            {feedback.strength ? (
              <p className="text-sm">
                <span className="font-semibold">What worked:</span>{" "}
                {feedback.strength}
              </p>
            ) : null}
            <p className="text-sm">
              <span className="font-semibold">One improvement:</span>{" "}
              {feedback.improvement || "No major issue."}
            </p>
            {feedback.strongerAnswer ? (
              <details className="card-muted p-3" open>
                <summary className="cursor-pointer text-sm font-semibold">
                  A stronger answer, from your own evidence
                </summary>
                <p className="mt-2 whitespace-pre-line text-sm">
                  {feedback.strongerAnswer}
                </p>
              </details>
            ) : null}
            {feedback.followUpQuestion ? (
              <p className="text-sm text-[var(--text-muted)]">
                An interviewer might follow up: &ldquo;
                {feedback.followUpQuestion}&rdquo;
              </p>
            ) : null}
            {feedback.warnings.length || feedback.unsupportedClaims.length ? (
              <Alert tone="warning">
                <ul className="list-disc space-y-0.5 pl-5">
                  {feedback.unsupportedClaims.map((c) => (
                    <li key={c}>Not backed by your evidence: {c}</li>
                  ))}
                  {feedback.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary" onClick={next}>
                {index + 1 < questions.length ? "Next question" : "See summary"}
              </button>
              <span className="text-xs text-[var(--text-muted)]">
                Scored by {feedback.generatedBy}
              </span>
            </div>
          </div>
        )}
      </div>

      {errorBox("answer")}
      {manualPanel}

      <button
        type="button"
        className="btn-ghost"
        onClick={finish}
        disabled={busy}
      >
        End interview and see summary
      </button>
    </div>
  );
}
