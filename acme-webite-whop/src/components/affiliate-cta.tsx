import { Coins, Megaphone, Users } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { CtaLink } from '@/components/cta-link';
import { affiliate } from '@/content/marketing';

export function AffiliateCTA({ compact = false }: { compact?: boolean }) {
  return (
    <Section
      tone="teal"
      className={compact ? 'py-14 sm:py-16' : undefined}
      aria-labelledby="affiliate-heading"
    >
      <Container>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
          <div>
            <SectionHeading
              as="h2"
              id="affiliate-heading"
              eyebrow="Affiliate programme"
              title={affiliate.headline}
              description={affiliate.lede}
            />

            <div className="mt-8">
              <p className="text-brand-800 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
                Relevant audiences
              </p>
              <ul className="mt-3.5 flex flex-wrap gap-2">
                {affiliate.audiences.map((audience) => (
                  <li
                    key={audience}
                    className="border-brand-300 text-navy-900 inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[0.84rem] font-semibold"
                  >
                    <Users aria-hidden="true" className="text-brand-600 h-3.5 w-3.5" />
                    {audience}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <CtaLink
                intent="affiliate"
                size="lg"
                variant="primary"
                className="w-full justify-center sm:w-auto"
                data-testid="affiliate-cta"
              >
                {affiliate.cta}
              </CtaLink>
              <a
                href="/complete"
                className="text-navy-800 hover:text-brand-800 inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold underline underline-offset-4 transition-colors"
              >
                See what you would promote
              </a>
            </div>
          </div>

          <div className="border-brand-300 shadow-soft rounded-[--radius-panel] border bg-white p-6 sm:p-8">
            <div className="from-brand-600 to-navy-700 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white">
              <Megaphone aria-hidden="true" className="h-5 w-5" />
            </div>
            <h3 className="text-navy-900 mt-5 text-lg font-bold tracking-[-0.015em]">
              How it works
            </h3>
            <ol className="mt-4 space-y-3">
              {[
                'Apply for the programme and receive your tracking link.',
                'Recommend the Complete Edition to an audience you already reach.',
                'Earn a commission on purchases made through your link.',
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="bg-navy-800 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-ink-soft text-[0.92rem] leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <p className="border-line text-ink-muted mt-6 flex items-start gap-2.5 border-t pt-4 text-[0.82rem] leading-relaxed">
              <Coins aria-hidden="true" className="text-brand-600 mt-0.5 h-4 w-4 shrink-0" />
              {affiliate.commissionNote}
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}

export default AffiliateCTA;
