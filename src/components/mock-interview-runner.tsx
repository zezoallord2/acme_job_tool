"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  addMockQuestionAction,
  recordAnswerAction,
  startMockSessionAction,
} from "@/app/actions/interview-actions";
import { Alert, Card, Field, SaveIndicator } from "@/components/ui/primitives";
import type { InterviewQuestionsOutput } from "@/ai/schemas";

/**
 * Mock interview. One question at a time.
 *
 * Questions and answers are persisted server-side against the session, so the
 * record survives a refresh and can be reviewed later. Scoring is deliberately
 * NOT faked here: the Answer Coach runs the real INTERVIEW_FEEDBACK workflow in
 * Manual Mode one click away, because a made-up score would be worse than none.
 */
interface SessionQuestion {
  id: string;
  question: string;
}

export function MockInterviewRunner({
  modes,
  targetRole,
  limit,
}: {
  modes: Array<{ value: string; label: string }>;
  targetRole: string;
  limit: number;
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState(modes[0]!.value);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = () => {
    const fd = new FormData();
    fd.set("mode", mode);
    fd.set("questionLimit", String(limit));
    fd.set("targetRole", targetRole);
    startTransition(async () => {
      const result = (await startMockSessionAction({ ok: true }, fd)) as {
        ok: boolean;
        message?: string;
        sessionId?: string;
      };
      setMessage(result.message ?? null);
      if (result.ok && result.sessionId) {
        setSessionId(result.sessionId);
        setError(null);
      }
    });
  };

  /** Persists a question on the session and returns its real id. */
  const addQuestion = async (
    question: string,
    category?: string,
  ): Promise<boolean> => {
    if (!sessionId) return false;
    const fd = new FormData();
    fd.set("sessionId", sessionId);
    fd.set("question", question);
    fd.set("category", category ?? mode);
    const result = (await addMockQuestionAction({ ok: true }, fd)) as {
      ok: boolean;
      message?: string;
      questionId?: string;
    };
    if (result.ok && result.questionId) {
      setQuestions((q) => [...q, { id: result.questionId!, question }]);
      return true;
    }
    setError(result.message ?? "The question could not be saved.");
    return false;
  };

  const submitAnswer = () => {
    if (!answer.trim() || !sessionId) return;
    const question = questions[current];
    if (!question) return;

    setBusy(true);
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sessionId", sessionId);
      fd.set("questionId", question.id);
      fd.set("transcript", answer);
      const result = (await recordAnswerAction({ ok: true }, fd)) as {
        ok: boolean;
        message?: string;
      };
      setBusy(false);
      if (result.ok) {
        setMessage(
          result.message ??
            "Answer recorded against this session. Get it scored with the Answer Coach.",
        );
        setAnswer("");
        setCurrent((c) => c + 1);
      } else {
        setError(result.message ?? "The answer could not be saved.");
      }
    });
  };

  const activeQuestion = questions[current];

  return (
    <div className="space-y-4">
      {message ? <Alert tone="info">{message}</Alert> : null}
      {error ? (
        <Alert tone="error" title="Not saved">
          {error}
        </Alert>
      ) : null}

      {!sessionId ? (
        <div className="space-y-3">
          <Field label="Mode" htmlFor="mi-mode">
            <select
              id="mi-mode"
              className="input"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              {modes.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-sm text-[var(--text-muted)]">
            Target role: {targetRole || "not set"}. Generate questions against a
            sent application in{" "}
            <Link href="/app/interviews/prep" className="underline">
              Interview Prep
            </Link>
            , or add them here.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={start}
              disabled={pending}
            >
              {pending ? "Starting…" : "Start session"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-muted)]">
            Question {Math.min(current + 1, questions.length)} of{" "}
            {questions.length} loaded ({limit} allowed).
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setManualOpen((v) => !v)}
            >
              {manualOpen ? "Hide question prompts" : "Add questions"}
            </button>
            <Link href="/app/interviews/prep" className="btn-ghost">
              Generate from a sent application
            </Link>
          </div>

          {manualOpen ? (
            <ManualQuestionHelper
              mode={mode}
              onAdd={addQuestion}
              busy={pending || busy}
            />
          ) : null}

          {!activeQuestion ? (
            <Alert tone="info" title="No questions loaded yet">
              Add questions above, or generate a batch from a sent application
              in Interview Prep. A session is never limited by AI availability —
              Manual Mode always works.
            </Alert>
          ) : (
            <Card>
              <p className="text-base font-medium text-[var(--text)]">
                {activeQuestion.question}
              </p>
              <div className="mt-3">
                <label className="label" htmlFor="mi-answer">
                  Your answer — say what YOU did, with specifics
                </label>
                <textarea
                  id="mi-answer"
                  className="input"
                  style={{ minHeight: 140 }}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={submitAnswer}
                  disabled={busy || pending || !answer.trim()}
                >
                  {busy ? "Saving…" : "Submit answer"}
                </button>
                <SaveIndicator state={busy ? "saving" : "saved"} />
              </div>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Link href="/app/interviews/prep" className="btn-secondary">
              Score an answer with the Answer Coach
            </Link>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setSessionId(null);
                setQuestions([]);
                setCurrent(0);
                setMessage(null);
                setError(null);
              }}
            >
              End session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Manual Mode for questions typed by hand. The generated batch lives in
 * Interview Prep, where it goes through the versioned INTERVIEW_QUESTION
 * workflow; this box is only for a question you already have in mind.
 */
function ManualQuestionHelper({
  mode,
  onAdd,
  busy,
}: {
  mode: string;
  onAdd: (q: string, category?: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [raw, setRaw] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--text-muted)]">
        One question per line, or paste the JSON from a generated batch.
      </p>
      <textarea
        className="input font-mono"
        style={{ minHeight: 100 }}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={
          "Tell me about a time you had to deal with conflicting data."
        }
        aria-label="Interview questions to add"
      />
      <button
        type="button"
        className="btn-secondary"
        disabled={busy || saving || !raw.trim()}
        onClick={async () => {
          setSaving(true);
          setErrors([]);
          try {
            const trimmed = raw.trim();
            const lines = trimmed.startsWith("{")
              ? (JSON.parse(trimmed) as InterviewQuestionsOutput).questions.map(
                  (q) => q.question,
                )
              : trimmed
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean);

            if (lines.length === 0) {
              setErrors(["No questions found in that input."]);
              return;
            }

            let added = 0;
            for (const q of lines) {
              if (await onAdd(q, mode)) added += 1;
            }
            if (added > 0) setRaw("");
          } catch {
            setErrors(["That was not valid JSON. Paste the JSON object only."]);
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Adding…" : "Save these questions"}
      </button>
      {errors.length > 0 ? (
        <Alert tone="error">{errors.join(" ")}</Alert>
      ) : null}
    </div>
  );
}
