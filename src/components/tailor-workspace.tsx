"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  saveTailoredAction,
  tailorAction,
  type TailorActionResult,
} from "@/app/actions/tailor-actions";
import type { TailorProposal } from "@/services/tailor-service";
import {
  composeTailored,
  keywordCoverage,
  type TailorChange,
  type TailorDecision,
} from "@/domain/tailoring";
import type { ResumeContent } from "@/services/resume-service";
import { wordDiff } from "@/lib/word-diff";
import {
  ManualModePanel,
  type ManualPromptPayload,
} from "@/components/manual-mode-panel";
import { Alert, Field, ProgressBar } from "@/components/ui/primitives";

/**
 * Resume tailoring on one screen: pick the job, pick the resume, tailor.
 *
 * The result is a list of guarded changes. The tailored resume on the right is
 * recomposed live from the original plus whatever the user accepts or edits,
 * using the same pure function the server uses to save it.
 */

type JobSource = "saved" | "paste" | "link";

export interface TailorWorkspaceProps {
  applications: Array<{ id: string; label: string }>;
  resumes: Array<{ id: string; label: string; isMaster: boolean }>;
  initialApplicationId?: string | null;
}

const SECTION_LABEL: Record<TailorChange["section"], string> = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
};

export function TailorWorkspace({
  applications,
  resumes,
  initialApplicationId,
}: TailorWorkspaceProps) {
  const [busy, startTransition] = useTransition();
  const [source, setSource] = useState<JobSource>(
    applications.length ? "saved" : "paste",
  );
  const [applicationId, setApplicationId] = useState(
    initialApplicationId ?? applications[0]?.id ?? "",
  );
  const [jobText, setJobText] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [resumeId, setResumeId] = useState(
    resumes.find((r) => r.isMaster)?.id ?? resumes[0]?.id ?? "",
  );

  const [error, setError] = useState<string | null>(null);
  const [failurePrompt, setFailurePrompt] =
    useState<ManualPromptPayload | null>(null);
  const [manualPrompt, setManualPrompt] = useState<ManualPromptPayload | null>(
    null,
  );
  const [manualAppId, setManualAppId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<TailorProposal | null>(null);

  const jobReady =
    source === "saved"
      ? Boolean(applicationId)
      : source === "paste"
        ? jobText.trim().length >= 80
        : /^https?:\/\/\S+\.\S+/.test(jobUrl.trim());

  const payload = (extra: Record<string, unknown> = {}) => ({
    applicationId: source === "saved" ? applicationId : undefined,
    jobText: source === "paste" ? jobText : undefined,
    jobUrl: source === "link" ? jobUrl : undefined,
    jobTitle: source !== "saved" ? jobTitle : undefined,
    company: source !== "saved" ? company : undefined,
    resumeId,
    ...extra,
  });

  const handle = (res: TailorActionResult) => {
    if (res.ok) {
      setProposal(res.proposal);
      setManualPrompt(null);
      setFailurePrompt(null);
      setError(null);
      return;
    }
    if (res.code === "MANUAL_REQUIRED" && res.prompt) {
      setManualPrompt(res.prompt as ManualPromptPayload);
      setManualAppId(res.applicationId ?? null);
      setError(null);
      return;
    }
    setError(res.message);
    setFailurePrompt((res.prompt as ManualPromptPayload | undefined) ?? null);
    if (res.applicationId) setManualAppId(res.applicationId);
  };

  const tailor = () =>
    startTransition(async () => {
      setError(null);
      handle(await tailorAction(payload()));
    });

  const openManual = () => {
    if (failurePrompt) {
      setManualPrompt(failurePrompt);
      return;
    }
    startTransition(async () => {
      handle(await tailorAction(payload({ mode: "manual-prompt" })));
    });
  };

  const submitManual = (raw: string) =>
    new Promise<{ ok: boolean; errors: string[]; repaired: boolean }>(
      (resolve) => {
        startTransition(async () => {
          const res = await tailorAction({
            applicationId: manualAppId ?? applicationId,
            resumeId,
            manualInput: raw,
          });
          handle(res);
          resolve({
            ok: res.ok,
            errors: res.ok ? [] : (res.errors ?? [res.message]),
            repaired: false,
          });
        });
      },
    );

  if (proposal) {
    return (
      <TailorReview proposal={proposal} onRestart={() => setProposal(null)} />
    );
  }

  return (
    <div className="space-y-5">
      <ol className="grid gap-4 lg:grid-cols-3" aria-label="Tailoring steps">
        <li className="card p-4">
          <h2 className="section-title">1. Pick the job</h2>
          <div
            className="mt-3 flex flex-wrap gap-1"
            role="tablist"
            aria-label="Where the job comes from"
          >
            {(
              [
                ["saved", "Saved job"],
                ["paste", "Paste text"],
                ["link", "Job link"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={source === value}
                className={source === value ? "btn-primary" : "btn-ghost"}
                onClick={() => setSource(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            {source === "saved" ? (
              <Field label="Saved job" htmlFor="tailor-app">
                <select
                  id="tailor-app"
                  className="input"
                  value={applicationId}
                  onChange={(e) => setApplicationId(e.target.value)}
                >
                  {applications.length === 0 ? (
                    <option value="">No saved jobs yet</option>
                  ) : null}
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {source === "paste" ? (
              <Field
                label="Job description"
                htmlFor="tailor-text"
                hint="Paste the whole posting (at least 80 characters)."
              >
                <textarea
                  id="tailor-text"
                  className="input"
                  style={{ minHeight: 160 }}
                  value={jobText}
                  maxLength={30000}
                  onChange={(e) => setJobText(e.target.value)}
                />
              </Field>
            ) : null}
            {source === "link" ? (
              <Field
                label="Public job link"
                htmlFor="tailor-url"
                hint="LinkedIn and Indeed block automated reading — paste the text for those."
              >
                <input
                  id="tailor-url"
                  className="input"
                  type="url"
                  value={jobUrl}
                  placeholder="https://boards.greenhouse.io/…"
                  onChange={(e) => setJobUrl(e.target.value)}
                />
              </Field>
            ) : null}
            {source !== "saved" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Job title (optional)" htmlFor="tailor-title">
                  <input
                    id="tailor-title"
                    className="input"
                    value={jobTitle}
                    maxLength={200}
                    onChange={(e) => setJobTitle(e.target.value)}
                  />
                </Field>
                <Field label="Company (optional)" htmlFor="tailor-company">
                  <input
                    id="tailor-company"
                    className="input"
                    value={company}
                    maxLength={200}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </li>

        <li className="card p-4">
          <h2 className="section-title">2. Pick the resume</h2>
          <div className="mt-3">
            <Field
              label="Resume"
              htmlFor="tailor-resume"
              hint="Your master resume is the default. It is never modified."
            >
              <select
                id="tailor-resume"
                className="input"
                value={resumeId}
                onChange={(e) => setResumeId(e.target.value)}
              >
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </li>

        <li className="card p-4">
          <h2 className="section-title">3. Tailor</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            You get a full tailored resume, what changed and why, and a keyword
            match score. Nothing is invented: anything your resume and evidence
            don&apos;t support comes back as a question instead.
          </p>
          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="btn-primary w-full"
              onClick={tailor}
              disabled={busy || !jobReady || !resumeId}
            >
              {busy ? "Tailoring…" : "Tailor my resume"}
            </button>
            <button
              type="button"
              className="block text-xs text-[var(--text-muted)] underline"
              onClick={openManual}
              disabled={busy || !jobReady || !resumeId}
            >
              Use manual mode (copy prompt → paste answer)
            </button>
          </div>
        </li>
      </ol>

      {error ? (
        <Alert
          tone="error"
          title="The resume was not tailored"
          action={
            <button
              type="button"
              className="btn-secondary"
              onClick={openManual}
            >
              Use manual mode
            </button>
          }
        >
          {error}
        </Alert>
      ) : null}

      {manualPrompt ? (
        <ManualModePanel
          prompt={manualPrompt}
          busy={busy}
          onValidate={submitManual}
          actionLabel="Building the tailored resume"
        />
      ) : null}
    </div>
  );
}

function Diff({ before, after }: { before: string | null; after: string }) {
  if (!before) {
    return (
      <p className="text-sm">
        <ins className="diff-added">{after}</ins>
      </p>
    );
  }
  return (
    <p className="text-sm leading-relaxed">
      {wordDiff(before, after).map((part, i) =>
        part.kind === "same" ? (
          <span key={i}>{part.text}</span>
        ) : part.kind === "added" ? (
          <ins key={i} className="diff-added">
            {part.text}
          </ins>
        ) : (
          <del key={i} className="diff-removed">
            {part.text}
          </del>
        ),
      )}
    </p>
  );
}

function ResumeView({ content }: { content: ResumeContent }) {
  return (
    <div className="space-y-3 text-sm">
      {content.summary ? (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Summary
          </h4>
          <p className="mt-1">{content.summary}</p>
        </section>
      ) : null}
      {content.skills.length ? (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Skills
          </h4>
          <p className="mt-1">{content.skills.join(" · ")}</p>
        </section>
      ) : null}
      {content.experiences.length ? (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Experience
          </h4>
          {content.experiences.map((e, i) => (
            <div key={i} className="mt-2">
              <p className="font-medium">
                {e.title} — {e.company}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {[e.startDate, e.endDate].filter(Boolean).join(" – ")}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {e.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
      {content.education.length ? (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Education
          </h4>
          {content.education.map((e, i) => (
            <p key={i} className="mt-1">
              {[e.degree, e.field, e.institution].filter(Boolean).join(", ")}
            </p>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function TailorReview({
  proposal,
  onRestart,
}: {
  proposal: TailorProposal;
  onRestart: () => void;
}) {
  const [decisions, setDecisions] = useState<Record<string, TailorDecision>>(
    () =>
      Object.fromEntries(
        proposal.changes.map((c) => [c.id, { accepted: false }]),
      ),
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState<{
    resumeId: string;
    label: string;
  } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const tailored = useMemo(
    () => composeTailored(proposal.original, proposal.changes, decisions),
    [proposal, decisions],
  );
  const after = useMemo(
    () => keywordCoverage(tailored, proposal.keywords),
    [tailored, proposal.keywords],
  );

  const setDecision = (id: string, patch: Partial<TailorDecision>) =>
    setDecisions((prev) => ({
      ...prev,
      [id]: { ...prev[id], accepted: prev[id]?.accepted ?? false, ...patch },
    }));

  const save = () =>
    startSaving(async () => {
      setSaveError(null);
      const res = await saveTailoredAction({
        applicationId: proposal.applicationId,
        sourceResumeId: proposal.sourceResumeId,
        interactionId: proposal.interactionId,
        promptVersion: proposal.promptVersion,
        changes: proposal.changes,
        decisions,
      });
      if (res.ok) setSaved({ resumeId: res.resumeId, label: res.label });
      else setSaveError(res.message);
    });

  const accepted = proposal.changes.filter(
    (c) => decisions[c.id]?.accepted,
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">
            Tailored for {proposal.jobTitle}
            {proposal.company ? ` at ${proposal.company}` : ""}
          </h2>
          <p
            className="text-xs text-[var(--text-muted)]"
            data-testid="generated-by"
          >
            Generated by {proposal.generatedBy} · from{" "}
            {proposal.sourceResumeLabel}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={onRestart}>
          Start over
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4 md:col-span-1">
          <h3 className="text-sm font-semibold">Keyword match</h3>
          <div className="mt-3 space-y-3">
            <ProgressBar value={proposal.before.score / 100} label="Before" />
            <ProgressBar value={after.score / 100} label="After" />
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Share of this job&apos;s keywords your resume contains. A keyword
            count, not a hiring prediction.
          </p>
          {after.missing.length ? (
            <div className="mt-3">
              <p className="text-xs font-semibold">Still missing</p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {after.missing.map((k) => (
                  <li key={k} className="badge badge-missing">
                    {k}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="card p-4 md:col-span-2">
          <h3 className="text-sm font-semibold">What changed and why</h3>
          {proposal.changes.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No changes were suggested — your resume already fits this job
              about as well as your evidence allows.
            </p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {proposal.changes.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <span className="font-medium">
                    {SECTION_LABEL[c.section]}:
                  </span>{" "}
                  {c.why}
                </li>
              ))}
            </ul>
          )}
          {proposal.gaps.length ? (
            <div className="mt-4">
              <h4 className="text-sm font-semibold">
                Questions for you (not added, because there is no evidence yet)
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {proposal.gaps.map((g) => (
                  <li key={g.requirement}>{g.question}</li>
                ))}
              </ul>
              <Link
                href="/app/evidence/new"
                className="mt-2 inline-block text-xs underline"
              >
                Add the answer as evidence, then tailor again
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {proposal.warnings.length ? (
        <Alert tone="warning" title="Check before you use it">
          <ul className="list-disc space-y-0.5 pl-5">
            {proposal.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <section aria-labelledby="changes-heading">
        <h3 id="changes-heading" className="section-title">
          Review each change ({accepted} of {proposal.changes.length} accepted)
        </h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Accept a change to include it in the preview below. When you finish
          reviewing, choose Save tailored resume to create your new version.
        </p>
        <ul className="mt-3 space-y-3">
          {proposal.changes.map((c) => {
            const d = decisions[c.id];
            const edited = d?.text?.trim();
            const canAccept = !c.blocked || Boolean(edited);
            return (
              <li
                key={c.id}
                className="card p-4"
                data-testid="tailor-change"
                style={
                  c.blocked
                    ? { borderColor: "var(--color-evidence-missing)" }
                    : undefined
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="badge badge-unknown">
                    {SECTION_LABEL[c.section]}
                    {c.section === "experience" &&
                    c.experienceIndex !== undefined
                      ? ` · ${proposal.original.experiences[c.experienceIndex]?.company ?? ""}`
                      : ""}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={d?.accepted ? "btn-primary" : "btn-secondary"}
                      aria-pressed={Boolean(d?.accepted)}
                      disabled={!canAccept}
                      onClick={() => {
                        setDecision(c.id, { accepted: true });
                        setEditing((cur) => (cur === c.id ? null : cur));
                      }}
                    >
                      {d?.accepted ? "Accepted" : "Accept"}
                    </button>
                    <button
                      type="button"
                      className={!d?.accepted ? "btn-primary" : "btn-secondary"}
                      aria-pressed={!d?.accepted}
                      onClick={() => setDecision(c.id, { accepted: false })}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() =>
                        setEditing((cur) => (cur === c.id ? null : c.id))
                      }
                    >
                      {editing === c.id ? "Done" : "Edit"}
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  {edited ? (
                    <Diff before={c.before} after={edited} />
                  ) : (
                    <Diff before={c.before} after={c.after} />
                  )}
                </div>
                {editing === c.id ? (
                  <textarea
                    className="input mt-2"
                    style={{ minHeight: 90 }}
                    aria-label="Edit this change"
                    value={d?.text ?? c.after}
                    onChange={(e) =>
                      setDecision(c.id, {
                        text: e.target.value,
                        accepted: true,
                      })
                    }
                  />
                ) : null}
                <p className="mt-2 text-xs text-[var(--text-muted)]">{c.why}</p>
                {c.blocked && !edited ? (
                  <p className="mt-1 text-xs font-medium text-[var(--color-evidence-missing)]">
                    Held back: {c.blocked} Edit it in your own words to use it.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="side-by-side"
        className="grid gap-4 lg:grid-cols-2"
      >
        <h3 id="side-by-side" className="sr-only">
          Original and tailored resume side by side
        </h3>
        <div className="card p-4">
          <h4 className="text-sm font-semibold">Original</h4>
          <div className="mt-3">
            <ResumeView content={proposal.original} />
          </div>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-semibold">Tailored</h4>
          <div className="mt-3">
            <ResumeView content={tailored} />
          </div>
        </div>
      </section>

      {saveError ? <Alert tone="error">{saveError}</Alert> : null}
      {saved ? (
        <Alert tone="success" title="Saved as a new version">
          <p>
            &ldquo;{saved.label}&rdquo; is linked to this job. Your original
            resume is unchanged.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              className="btn-primary"
              href={`/api/resumes/${saved.resumeId}/pdf`}
            >
              Download PDF
            </a>
            <a
              className="btn-secondary"
              href={`/api/resumes/${saved.resumeId}/docx`}
            >
              Download DOCX
            </a>
            <Link className="btn-ghost" href={`/app/resumes/${saved.resumeId}`}>
              Open in editor
            </Link>
          </div>
        </Alert>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save tailored resume"}
          </button>
        </div>
      )}
    </div>
  );
}
