"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createJobAction,
  uploadJobDescriptionAction,
} from "@/app/actions/app-actions";
import { IDLE } from "@/app/actions/state";
import type { ActionState } from "@/app/actions/state";
import { Field, Alert } from "@/components/ui/primitives";

export function NewJobForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ActionState & { jobId?: string },
    FormData
  >(createJobAction, IDLE);
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploadPending, startUpload] = useTransition();
  const [upload, setUpload] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const sendFile = (file: File) => {
    startUpload(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const company = document.getElementById(
        "company",
      ) as HTMLInputElement | null;
      const title = document.getElementById("title") as HTMLInputElement | null;
      fd.set("company", company?.value ?? "");
      fd.set("title", title?.value ?? "");
      const result = await uploadJobDescriptionAction(null, fd);
      setUpload({ ok: result.ok, message: result.message ?? "" });
      if (result.ok) router.refresh();
    });
  };

  if (state.ok && state.jobId) {
    // Nothing was submitted twice: this is a post-save confirmation with a clear next step.
    return (
      <Alert
        tone="success"
        title="Job saved"
        action={
          <a href={`/app/jobs/${state.jobId}`} className="btn-primary">
            Analyze now
          </a>
        }
      >
        Next: run the Job Check. You will get the requirements, then the match
        breakdown.
        <div className="mt-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.refresh()}
          >
            Add another job
          </button>
        </div>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message && !state.ok ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" htmlFor="company">
          <input
            id="company"
            name="company"
            className="input"
            maxLength={200}
            placeholder="Acme Corp"
          />
        </Field>
        <Field label="Role" htmlFor="title">
          <input
            id="title"
            name="title"
            className="input"
            maxLength={200}
            placeholder="Data Analyst"
          />
        </Field>
        <Field label="Location" htmlFor="location">
          <input
            id="location"
            name="location"
            className="input"
            maxLength={200}
            placeholder="Remote (UK)"
          />
        </Field>
        <Field label="Deadline" htmlFor="deadlineAt" hint="Optional.">
          <input
            id="deadlineAt"
            name="deadlineAt"
            type="date"
            className="input"
          />
        </Field>
        <Field
          label="Source"
          htmlFor="sourceName"
          hint="Where you found it. Optional."
        >
          <input
            id="sourceName"
            name="sourceName"
            className="input"
            maxLength={200}
            placeholder="Company careers page"
          />
        </Field>
        <Field
          label="Contact email"
          htmlFor="contactEmail"
          hint="Optional. Used on the Application Details."
        >
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            className="input"
            maxLength={200}
          />
        </Field>
      </div>

      <Field
        label="Job description"
        htmlFor="description"
        required
        hint={`Paste the full description including requirements and responsibilities. ${description.length} characters.`}
      >
        <textarea
          id="description"
          name="description"
          className="input font-mono"
          style={{ minHeight: 260 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={80}
          placeholder={
            "Data Analyst\n\nAbout the role…\n\nRequirements:\n- 2+ years in a data or reporting role\n- Advanced Excel…\n- SQL…"
          }
        />
      </Field>

      <details className="card-muted p-3">
        <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">
          Upload a file instead (TXT, PDF or DOCX)
        </summary>
        <p className="hint mt-2">
          The text is extracted on this machine by the background worker — no
          paid document service and no OCR. A scanned PDF with no embedded text
          layer cannot be read, so paste that one instead.
        </p>
        <input
          ref={fileRef}
          type="file"
          className="input mt-2"
          accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          aria-label="Upload job description file"
          disabled={uploadPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) sendFile(file);
          }}
        />
        {upload ? (
          <div className="mt-2">
            <Alert tone={upload.ok ? "success" : "error"}>
              {upload.message}
            </Alert>
          </div>
        ) : null}
        <p className="hint mt-1">
          {uploadPending
            ? "Uploading and queuing text extraction…"
            : "Choose a file to upload it. Pasting is still the fastest route."}
        </p>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="btn-primary"
          disabled={pending || description.trim().length < 80}
        >
          {pending ? "Saving…" : "Save and analyze"}
        </button>
        <span className="text-xs text-[var(--text-muted)]">
          {description.trim().length < 80
            ? "Paste at least 80 characters to continue."
            : "Ready to analyse."}
        </span>
      </div>
    </form>
  );
}
