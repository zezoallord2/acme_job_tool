import { createFileRoute } from '@tanstack/react-router';
import { headFor } from '@/lib/head';

import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { FaqAccordion } from '@/components/faq-accordion';
import { FinalCta } from '@/components/final-cta';
import { JsonLd } from '@/components/json-ld';
import { breadcrumbJsonLd, faqJsonLd  } from '@/lib/seo';
import { faqGroups, faqs, faqsForJsonLd } from '@/content/faq';

const head = () => headFor({
  title: 'Frequently Asked Questions',
  description:
    'Answers about the free AI Job Search Starter Guide, the Complete Edition, whether Acme Jobs invents experience, ATS claims, and when the Acme Jobs app is coming.',
  path: '/faq',
});

function FaqPage() {
  return (
    <>
      <JsonLd data={faqJsonLd(faqsForJsonLd())} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'FAQ', path: '/faq' },
        ])}
      />

      <section className="bg-navy-900 relative overflow-hidden pt-28 pb-14 sm:pt-32 sm:pb-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(85%_70%_at_15%_0%,rgba(17,142,148,0.28),transparent_65%)]"
        />
        <div aria-hidden="true" className="grain-overlay absolute inset-0" />
        <Container className="relative">
          <div className="max-w-3xl">
            <p className="text-brand-300 text-[0.72rem] font-bold tracking-[0.18em] uppercase">
              FAQ
            </p>
            <h1 className="mt-4 text-[2.15rem] leading-[1.1] font-bold tracking-[-0.03em] text-white sm:text-[2.85rem]">
              Questions, answered honestly.
            </h1>
            <p className="text-brand-100/85 mt-6 text-[1.0625rem] leading-relaxed sm:text-lg">
              Including the questions that are less flattering than the marketing version — because
              you will be asked them anyway, in the interview.
            </p>
          </div>
        </Container>
      </section>

      <Section tone="white">
        <Container>
          <div className="mx-auto max-w-3xl">
            {faqGroups.map((group) => {
              const items = faqs.filter((item) => item.group === group);
              if (!items.length) return null;
              return (
                <section key={group} className="mb-12 last:mb-0" aria-labelledby={`faq-${group}`}>
                  <h2
                    id={`faq-${group}`}
                    className="text-brand-700 text-[0.72rem] font-bold tracking-[0.16em] uppercase"
                  >
                    {group}
                  </h2>
                  <FaqAccordion items={items} className="mt-5" />
                </section>
              );
            })}
          </div>
        </Container>
      </Section>

      <Section tone="alt">
        <Container>
          <div className="mx-auto max-w-3xl">
            <SectionHeading
              as="h2"
              align="center"
              eyebrow="Still unsure"
              title="Two ways to find out"
              description="Both cost you nothing but time, which is the honest recommendation."
            />
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              <div className="border-line shadow-soft rounded-[--radius-card] border bg-white p-6">
                <p className="text-brand-800 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
                  Option one
                </p>
                <p className="text-navy-900 mt-2 text-lg font-bold">Start with the free guide</p>
                <p className="text-ink-soft mt-2 text-[0.92rem] leading-relaxed">
                  Apply it to one real posting. If it makes your application clearer, the Complete
                  Edition is the logical next step.
                </p>
                <a
                  href="/free"
                  className="text-brand-800 hover:text-navy-900 mt-4 inline-flex items-center gap-1.5 text-sm font-bold underline underline-offset-4"
                >
                  Start free
                </a>
              </div>
              <div className="border-line shadow-soft rounded-[--radius-card] border bg-white p-6">
                <p className="text-navy-700 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
                  Option two
                </p>
                <p className="text-navy-900 mt-2 text-lg font-bold">Read the method first</p>
                <p className="text-ink-soft mt-2 text-[0.92rem] leading-relaxed">
                  If you want to understand the reasoning before spending any time, start with the
                  five-step workflow.
                </p>
                <a
                  href="/how-it-works"
                  className="text-brand-800 hover:text-navy-900 mt-4 inline-flex items-center gap-1.5 text-sm font-bold underline underline-offset-4"
                >
                  How it works
                </a>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}

export const Route = createFileRoute('/faq')({
  component: FaqPage,
  head,
});
