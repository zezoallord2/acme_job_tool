import { createFileRoute } from '@tanstack/react-router';
import { headFor } from '@/lib/head';

import { Link } from '@/components/link';
import { Check, Info, Sparkles } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { Badge } from '@/components/ui/badge';
import { CtaLink } from '@/components/cta-link';
import { LiquidHero } from '@/components/hero/liquid-hero';
import { ProductVisual } from '@/components/product-visual';
import { ComparisonTable } from '@/components/comparison-table';
import { NeverInventedSection } from '@/components/sections/never-invented-section';
import { FinalCta } from '@/components/final-cta';
import { JsonLd } from '@/components/json-ld';
import { breadcrumbJsonLd, productJsonLd  } from '@/lib/seo';
import { paidProduct } from '@/content/marketing';

const head = () => headFor({
  title: 'AI Job Hunter â€” Complete Edition',
  description:
    'The complete AI-assisted job search system: Career Master Profile, achievement mining, deep job analysis, resume tailoring, cover letters, STAR story bank and interview prep. Launch price $9.99.',
  path: '/complete',
  imagePath: '/complete/og.png',
});

function CompletePage() {
  const modules = paidProduct.modules;

  return (
    <>
      <JsonLd
        data={productJsonLd({
          name: `${paidProduct.name} â€” ${paidProduct.edition}`,
          description: paidProduct.summary,
          price: '9.99',
          priceCurrency: 'USD',
          path: '/complete',
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Complete Edition', path: '/complete' },
        ])}
      />

      {/* Hero */}
      <section className="relative isolate overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-36">
        <LiquidHero variant="hero" />
        <div
          aria-hidden="true"
          className="from-navy-950/88 via-navy-950/60 to-navy-950/25 absolute inset-0 bg-gradient-to-r"
        />
        <Container className="relative">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16">
            <div className="max-w-2xl">
              <Badge variant="light" size="md">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                {paidProduct.badge}
              </Badge>

              <h1 className="mt-6 text-[2.15rem] leading-[1.1] font-bold tracking-[-0.03em] text-white sm:text-[2.85rem]">
                {paidProduct.name}
                <span className="text-gradient-teal block">{paidProduct.edition}</span>
              </h1>

              <p className="text-brand-100/85 mt-6 max-w-xl text-[1.0625rem] leading-relaxed">
                {paidProduct.summary}
              </p>

              <div className="mt-8 flex flex-wrap items-end gap-x-5 gap-y-3 rounded-[--radius-panel] border border-white/12 bg-white/[0.06] p-5 backdrop-blur-sm sm:p-6">
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

              <div className="mt-9 flex flex-col gap-3.5 sm:flex-row sm:items-center sm:gap-4">
                <CtaLink
                  intent="complete"
                  size="xl"
                  className="w-full justify-center sm:w-auto"
                  data-testid="complete-page-cta"
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
                  Not yet â€” start free
                </CtaLink>
              </div>

              <p className="text-brand-100/70 mt-4 text-sm">
                Includes everything in the free Starter Guide.
              </p>
            </div>

            <ProductVisual variant="complete" />
          </div>
        </Container>
      </section>

      {/* What is inside */}
      <Section tone="white" aria-labelledby="modules-heading">
        <Container>
          <SectionHeading
            as="h2"
            id="modules-heading"
            eyebrow="What you get"
            title="Thirteen modules, one reusable system."
            description="Each module exists to feed the next one. Used together they turn a job search from a series of one-off writing tasks into a process you can repeat."
          />

          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module, index) => (
              <li
                key={module.title}
                className="border-line shadow-soft hover:border-brand-300 hover:shadow-lift flex h-full flex-col rounded-[--radius-card] border bg-white p-5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 sm:p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-navy-900 text-[1rem] font-bold tracking-[-0.015em]">
                    {module.title}
                  </h3>
                  <span className="text-ink-muted shrink-0 text-[0.75rem] font-bold tracking-[0.12em]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-ink-soft mt-2.5 text-[0.9rem] leading-relaxed">
                  {module.description}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Who it is for / honest positioning */}
      <Section tone="alt" aria-labelledby="fit-heading">
        <Container>
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            {/* min-w-0 keeps a single grid track from exceeding the container
                on very narrow screens, which would clip the card padding. */}
            <div className="border-brand-300 bg-brand-100/70 min-w-0 rounded-[--radius-panel] border p-6 sm:p-8">
              <h2
                id="fit-heading"
                className="text-navy-900 text-[1.35rem] leading-tight font-bold tracking-[-0.02em]"
              >
                Buy this ifâ€¦
              </h2>
              <ul className="mt-5 space-y-3">
                {[
                  'You are applying to several roles at once and losing track of the details.',
                  'You want one source of truth for your career story instead of scattered documents.',
                  'Interview preparation feels improvised each time.',
                  'Your AI-assisted applications still read as generic and you want a process, not better prompts.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check
                      aria-hidden="true"
                      className="text-brand-600 mt-0.5 h-4.5 w-4.5 shrink-0"
                    />
                    <span className="text-navy-900 text-[0.94rem] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-line min-w-0 rounded-[--radius-panel] border bg-white p-6 sm:p-8">
              <h2 className="text-navy-900 text-[1.35rem] leading-tight font-bold tracking-[-0.02em]">
                Start free instead ifâ€¦
              </h2>
              <ul className="mt-5 space-y-3">
                {[
                  'You are applying to one or two roles and can tailor by hand.',
                  'You want a quick fix rather than a system.',
                  'You have not yet tested whether the evidence-first approach suits you.',
                  'Budget is genuinely tight right now.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Info
                      aria-hidden="true"
                      className="text-navy-500 mt-0.5 h-4.5 w-4.5 shrink-0"
                    />
                    <span className="text-ink-soft text-[0.94rem] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <CtaLink
                intent="free"
                size="lg"
                variant="outline"
                className="mt-6 w-full justify-center sm:w-auto"
              >
                Get the free guide instead
              </CtaLink>
            </div>
          </div>

          <p className="border-line text-ink-soft mt-8 flex items-start gap-2.5 rounded-xl border bg-white px-5 py-4 text-[0.88rem] leading-relaxed">
            <Info aria-hidden="true" className="text-navy-500 mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This product does not include job placement, interview guarantees, recruiter access,
              CV writing services or any invented content. It is a self-guided workbook you work
              through yourself. See the{' '}
              <Link
                href="/terms"
                className="text-brand-800 font-semibold underline underline-offset-4"
              >
                full terms and disclaimer
              </Link>
              .
            </span>
          </p>
        </Container>
      </Section>

      <NeverInventedSection />
      <ComparisonTable />
      <FinalCta />
    </>
  );
}

export const Route = createFileRoute('/complete')({
  component: CompletePage,
  head,
});
