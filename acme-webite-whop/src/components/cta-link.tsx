'use client';

import * as React from 'react';
import Link from '@/components/link';
import { ArrowRight, CircleAlert, ExternalLink, Info } from 'lucide-react';
import { buttonVariants, type ButtonProps } from '@/components/ui/button';
import { outbound, type LinkState } from '@/lib/config';
import { track, type AnalyticsEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';

export type CtaIntent = 'free' | 'complete' | 'affiliate';

const intentMap: Record<
  CtaIntent,
  { state: LinkState; event: AnalyticsEvent; envVar: string; product: string }
> = {
  free: {
    state: outbound.freeWhop,
    event: 'start_free_clicked',
    envVar: 'NEXT_PUBLIC_FREE_WHOP_URL',
    product: 'free-starter-guide',
  },
  complete: {
    state: outbound.paidWhop,
    event: 'complete_clicked',
    envVar: 'NEXT_PUBLIC_PAID_WHOP_URL',
    product: 'complete-edition',
  },
  affiliate: {
    state: outbound.affiliate,
    event: 'affiliate_clicked',
    envVar: 'NEXT_PUBLIC_AFFILIATE_URL',
    product: 'affiliate-programme',
  },
};

function classes(variant: ButtonProps['variant'], size: ButtonProps['size'], className?: string) {
  return cn(buttonVariants({ variant, size }), className);
}

interface CtaLinkProps {
  /** Which outbound destination this CTA points at. */
  intent: CtaIntent;
  /** Explicit destination; overrides the config lookup. */
  href?: string;
  /** Internal route — renders client-side navigation. */
  to?: string;
  children: React.ReactNode;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  showArrow?: boolean;
  arrowIcon?: 'arrow' | 'external';
  className?: string;
  id?: string;
  /**
   * Hide the explanatory "link not published yet" paragraph. Used in tight
   * chrome such as the sticky header, where the note would squeeze the
   * navigation; the icon plus the tooltip still make the state explicit, and
   * the note is always shown on the product pages themselves.
   */
  compact?: boolean;
  /** Forwarded to the rendered element in every state, including the
   *  not-configured state, so analytics and QA can always find the CTA. */
  'aria-label'?: string;
  'data-testid'?: string;
}

/**
 * The single conversion component for every product CTA on the site.
 *
 * Behaviour contract:
 *  - Configured outbound link -> real <a target="_blank" rel="noopener noreferrer"> + analytics.
 *  - Internal route           -> next/link client navigation.
 *  - Missing env variable     -> a clearly-labelled, non-navigating element.
 *    It never renders a dead link and it never silently disappears.
 */
export function CtaLink({
  intent,
  href,
  to,
  children,
  variant = 'accent',
  size = 'lg',
  showArrow = true,
  arrowIcon = 'external',
  className,
  id,
  compact = false,
  ...aria
}: CtaLinkProps) {
  const config = intentMap[intent];
  const destination = href ?? to ?? config.state.href;
  const label = typeof children === 'string' ? children : config.product;

  if (!destination) {
    // The caller's className goes on the wrapper, not the button: it carries
    // layout intent (width, responsive visibility) that must survive this
    // state. Applying it only to the button would leak the "not configured"
    // note into viewports where the CTA is meant to be hidden.
    return (
      <span
        className={cn('flex max-w-full min-w-0 flex-col items-stretch gap-2', className)}
        title={compact ? `${config.envVar} is not set in this environment yet` : undefined}
      >
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label={aria['aria-label']}
          data-testid={aria['data-testid']}
          className={classes(variant, size, 'w-full')}
          id={id}
        >
          <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
          {children}
        </button>
        {compact ? null : (
          // A self-contained dark chip, because this note appears underneath
          // CTAs on both navy heroes and white sections. Using the inherited
          // body colour would be unreadable on one of the two.
          <span className="border-brand-400/25 bg-navy-950/90 text-brand-100 flex max-w-full min-w-0 items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-snug [overflow-wrap:anywhere]">
            <Info aria-hidden="true" className="text-brand-400 mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0">
              <span className="font-semibold text-white">Link not published yet.</span> Set{' '}
              <code className="text-brand-200 rounded bg-white/10 px-1 py-0.5 font-mono text-[0.75rem] break-all">
                {config.envVar}
              </code>{' '}
              to activate this button.
            </span>
          </span>
        )}
      </span>
    );
  }

  const icon = showArrow ? (
    arrowIcon === 'external' ? (
      <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0 opacity-90" />
    ) : (
      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
    )
  ) : null;

  const content = (
    <>
      {children}
      {icon}
    </>
  );

  if (to && !href) {
    return (
      <Link
        href={to}
        id={id}
        className={classes(variant, size, className)}
        onClick={() => track(config.event, { placement: label })}
        {...aria}
      >
        {content}
      </Link>
    );
  }

  return (
    <a
      href={destination}
      id={id}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track(config.event, { placement: label })}
      className={classes(variant, size, className)}
      aria-label={`${label} (opens in a new tab)`}
      {...aria}
    >
      {content}
    </a>
  );
}

interface CtaButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  intent?: CtaIntent;
  to?: string;
  children: React.ReactNode;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  showArrow?: boolean;
  arrowIcon?: 'arrow' | 'external';
  className?: string;
}

/** Same destination rules as CtaLink, rendered as a real <button>. */
export function CtaButton({
  intent = 'free',
  to,
  children,
  variant = 'accent',
  size = 'lg',
  showArrow = true,
  arrowIcon = 'arrow',
  className,
  onClick,
  ...rest
}: CtaButtonProps) {
  const config = intentMap[intent];
  const destination = to ?? config.state.href;
  const label = typeof children === 'string' ? children : config.product;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!destination) return;
    track(config.event, { placement: label });
    if (to?.startsWith('/')) {
      window.location.assign(to);
      return;
    }
    if (/^https?:\/\//i.test(destination)) {
      window.open(destination, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={classes(variant, size, className)}
      {...rest}
    >
      {children}
      {showArrow ? (
        arrowIcon === 'external' ? (
          <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0 opacity-90" />
        ) : (
          <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        )
      ) : null}
    </button>
  );
}

export const ctaLabel = {
  free: 'Start free',
  complete: 'Get AI Job Hunter',
  affiliate: 'Become an affiliate',
} as const;
