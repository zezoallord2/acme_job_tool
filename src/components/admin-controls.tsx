"use client";

import { useActionState } from "react";
import {
  requeueDeadJobAction,
  adminGrantEntitlementAction,
  adminRevokeEntitlementAction,
} from "@/app/actions/app-actions";
import { IDLE } from "@/app/actions/state";
import type { ActionState } from "@/app/actions/state";

export function AdminControls({
  jobId,
  userId,
  email,
}: {
  jobId?: string;
  userId?: string;
  email?: string;
}) {
  const [requeue, requeueAction, requeuing] = useActionState<
    ActionState,
    FormData
  >(requeueDeadJobAction, IDLE);
  const [grant, grantAction, granting] = useActionState<ActionState, FormData>(
    adminGrantEntitlementAction,
    IDLE,
  );
  const [revoke, revokeAction, revoking] = useActionState<
    ActionState,
    FormData
  >(adminRevokeEntitlementAction, IDLE);

  if (jobId) {
    return (
      <form action={requeueAction} className="flex items-center gap-2">
        <input type="hidden" name="jobId" value={jobId} />
        <button type="submit" className="btn-ghost" disabled={requeuing}>
          Requeue
        </button>
        <span className="text-xs text-[var(--text-muted)]">
          {requeue.message ?? ""}
        </span>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-1.5">
        <form action={grantAction} className="flex items-center gap-1">
          <input type="hidden" name="email" value={email ?? ""} />
          <button type="submit" className="btn-ghost" disabled={granting}>
            Grant Complete
          </button>
        </form>
        <form action={revokeAction}>
          <input type="hidden" name="userId" value={userId ?? ""} />
          <button type="submit" className="btn-ghost" disabled={revoking}>
            Revoke
          </button>
        </form>
      </div>
      {grant.message ? (
        <span className="text-xs text-[var(--text-muted)]">
          {grant.message}
        </span>
      ) : null}
      {revoke.message ? (
        <span className="text-xs text-[var(--text-muted)]">
          {revoke.message}
        </span>
      ) : null}
      <span className="hidden">{IDLE.ok}</span>
    </div>
  );
}
