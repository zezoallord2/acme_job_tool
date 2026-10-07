"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/primitives";

/**
 * Tells the user the truth about AI availability.
 *
 * Previously a broken or missing API key degraded silently to Manual Mode, which
 * looked exactly like "the AI features don't work". This states what is actually
 * configured and the single next step that fixes it.
 */
export function AiStatusBanner({
  available,
  providerLabel,
  reason,
  fix,
}: {
  available: boolean;
  providerLabel: string;
  reason: string;
  fix: string;
}) {
  if (available) {
    return (
      <Alert tone="success" title={`AI is on — ${providerLabel}`}>
        AI assistance is active. If a result looks generic, the provider may be
        refusing the request rather than the feature being unavailable.
      </Alert>
    );
  }

  return (
    <Alert tone="warning" title="AI is not connected">
      <p>{reason}</p>
      <p className="mt-1">{fix}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link href="/app/settings" className="btn-secondary">
          Connect an AI key
        </Link>
      </div>
    </Alert>
  );
}
