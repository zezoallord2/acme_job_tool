import { createFileRoute } from '@tanstack/react-router';
import { headFor } from '@/lib/head';

import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { ArticleCard } from '@/components/resource-preview';
import { FinalCta } from '@/components/final-cta';
import { JsonLd } from '@/components/json-ld';
import { breadcrumbJsonLd  } from '@/lib/seo';
import { getSortedArticles } from '@/content/articles';

const head = () => headFor({
  title: 'Free Job Search Resources & Guides',
  description:
    'Practical guides on AI job search: tailoring a resume without lying, analysing job descriptions, STAR interview stories, graduate and career-change resumes, and preparing for interviews with AI.',
  path: '/resources',
});

function ResourcesPage() {
  const all = getSortedArticles();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Resources', path: '/resources' },
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
              Resources
            </p>
            <h1 className="mt-4 text-[2.15rem] leading-[1.1] font-bold tracking-[-0.03em] text-white sm:text-[2.85rem]">
              Practical guides for an AI-assisted job search.
            </h1>
            <p className="text-brand-100/85 mt-6 text-[1.0625rem] leading-relaxed sm:text-lg">
              Written for humans first. Every guide answers a real question, includes the part that
              usually gets left out, and never promises results we cannot guarantee.
            </p>
          </div>
        </Container>
      </section>

      <Section tone="white">
        <Container>
          <SectionHeading
            as="h2"
            title="All guides"
            description="We publish when we have something genuinely useful to add, not on a content calendar."
          />

          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {all.map((article) => (
              <li key={article.slug} className="relative">
                <ArticleCard article={article} />
              </li>
            ))}
          </ul>

          <p className="border-line bg-canvas-alt text-ink-soft mt-12 rounded-xl border px-5 py-4 text-[0.88rem] leading-relaxed">
            Looking for the structured version? The{' '}
            <a href="/free" className="text-brand-800 font-semibold underline underline-offset-4">
              free Starter Guide
            </a>{' '}
            turns the same method into six modules you can apply to one real job posting today.
          </p>
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}

export const Route = createFileRoute('/resources/')({
  component: ResourcesPage,
  head,
});
