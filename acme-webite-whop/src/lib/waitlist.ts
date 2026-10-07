/**
 * Early-access waitlist storage for the Cloudflare Workers runtime.
 *
 * Unlike the Next.js build, this runtime has no writable filesystem, so the
 * zero-cost JSONL store is unavailable. Only two modes exist here:
 *
 *   webhook  - POSTs the entry to WAITLIST_WEBHOOK_URL, a runtime secret set
 *              with `whop apps secrets add`. Works with Baselayer, Formspree,
 *              a Sheets proxy, or a small function of your own.
 *   disabled - rejects cleanly; the UI renders a "not open at the moment" panel.
 *
 * Only the email address, the signup source and a coarse referrer are ever sent.
 */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export interface WaitlistEntry {
  email: string;
  source: string;
  referrer: string | null;
  createdAt: string;
}

export interface WaitlistResult {
  ok: boolean;
  duplicate?: boolean;
  error?: string;
}

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const email = normaliseEmail(value);
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

/** Runtime secret, readable in the Workers bundle only because of nodejs_compat. */
function webhookUrl(): string | null {
  if (typeof process === 'undefined' || !process.env) return null;
  const value = process.env.WAITLIST_WEBHOOK_URL?.trim();
  return value ? value : null;
}

export function waitlistMode(): 'webhook' | 'disabled' {
  return webhookUrl() ? 'webhook' : 'disabled';
}

export async function submitWaitlist(entry: WaitlistEntry): Promise<WaitlistResult> {
  const url = webhookUrl();
  if (!url) {
    return {
      ok: false,
      error: 'The early-access list is not open at the moment. Please check back later.',
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return { ok: false, error: 'We could not save your email right now. Please try again.' };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'We could not reach the early-access list. Please try again in a moment.',
    };
  }
}
