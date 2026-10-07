import { cn } from '@/lib/utils';

export interface BrandMarkProps {
  className?: string;
  /** Renders the briefcase + credential card detail behind the A ribbon. */
  withDetail?: boolean;
  title?: string;
}

/**
 * The Acme Jobs monogram: a teal-to-navy ribbon "A" with a credential card and
 * briefcase detail behind it, matching the supplied brand logo.
 *
 * Drawn as inline SVG so it stays crisp at any size, needs no network request,
 * and cannot 404. The supplied raster logo can still be dropped in
 * /public/brand/ for social previews if preferred.
 */
export function BrandMark({ className, withDetail = true, title }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('h-9 w-9', className)}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
    >
      <title>{title ?? undefined}</title>
      <defs>
        <linearGradient
          id="acme-a-grad"
          x1="6"
          y1="58"
          x2="52"
          y2="6"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#24C3C8" />
          <stop offset="52%" stopColor="#1E9BE6" />
          <stop offset="100%" stopColor="#2C6BE0" />
        </linearGradient>
        <linearGradient
          id="acme-a-deep"
          x1="14"
          y1="50"
          x2="40"
          y2="14"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0B2D4D" />
          <stop offset="100%" stopColor="#2C6BE0" />
        </linearGradient>
        <linearGradient
          id="acme-card"
          x1="40"
          y1="10"
          x2="62"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#5FD9F5" />
          <stop offset="100%" stopColor="#2F86F0" />
        </linearGradient>
        <filter id="acme-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {withDetail ? (
        <g opacity="0.9">
          {/* credential / resume card */}
          <rect
            x="36"
            y="6"
            width="26"
            height="20"
            rx="5"
            fill="url(#acme-card)"
            transform="rotate(-7 49 16)"
          />
          <g transform="rotate(-7 49 16)" fill="#0B2D4D" opacity="0.72">
            <circle cx="43.5" cy="13.5" r="3" />
            <path d="M39.5 21.5c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6z" />
            <rect x="49.5" y="11.6" width="9.5" height="2.1" rx="1.05" />
            <rect x="49.5" y="15.4" width="7.5" height="1.8" rx="0.9" />
            <rect x="49.5" y="18.8" width="8.5" height="1.8" rx="0.9" />
          </g>
          {/* briefcase */}
          <rect
            x="42"
            y="32"
            width="24"
            height="21"
            rx="5"
            fill="url(#acme-card)"
            transform="rotate(6 54 42)"
          />
          <g transform="rotate(6 54 42)">
            <path
              d="M50 32v-2.6A2.4 2.4 0 0 1 52.4 27h3.2A2.4 2.4 0 0 1 58 29.4V32"
              stroke="#0B2D4D"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.75"
              fill="none"
            />
            <rect x="49" y="40" width="10" height="5" rx="1.6" fill="#0B2D4D" opacity="0.8" />
          </g>
        </g>
      ) : null}

      <g filter="url(#acme-soft-glow)">
        <path
          d="M27.6 8.2c3.6-3.4 9.6-3.4 13.2 0l15.2 14.2c4 3.7 4 10.3 0 14l-3.1 3c-3.9 3.7-10.2 3.7-14.1 0l-4.5-4.3a9.6 9.6 0 0 0-13.9 0l-8 7.6c-3.9 3.7-3.9 10 0 13.7l1 1c3.8 3.6 9.9 3.6 13.7 0l9.2-8.8c3.9-3.7 10.2-3.7 14.1 0l4.4 4.2"
          stroke="url(#acme-a-grad)"
          strokeWidth="8.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M32.6 20.4 19.4 40.9c-1.9 3-3.4 4.4-5.3 4.4"
          stroke="url(#acme-a-deep)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.55"
        />
      </g>
    </svg>
  );
}

export interface LogoProps {
  className?: string;
  /** `light` for dark backgrounds, `dark` for light backgrounds. */
  tone?: 'light' | 'dark';
  markClassName?: string;
  showTagline?: boolean;
}

export function Logo({ className, tone = 'dark', markClassName, showTagline = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark className={cn('h-9 w-9 shrink-0', markClassName)} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'text-[1.06rem] font-bold tracking-[-0.02em]',
            tone === 'light' ? 'text-white' : 'text-navy-900'
          )}
        >
          Acme <span className={tone === 'light' ? 'text-brand-300' : 'text-brand-700'}>Jobs</span>
        </span>
        {showTagline ? (
          <span
            className={cn(
              'mt-1 text-[0.75rem] font-medium tracking-[0.16em] uppercase',
              tone === 'light' ? 'text-brand-200/80' : 'text-ink-muted'
            )}
          >
            Better Opportunities Ahead.
          </span>
        ) : null}
      </span>
    </span>
  );
}
