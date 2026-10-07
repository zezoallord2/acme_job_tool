import { Container, Section } from '@/components/ui/container';
import { CtaLink } from '@/components/cta-link';
import { LiquidHero } from '@/components/hero/liquid-hero';
import { finalCta } from '@/content/marketing';

export function FinalCta() {
  return (
    <Section tone="navy" className="relative overflow-hidden" aria-labelledby="final-cta-heading">
      <LiquidHero variant="band" />
      <div aria-hidden="true" className="bg-navy-950/60 absolute inset-0" />
      <Container className="relative text-center">
        <div className="mx-auto max-w-2xl">
          <h2
            id="final-cta-heading"
            className="text-[1.85rem] leading-[1.15] font-bold tracking-[-0.025em] text-white sm:text-[2.5rem]"
          >
            {finalCta.headline}
          </h2>
          <p className="text-brand-100/85 mt-5 text-base leading-relaxed sm:text-lg">
            Start with the free guide. Use it on one real job application. Upgrade only when you
            need the full system.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3.5 sm:flex-row sm:gap-4">
            <CtaLink
              intent="free"
              size="xl"
              className="w-full justify-center sm:w-auto"
              data-testid="final-cta-free"
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
            >
              View Complete Edition
            </CtaLink>
          </div>

          <p className="text-brand-300 mt-8 text-[0.72rem] font-bold tracking-[0.16em] uppercase">
            Your experience. AI-assisted. Never invented.
          </p>
        </div>
      </Container>
    </Section>
  );
}

export default FinalCta;
