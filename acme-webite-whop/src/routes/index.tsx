import { createFileRoute } from '@tanstack/react-router';
import { headFor } from '@/lib/head';

import { Hero } from '@/components/hero/hero';
import { TrustStrip } from '@/components/trust-strip';
import { ProblemSection } from '@/components/sections/problem-section';
import { MethodSection } from '@/components/sections/method-section';
import { NeverInventedSection } from '@/components/sections/never-invented-section';
import { FreeProductSection } from '@/components/sections/free-product-section';
import { WorkflowSteps } from '@/components/workflow-steps';
import { PaidProductSection } from '@/components/sections/paid-product-section';
import { ComparisonTable } from '@/components/comparison-table';
import { AudienceCards } from '@/components/audience-cards';
import { BeforeAfter } from '@/components/before-after';
import { ComingSoon } from '@/components/coming-soon';
import { AffiliateCTA } from '@/components/affiliate-cta';
import { ResourcePreview } from '@/components/resource-preview';
import { FaqSection } from '@/components/faq-accordion';
import { FinalCta } from '@/components/final-cta';
import { JsonLd } from '@/components/json-ld';
import { faqJsonLd, organizationJsonLd  } from '@/lib/seo';
import { faqsForJsonLd } from '@/content/faq';

const head = () => headFor({
  title: 'Acme Jobs — AI-Assisted Job Search Built on Your Real Experience',
  description:
    'Acme Jobs helps you understand job descriptions, improve your resume and prepare for interviews — using your real experience, never invented. Start free.',
  path: '/',
});

function HomePage() {
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={faqJsonLd(faqsForJsonLd())} />

      <Hero />
      <TrustStrip />
      <ProblemSection />
      <MethodSection />
      <NeverInventedSection />
      <FreeProductSection />
      <WorkflowSteps />
      <PaidProductSection />
      <ComparisonTable />
      <AudienceCards />
      <BeforeAfter />
      <ComingSoon />
      <ResourcePreview />
      <AffiliateCTA />
      <FaqSection />
      <FinalCta />
    </>
  );
}

export const Route = createFileRoute('/')({
  component: HomePage,
  head,
});
