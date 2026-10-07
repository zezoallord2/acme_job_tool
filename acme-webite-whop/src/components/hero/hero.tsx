import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/ui/container';
import { CtaLink } from '@/components/cta-link';
import { LiquidHero } from '@/components/hero/liquid-hero';
import { EvidencePanel } from '@/components/hero/evidence-panel';
import { brandPromise, freeProduct, paidProduct } from '@/content/marketing';
import { siteConfig } from '@/lib/config';

export function Hero() {
  return (
    <section
      className="relative isolate overflow-hidden pt-28 pb-20 sm:pt-32 sm:pb-24 lg:pt-40 lg:pb-32"
      aria-labelledby="hero-heading"
    >
      <LiquidHero variant="hero" />

      {/* Readability scrims.
          Layering note: every layer here is `position: absolute` with
          `z-index: auto`, so they paint in DOM order — effect first, then the
          scrims, then the `relative` content container on top. A negative
          z-index here would push the scrims *behind* the effect, which is the
          opposite of their purpose. Opacities are tuned so white copy keeps at
          least AA contrast over the brightest teal in the ramp. */}
      <div
        aria-hidden="true"
        className="from-navy-950/88 via-navy-950/60 to-navy-950/25 absolute inset-0 bg-gradient-to-r"
      />
      <div
        aria-hidden="true"
        className="from-navy-950/85 absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t to-transparent"
      />
      <div aria-hidden="true" className="grain-overlay absolute inset-0 opacity-[0.16]" />

      <Container className="relative">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <div className="max-w-2xl">
            <div className="animate-fade-rise">
              <Badge variant="light" size="md">
                <span className="bg-brand-400 inline-block h-1.5 w-1.5 rounded-full" />
                AI-Assisted Job Search
              </Badge>
            </div>

            <h1
              id="hero-heading"
              className="mt-6 text-[2.25rem] leading-[1.1] font-bold tracking-[-0.03em] text-balance text-white sm:text-[2.85rem] lg:text-[3.25rem]"
            >
              Stop Sending Generic Applications.{' '}
              <span className="text-gradient-teal">Build Better Ones With AI.</span>
            </h1>

            <p className="text-brand-100/85 mt-6 max-w-xl text-[1.0625rem] leading-relaxed sm:text-lg">
              Acme Jobs helps you understand job descriptions, improve your resume, prepare for
              interviews, and turn your real experience into stronger, more targeted applications.
            </p>

            <div className="mt-9 flex flex-col gap-3.5 sm:flex-row sm:items-center sm:gap-4">
              <CtaLink
                intent="free"
                size="xl"
                className="w-full justify-center sm:w-auto"
                data-testid="hero-cta-free"
              >
                Start free
              </CtaLink>
              <CtaLink
                intent="complete"
                to="/complete"
                variant="outline-light"
                size="xl"
                arrowIcon="arrow"
                className="w-full justify-center sm:w-auto"
                data-testid="hero-cta-complete"
              >
                See Complete Edition
              </CtaLink>
            </div>

            <p className="text-brand-100/70 mt-4 text-sm">
              Get the {freeProduct.name} — {freeProduct.price}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 pt-6">
              <span className="text-brand-300 text-[0.72rem] font-bold tracking-[0.14em] uppercase">
                {brandPromise}
              </span>
            </div>
          </div>

          <EvidencePanel />
        </div>

        <ul className="mt-14 grid grid-cols-1 gap-3 border-t border-white/10 pt-8 text-center sm:grid-cols-3 sm:gap-6 lg:mt-16">
          {['No fake experience', 'No invented metrics', 'No fake ATS scores'].map((item) => (
            <li key={item} className="text-brand-100/70 text-sm font-semibold">
              {item}
            </li>
          ))}
        </ul>

        <p className="text-brand-100/45 mt-8 text-center text-xs">
          Not sure yet? Read{' '}
          <a
            href="#problem"
            className="text-brand-200 font-semibold underline underline-offset-4 hover:text-white"
          >
            what goes wrong with unstructured AI job search
          </a>{' '}
          — or go straight to the{' '}
          <a
            href="/free"
            className="text-brand-200 font-semibold underline underline-offset-4 hover:text-white"
          >
            free Starter Guide
          </a>
          . {paidProduct.launchPrice} for {paidProduct.edition} when you need the full system.
        </p>
      </Container>

      <span className="sr-only">
        {siteConfig.name} — {siteConfig.tagline}
      </span>
    </section>
  );
}

export default Hero;
