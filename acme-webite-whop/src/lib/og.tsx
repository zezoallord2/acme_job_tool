import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt =
  'Acme Jobs — Better Opportunities Ahead. Your experience. AI-assisted. Never invented.';

interface OgCardInput {
  /** Small label above the headline, e.g. 'AI Job Search Starter Guide'. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Optional pill on the right, e.g. 'Free' or '$9.99 launch price'. */
  pill?: string;
}

/**
 * Shared OpenGraph / Twitter card renderer.
 *
 * Rendered on the server by next/og, so there is no binary asset to maintain and
 * no remote image dependency. Every preview uses the same navy/teal identity and
 * always shows the brand name and tagline.
 */
export function renderOgCard({ eyebrow, title, subtitle, pill }: OgCardInput) {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        backgroundColor: '#04182B',
        backgroundImage:
          'radial-gradient(900px 600px at 8% -10%, rgba(36,195,200,0.42), transparent 65%), radial-gradient(800px 700px at 105% 115%, rgba(27,79,125,0.72), transparent 62%)',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundImage: 'linear-gradient(135deg, #24C3C8, #2C6BE0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#04182B',
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            A
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#ffffff', fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
              Acme Jobs
            </span>
            <span
              style={{
                color: '#8EE7E9',
                fontSize: 17,
                letterSpacing: 3,
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              Better Opportunities Ahead.
            </span>
          </div>
        </div>

        {pill ? (
          <div
            style={{
              display: 'flex',
              border: '2px solid rgba(143,231,233,0.5)',
              borderRadius: 999,
              padding: '12px 26px',
              color: '#EAF8F8',
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {pill}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1000 }}>
        {eyebrow ? (
          <span
            style={{
              color: '#8EE7E9',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: 'uppercase',
              marginBottom: 20,
            }}
          >
            {eyebrow}
          </span>
        ) : null}
        <span
          style={{
            color: '#ffffff',
            fontSize: eyebrow ? 62 : 68,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -1.8,
          }}
        >
          {title}
        </span>
        {subtitle ? (
          <span
            style={{
              color: 'rgba(234,248,248,0.82)',
              fontSize: 28,
              lineHeight: 1.35,
              marginTop: 22,
            }}
          >
            {subtitle}
          </span>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          style={{
            color: '#8EE7E9',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          Your experience. AI-assisted. Never invented.
        </span>
      </div>
    </div>,
    { ...size }
  );
}
