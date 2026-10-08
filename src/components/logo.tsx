/**
 * The Acme Jobs logo.
 *
 * Uses the real artwork at public/brand/logo.png rather than the letter "A"
 * placeholder, which is what every header previously rendered.
 *
 * `Next/Image` is deliberately not used: the mark is decorative next to a text
 * wordmark, and an unoptimised <img> keeps it working in the offline shell and
 * in the service-worker cache without an image optimiser in the runtime image.
 */
export function Logo({
  size = 28,
  withWordmark = true,
  className = "",
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <img
        src="/brand/logo.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        // Rounded so the mark does not show square corners against a coloured
        // header; the artwork already has its own navy background.
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22),
          objectFit: "cover",
        }}
      />
      {withWordmark ? (
        <span
          className="font-display"
          style={{
            fontSize: Math.max(0.8, size * 0.5),
            lineHeight: 1.1,
            color: "var(--text)",
          }}
        >
          Acme <span style={{ color: "var(--brand-accent)" }}>Jobs</span>
        </span>
      ) : null}
    </span>
  );
}
