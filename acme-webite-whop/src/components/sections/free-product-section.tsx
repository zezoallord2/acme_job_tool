import { Check, Clock, Sparkles } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { Badge } from '@/components/ui/badge';
import { CtaLink } from '@/components/cta-link';
import { ProductVisual } from '@/components/product-visual';
import { freeProduct } from '@/content/marketing';

export function FreeProductSection() {
  return (
    <Section tone="gradient-light" className="relative" aria-labelledby="free-heading">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16">
          <div>
            <Badge variant="brand" size="md">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              {freeProduct.badge}
            </Badge>

            <p className="text-navy-600 mt-5 text-[0.78rem] font-bold tracking-[0.16em] uppercase">
              {freeProduct.name} · {freeProduct.edition}
            </p>

            <h2
              id="free-heading"
              className="text-navy-900 mt-2 text-[1.85rem] leading-[1.15] font-bold tracking-[-0.025em] sm:text-[2.5rem]"
            >
              {freeProduct.headline}
            </h2>

            <p className="text-ink-soft mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
              {freeProduct.mainMessage} {freeProduct.summary}
            </p>

            <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
              {freeProduct.supports.map((module) => (
                <li
                  key={module}
                  className="border-line text-navy-900 shadow-soft flex items-center gap-2.5 rounded-xl border bg-white px-3.5 py-3 text-[0.92rem] font-semibold"
                >
                  <span className="bg-brand-100 text-brand-700 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                    <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {module}
                </li>
              ))}
            </ul>

            <div className="border-brand-200 bg-brand-50 mt-4 flex items-center gap-3 rounded-xl border px-4 py-3.5">
              <Clock aria-hidden="true" className="text-brand-700 h-5 w-5 shrink-0" />
              <p className="text-brand-900 text-[0.92rem] font-semibold">
                Plus the {freeProduct.workflow} — a repeatable 30-minute sequence you can run on any
                job posting.
              </p>
            </div>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <CtaLink
                intent="free"
                size="xl"
                className="w-full justify-center sm:w-auto"
                data-testid="free-section-cta"
              >
                {freeProduct.cta}
              </CtaLink>
              <p className="text-ink-soft text-sm font-medium">
                {freeProduct.price} · {freeProduct.microcopy}
              </p>
            </div>

            <p className="text-ink-muted mt-3 text-xs">
              Works with ChatGPT, Claude, Gemini, Copilot or any similar assistant — free tiers
              included.
            </p>
          </div>

          <ProductVisual variant="free" />
        </div>
      </Container>
    </Section>
  );
}

export default FreeProductSection;
