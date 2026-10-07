"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { rebuildMatrixAction } from "@/app/actions/job-actions";
import { IDLE } from "@/app/actions/state";
import type { ActionState } from "@/app/actions/state";
import { Alert } from "@/components/ui/primitives";

export function RebuildMatrixButton({
  jobId,
  label = "Rebuild matrix",
}: {
  jobId: string;
  label?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    rebuildMatrixAction,
    IDLE,
  );
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open ? (
        <form action={formAction} className="mt-2 space-y-2">
          <input type="hidden" name="jobId" value={jobId} />
          {state.message ? (
            <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-primary"
              disabled={pending}
              onClick={() => router.refresh()}
            >
              {pending ? "Rebuilding…" : "Confirm rebuild"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}
