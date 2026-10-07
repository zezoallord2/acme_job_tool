import { createServerFn } from '@tanstack/react-start';
import { isValidEmail, normaliseEmail, submitWaitlist, waitlistMode } from '@/lib/waitlist';

/**
 * Waitlist submission as a TanStack server function (RPC), which is how this
 * version of TanStack Start exposes server-only work — there is no
 * `/api/*` REST routing.
 *
 * The function is server-only: the webhook URL never reaches the browser, and
 * validation happens here rather than trusting the client.
 */
export const joinWaitlist = createServerFn({ method: 'POST' }).validator(
  (input: { email: string; source?: string; referrer?: string | null }) => input
).handler(async ({ data }) => {
  if (typeof data?.email !== 'string' || !isValidEmail(data.email)) {
    return { ok: false as const, error: 'Please enter a valid email address.', status: 400 };
  }

  if (waitlistMode() === 'disabled') {
    return {
      ok: false as const,
      error: 'The early-access list is not open at the moment.',
      status: 503,
    };
  }

  const result = await submitWaitlist({
    email: normaliseEmail(data.email),
    source: typeof data.source === 'string' ? data.source.slice(0, 80) : 'website',
    referrer: typeof data.referrer === 'string' ? data.referrer.slice(0, 200) : null,
    createdAt: new Date().toISOString(),
  });

  if (!result.ok) {
    return {
      ok: false as const,
      error: result.error ?? 'Something went wrong. Please try again.',
      status: 500,
    };
  }

  return {
    ok: true as const,
    duplicate: result.duplicate ?? false,
  };
});
