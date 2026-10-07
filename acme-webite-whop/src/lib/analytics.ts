/**
 * Zero-dependency, cookie-free analytics abstraction.
 *
 * Design goals:
 *  - Never block launch: if nothing is configured, every call is a cheap no-op.
 *  - Never set cookies and never send PII.
 *  - Degrade gracefully if a third-party script fails or is blocked.
 */

export const ANALYTICS_EVENTS = [
  'start_free_clicked',
  'complete_clicked',
  'affiliate_clicked',
  'waitlist_submitted',
  'resource_article_opened',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

type PlausibleWindow = Window & {
  plausible?: (event: string, options?: { props?: Record<string, unknown> }) => void;
};

type GtagWindow = Window & {
  gtag?: (command: string, ...args: unknown[]) => void;
};

function isGated(): boolean {
  if (typeof window === 'undefined') return true;
  const w = window as PlausibleWindow & GtagWindow;
  return !w.plausible && !w.gtag;
}

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  if (isGated() || typeof window === 'undefined') return;

  const safeProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      safeProps[key] = value;
    }
  }

  try {
    const w = window as PlausibleWindow & GtagWindow;
    w.plausible?.(event, { props: safeProps });
    w.gtag?.('event', event, safeProps);
  } catch {
    // Analytics must never surface an error to the user.
  }
}
