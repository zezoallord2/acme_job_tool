import { createFileRoute } from '@tanstack/react-router';
import { headFor } from '@/lib/head';

import { Check, FileCheck2, HandCoins, Link2, Megaphone, Scale } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { Badge } from '@/components/ui/badge';
import { CtaLink } from '@/components/cta-link';
import { LiquidHero } from '@/components/hero/liquid-hero';
import { JsonLd } from '@/components/json-ld';
import { FinalCta } from '@/components/final-cta';
import { breadcrumbJsonLd  } from '@/lib/seo';
import { affiliate, paidProduct } from '@/content/marketing';

const head = () => headFor({
  title: 'Affiliate Programme â€” Earn Promoting Acme Jobs',
  description:
    'Join the Acme Jobs affiliate programme and earn when your audience buys AI Job Hunter â€” Complete Edition. Built for career, student, AI and resume creators, job-search pages and career coaches.',
  path: '/affiliates',
  imagePath: '/affiliates/og.png',
});

const steps = [
  {
    icon: Link2,
    title: 'Apply',
    description:
      'Tell us about your audience and how you plan to promote the products. We review applications personally.',
  },
  {
    icon: Megaphone,
    title: 'Get your link',
    description:
      'Once approved you receive a tracking link for AI Job Hunter â€” Complete Edition, plus the current launch pricing to quote.',
  },
  {
    icon: HandCoins,
    title: 'Earn on purchase',
    description:
      'Your commission is attributed to completed purchases made through your link, following the programme agreement.',
  },
];

function AffiliatesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Affiliate Programme', path: '/affiliates' },
        ])}
      />

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
                <Megaphone aria-hidden="true" className="h-3.5 w-3.5" />
                Affiliate programme
              </Badge>
              <h1 className="mt-6 text-[2.15rem] leading-[1.1] font-bold tracking-[-0.03em] text-white sm:text-[2.85rem]">
                {affiliate.headline}
              </h1>
              <p className="text-brand-100/85 mt-6 text-[1.0625rem] leading-relaxed">
                {affiliate.lede}
              </p>

              <div className="mt-9 flex flex-col gap-3.5 sm:flex-row sm:gap-4">
                <CtaLink
                  intent="affiliate"
                  size="xl"
                  className="w-full justify-center sm:w-auto"
                  data-testid="affiliates-page-cta"
                >
                  {affiliate.cta}
                </CtaLink>
                <a
                  href="/complete"
                  className="inline-flex h-13 w-full items-center justify-center rounded-full border border-white/30 bg-white/10 px-7 text-base font-semibold text-white backdrop-blur-sm transition-colors duration-200 hover:border-white/60 hover:bg-white/15 sm:w-auto"
                >
                  See the product you would promote
                </a>
              </div>

              <ul className="mt-8 grid gap-x-6 gap-y-2 border-t border-white/10 pt-6 sm:grid-cols-2">
                {affiliate.audiences.map((audience) => (
                  <li
                    key={audience}
                    className="text-brand-100/80 flex items-center gap-2 text-sm font-medium"
                  >
                    <Check aria-hidden="true" className="text-brand-400 h-4 w-4 shrink-0" />
                    {audience}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[--radius-panel] border border-white/12 bg-white/[0.07] p-6 backdrop-blur-md sm:p-8">
              <p className="text-brand-300 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
                Product you would promote
              </p>
              <h2 className="mt-3 text-xl font-bold text-white">
                {paidProduct.name} â€” {paidProduct.edition}
              </h2>
              <p className="text-brand-100/75 mt-2 text-[0.92rem] leading-relaxed">
                {paidProduct.summary}
              </p>
              <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-2 border-t border-white/10 pt-5">
                <div>
                  <p className="text-brand-300 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
                    Launch price
                  </p>
                  <p className="mt-1 text-3xl font-bold text-white">{paidProduct.launchPrice}</p>
                </div>
                <div className="pb-0.5">
                  <p className="text-brand-300 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
                    Regular price
                  </p>
                  <p className="text-brand-100/60 mt-1 text-base font-semibold line-through">
                    {paidProduct.regularPrice}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Section tone="white" aria-labelledby="how-heading">
        <Container>
          <SectionHeading
            as="h2"
            id="how-heading"
            align="center"
            eyebrow="How it works"
            title="Three steps, no surprises"
            description="We keep the programme simple on purpose. Complex affiliate terms are usually a sign nobody wants to read them."
          />
          <ol className="mt-12 grid gap-5 lg:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="border-line shadow-soft relative rounded-[--radius-card] border bg-white p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="from-navy-800 to-navy-600 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <span className="text-ink-muted text-[0.75rem] font-bold tracking-[0.12em]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-navy-900 mt-4 text-[1.02rem] font-bold">{step.title}</h3>
                  <p className="text-ink-soft mt-2 text-[0.92rem] leading-relaxed">
                    {step.description}
                  </p>
                </li>
              );
            })}
          </ol>
        </Container>
      </Section>

      <Section tone="alt" aria-labelledby="rules-heading">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
            <div>
              <SectionHeading
                as="h2"
                id="rules-heading"
                eyebrow="What we expect"
                title="Promotion standards"
                description="We review every application. These are the standards we apply, published so you know what you are agreeing to."
              />
              <ul className="mt-7 space-y-3">
                {[
                  'Recommend the product honestly. Do not claim guaranteed results, fake ATS scores or invented success rates.',
                  'Disclose the affiliate relationship clearly wherever your platform requires it.',
                  'No spam, no bought traffic, no misleading advertorial.',
                  'Do not create fake testimonials or fabricated user results.',
                ].map((rule) => (
                  <li key={rule} className="flex items-start gap-3">
                    <Scale
                      aria-hidden="true"
                      className="text-brand-600 mt-0.5 h-4.5 w-4.5 shrink-0"
                    />
                    <span className="text-ink-soft text-[0.94rem] leading-relaxed">{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-line shadow-soft rounded-[--radius-panel] border bg-white p-6 sm:p-8">
              <div className="bg-brand-100 text-brand-800 flex h-11 w-11 items-center justify-center rounded-xl">
                <FileCheck2 aria-hidden="true" className="h-5 w-5" />
              </div>
              <h3 className="text-navy-900 mt-5 text-lg font-bold">On commission rates</h3>
              <p className="text-ink-soft mt-3 text-[0.94rem] leading-relaxed">
                {affiliate.commissionNote}
              </p>
              <p className="text-ink-soft mt-4 text-[0.94rem] leading-relaxed">
                Current rates, cookie window, payout schedule and refund handling are set out in the
                programme agreement you receive when you are approved. When this page can link to
                that agreement directly, it will.
              </p>
              <div className="border-line mt-7 border-t pt-6">
                <CtaLink
                  intent="affiliate"
                  size="lg"
                  variant="primary"
                  className="w-full justify-center"
                >
                  {affiliate.cta}
                </CtaLink>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}

export const Route = createFileRoute('/affiliates')({
  component: AffiliatesPage,
  head,
});
