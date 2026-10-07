"use client";

import { useState } from "react";
import { Alert, Card, CardHeader } from "@/components/ui/primitives";

/**
 * Consumes the signed billing-link token the payment platform appends to the
 * return URL. The settings page renders this only when `?token=` is present.
 *
 * State changes go through POST /api/billing/link, never GET, so a leaked
 * token URL alone cannot link an account. The token is stripped from the
 * address bar on success so it cannot leak through copy-paste or screenshots.
 */
export function BillingLinkPanel({ token }: { token: string }) {
  const [status, setStatus] = useState<{
    kind: "idle" | "busy" | "done" | "error";
    message: string;
  }>({ kind: "idle", message: "" });

  async function linkPurchase() {
    setStatus({ kind: "busy", message: "" });
    try {
      const res = await fetch(
        `/api/billing/link?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;

      if (res.ok && body?.ok) {
        setStatus({
          kind: "done",
          message: body.message ?? "Your purchase is now linked.",
        });
        // Do not leave the token sitting in the address bar afterwards.
        window.history.replaceState(null, "", window.location.pathname);
      } else {
        setStatus({
          kind: "error",
          message:
            body?.error ??
            "That purchase link could not be redeemed. Return to your payment provider and try again.",
        });
      }
    } catch {
      setStatus({
        kind: "error",
        message: "Network error while linking your purchase. Try again.",
      });
    }
  }

  if (status.kind === "done") {
    return (
      <Card>
        <Alert tone="success">{status.message}</Alert>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Link your purchase"
        description="A payment provider returned you with a signed purchase token. Confirm the account it should attach to."
      />
      {status.kind === "error" ? (
        <Alert tone="error">{status.message}</Alert>
      ) : null}
      <button
        type="button"
        className="btn-primary"
        onClick={linkPurchase}
        disabled={status.kind === "busy"}
      >
        {status.kind === "busy"
          ? "Linking…"
          : "Link this purchase to my account"}
      </button>
    </Card>
  );
}
