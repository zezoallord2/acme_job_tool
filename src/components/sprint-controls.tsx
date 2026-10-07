"use client";

import { useActionState } from "react";
import {
  startSprintAction,
  updateSprintTaskAction,
} from "@/app/actions/sprint-actions";
import { IDLE } from "@/app/actions/state";
import { Alert } from "@/components/ui/primitives";

export function StartSprintButton() {
  const [state, action, pending] = useActionState(startSprintAction, IDLE);
  return (
    <form action={action} className="space-y-3">
      {state.message ? (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      ) : null}
      <button className="btn-primary" disabled={pending} type="submit">
        {pending ? "Building your sprint…" : "Start my 14-day sprint"}
      </button>
    </form>
  );
}

export function SprintTaskToggle({
  taskId,
  completed,
}: {
  taskId: string;
  completed: boolean;
}) {
  const [state, action, pending] = useActionState(updateSprintTaskAction, IDLE);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="complete" value={String(!completed)} />
      <button
        type="submit"
        className={completed ? "btn-ghost" : "btn-secondary"}
        disabled={pending}
      >
        {pending ? "Saving…" : completed ? "Reopen" : "Mark complete"}
      </button>
      {state.ok === false && state.message ? (
        <span className="error-text max-w-48 text-right">{state.message}</span>
      ) : null}
    </form>
  );
}
