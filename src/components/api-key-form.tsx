"use client";

import { useActionState } from "react";
import {
  saveApiKeyAction,
  deleteApiKeyAction,
} from "@/app/actions/app-actions";
import { IDLE, type ActionState } from "@/app/actions/state";
import { Alert, Field } from "@/components/ui/primitives";

export function ApiKeyForm({ existing }: { existing: string[] }) {
  const [saveState, saveAction, saving] = useActionState<ActionState, FormData>(
    saveApiKeyAction as never,
    IDLE,
  );
  const [deleteState, deleteAction, deleting] = useActionState<
    ActionState,
    FormData
  >(deleteApiKeyAction as never, IDLE);

  return (
    <div className="mt-4 space-y-4">
      <form
        action={saveAction}
        className="grid gap-3 sm:grid-cols-3"
        noValidate
      >
        {saveState.message ? (
          <Alert tone={saveState.ok ? "success" : "error"}>
            {saveState.message}
          </Alert>
        ) : null}
        <Field label="Provider" htmlFor="k-provider">
          <select
            id="k-provider"
            name="provider"
            className="input"
            defaultValue="OPENAI"
          >
            <option value="OPENAI">OpenAI</option>
            <option value="ANTHROPIC">Anthropic</option>
            <option value="GEMINI">Google Gemini</option>
            <option value="OPENROUTER">OpenRouter</option>
          </select>
        </Field>
        <Field label="Label" htmlFor="k-label" hint="Optional.">
          <input
            id="k-label"
            name="label"
            className="input"
            maxLength={60}
            placeholder="Personal"
          />
        </Field>
        <Field
          label="API key"
          htmlFor="k-key"
          hint="Stored encrypted. Usage is billed to your provider account."
        >
          <input
            id="k-key"
            name="key"
            type="password"
            className="input"
            autoComplete="off"
            required
            minLength={20}
          />
        </Field>
        <div className="sm:col-span-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save key"}
          </button>
        </div>
      </form>

      {existing.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Remove a key
          </h3>
          {deleteState.message ? (
            <Alert tone={deleteState.ok ? "success" : "error"}>
              {deleteState.message}
            </Alert>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {existing.map((id) => (
              <form key={id} action={deleteAction}>
                <input type="hidden" name="keyId" value={id} />
                <button
                  type="submit"
                  className="btn-danger"
                  disabled={deleting}
                >
                  Remove key
                </button>
              </form>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
