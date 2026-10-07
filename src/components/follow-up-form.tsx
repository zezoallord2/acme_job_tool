"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createFollowUpAction,
  markFollowUpSentAction,
} from "@/app/actions/interview-actions";
import { Alert, Field } from "@/components/ui/primitives";

type Target = {
  id: string;
  label: string;
};

export function FollowUpForm({
  applications,
  interviews,
}: {
  applications: Target[];
  interviews: Target[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const submit = (fd: FormData) => {
    startTransition(async () => {
      const result = await createFollowUpAction({ ok: true }, fd);
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
        submit(new FormData(e.currentTarget));
      }}
    >
      {message ? (
        <Alert tone={message.ok ? "success" : "error"}>{message.text}</Alert>
      ) : null}

      <Field label="Type" htmlFor="fu-type">
        <select
          id="fu-type"
          name="type"
          className="input"
          defaultValue="THANK_YOU"
        >
          <option value="THANK_YOU">Thank-you note</option>
          <option value="FOLLOW_UP">Follow-up</option>
          <option value="SECOND_FOLLOW_UP">Second follow-up</option>
          <option value="WITHDRAWAL">Withdrawal</option>
        </select>
      </Field>

      <Field label="Send on" htmlFor="fu-when" hint="Optional.">
        <input
          id="fu-when"
          name="scheduledFor"
          type="datetime-local"
          className="input"
        />
      </Field>

      <div className="sm:col-span-2">
        <Field label="Subject" htmlFor="fu-subject" hint="Optional.">
          <input
            id="fu-subject"
            name="subject"
            className="input"
            maxLength={200}
          />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field
          label="Message"
          htmlFor="fu-body"
          required
          hint="Write it yourself, or paste a response from any assistant. Reference only what actually happened."
        >
          <textarea
            id="fu-body"
            name="body"
            className="input min-h-[140px]"
            required
            minLength={10}
            maxLength={8000}
          />
        </Field>
      </div>

      <Field label="Link to an application" htmlFor="fu-app">
        <select
          id="fu-app"
          name="applicationId"
          className="input"
          defaultValue=""
        >
          <option value="">Not linked</option>
          {applications.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Link to an interview" htmlFor="fu-int">
        <select
          id="fu-int"
          name="interviewId"
          className="input"
          defaultValue=""
        >
          <option value="">Not linked</option>
          {interviews.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save follow-up"}
        </button>
      </div>
    </form>
  );
}

export function MarkFollowUpSentButton({ followUpId }: { followUpId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await markFollowUpSentAction({ ok: true }, fd);
          router.refresh();
        })
      }
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await markFollowUpSentAction(
            { ok: true },
            new FormData(e.currentTarget),
          );
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="followUpId" value={followUpId} />
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Saving…" : "Mark as sent"}
      </button>
    </form>
  );
}
