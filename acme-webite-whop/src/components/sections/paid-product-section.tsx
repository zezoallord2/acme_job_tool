import { Check } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { Badge } from '@/components/ui/badge';
import { CtaLink } from '@/components/cta-link';
import { ProductVisual } from '@/components/product-visual';
import { paidProduct } from '@/content/marketing';

export function PaidProductSection() {
  const features = paidProduct.modules;
  const half = Math.ceil(features.length / 2);

  return (
    <Section tone="navy" className="relative overflow-hidden" aria-labelledby="complete-heading">
      <div aria-hidden="true" className="grain-overlay absolute inset-0" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(80%_60%_at_20%_0%,rgba(17,142,148,0.25),transparent_65%)]"
      />
      <Container className="relative">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-start lg:gap-16">
          <div>
            <Badge variant="light" size="md">
              {paidProduct.badge}
            </Badge>

            <p className="text-brand-300 mt-5 text-[0.78rem] font-bold tracking-[0.16em] uppercase">
              {paidProduct.name} · {paidProduct.edition}
            </p>

            <h2
              id="complete-heading"
              className="mt-2 text-[1.85rem] leading-[1.15] font-bold tracking-[-0.025em] text-white sm:text-[2.5rem]"
            >
              {paidProduct.headline}
            </h2>

            <p className="text-brand-100/85 mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
              {paidProduct.summary}
            </p>

            {/* Pricing */}
            <div className="mt-8 flex flex-wrap items-end gap-x-4 gap-y-2 rounded-[--radius-panel] border border-white/12 bg-white/[0.06] p-5 sm:p-6">
              <div>
                <p className="text-brand-300 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
                  Launch price
                </p>
                <p className="mt-1 text-4xl leading-none font-bold tracking-[-0.03em] text-white sm:text-5xl">
                  {paidProduct.launchPrice}
                </p>
              </div>
              <div className="pb-1">
                <p className="text-brand-300 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
                  Regular price
                </p>
                <p className="text-brand-100/60 decoration-brand-300/50 mt-1 text-lg font-semibold line-through">
                  {paidProduct.regularPrice}
                </p>
              </div>
              <p className="text-brand-100/70 w-full text-sm">
                One-time payment. Yours to keep and reuse for every application.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <CtaLink
                intent="complete"
                size="xl"
                variant="accent"
                className="w-full justify-center sm:w-auto"
                data-testid="paid-section-cta"
              >
                {paidProduct.cta}
              </CtaLink>
              <CtaLink
                intent="free"
                variant="outline-light"
                size="xl"
                arrowIcon="arrow"
                className="w-full justify-center sm:w-auto"
              >
                Not yet — start free
              </CtaLink>
            </div>

            <p className="text-brand-100/60 mt-3 text-xs">
              Checkout and delivery are handled by our payment provider. Instant download after
              purchase.
            </p>
          </div>

          <div>
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {features.map((feature, index) => (
                <li
                  key={feature.title}
                  className={`rounded-xl border border-white/12 bg-white/[0.05] p-4 ${
                    index >= half ? 'sm:col-start-2' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="bg-brand-500/25 text-brand-300 mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full">
                      <Check aria-hidden="true" className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    <div>
                      <p className="text-[0.9rem] font-bold text-white">{feature.title}</p>
                      <p className="text-brand-100/70 mt-1 text-[0.82rem] leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <ProductVisual variant="complete" />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

export default PaidProductSection;
