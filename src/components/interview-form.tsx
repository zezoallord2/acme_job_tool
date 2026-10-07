"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInterviewAction } from "@/app/actions/interview-actions";
import { Alert, Field } from "@/components/ui/primitives";

export function InterviewForm({
  applications,
}: {
  applications: Array<{
    id: string;
    job: { company: string | null; title: string | null } | null;
  }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const submit = (fd: FormData) => {
    startTransition(async () => {
      const result = await createInterviewAction({ ok: true }, fd);
      setMessage({ ok: result.ok, text: result.message ?? "" });
      if (result.ok) router.refresh();
    });
  };

  return (
    <form
      action={submit}
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        submit(fd);
      }}
    >
      {message ? (
        <Alert tone={message.ok ? "success" : "error"}>{message.text}</Alert>
      ) : null}

      <Field label="Company" htmlFor="i-company" required>
        <input
          id="i-company"
          name="company"
          className="input"
          required
          maxLength={200}
        />
      </Field>
      <Field label="Role" htmlFor="i-role" required>
        <input
          id="i-role"
          name="role"
          className="input"
          required
          maxLength={200}
        />
      </Field>
      <Field label="Date and time" htmlFor="i-when">
        <input
          id="i-when"
          name="scheduledAt"
          type="datetime-local"
          className="input"
        />
      </Field>
      <Field label="Stage" htmlFor="i-stage">
        <select
          id="i-stage"
          name="stage"
          className="input"
          defaultValue="FIRST"
        >
          <option value="SCREENING">Screening</option>
          <option value="FIRST">First</option>
          <option value="SECOND">Second</option>
          <option value="FINAL">Final</option>
          <option value="PANEL">Panel</option>
          <option value="UNKNOWN">Unknown</option>
        </select>
      </Field>
      <Field label="Format" htmlFor="i-format">
        <select
          id="i-format"
          name="format"
          className="input"
          defaultValue="VIDEO"
        >
          <option value="PHONE">Phone</option>
          <option value="VIDEO">Video</option>
          <option value="ONSITE">On-site</option>
          <option value="UNKNOWN">Unknown</option>
        </select>
      </Field>
      <Field label="Interviewer" htmlFor="i-interviewer" hint="Optional.">
        <input
          id="i-interviewer"
          name="interviewerName"
          className="input"
          maxLength={200}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field
          label="Link to an application"
          htmlFor="i-app"
          hint="Optional but recommended: it unlocks the sent-resume view."
        >
          <select
            id="i-app"
            name="applicationId"
            className="input"
            defaultValue=""
          >
            <option value="">Not linked</option>
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.job?.company ?? "Company"} — {a.job?.title ?? "Role"}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Add interview"}
        </button>
      </div>
    </form>
  );
}
