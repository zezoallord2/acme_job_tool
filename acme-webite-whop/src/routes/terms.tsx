import { createFileRoute } from '@tanstack/react-router';
import { headFor } from '@/lib/head';

import { Container, Section } from '@/components/ui/container';
import { JsonLd } from '@/components/json-ld';
import { breadcrumbJsonLd  } from '@/lib/seo';

const head = () => headFor({
  title: 'Terms of Use & Product Disclaimer',
  description:
    'Terms of use for acmejobs.co, the Acme Jobs educational products, and our product disclaimer. Acme Jobs does not guarantee employment, interviews or offers.',
  path: '/terms',
});

const terms = [
  {
    heading: '1. About Acme Jobs',
    blocks: [
      'Acme Jobs provides educational and career-preparation tools: written guides, workbooks and — when it launches — an interactive application.',
      'By using this website or purchasing a product, you agree to these terms. If you do not agree with them, please do not use the site or the products.',
    ],
  },
  {
    heading: '2. What we provide',
    blocks: [
      'Products are self-guided learning materials. They include instructions, templates, prompts and exercises for you to work through using your own real experience and whichever AI tools you choose.',
      'We do not perform CV writing, application submission, job placement, recruitment, or interview coaching on your behalf.',
    ],
  },
  {
    heading: '3. Your responsibility for accuracy',
    blocks: [
      'You remain solely responsible for verifying the accuracy of all application content before you submit it to an employer.',
      'You must not use the products to claim qualifications, employment history, certifications, tools, metrics or responsibilities you do not have. Invented content discovered in an interview or background check may result in withdrawal of an offer, and in some jurisdictions, contractual or legal consequences.',
    ],
  },
  {
    heading: '4. No guarantee of results',
    blocks: [
      'Acme Jobs does not guarantee employment, interviews, job offers, salary, promotion, interview success or any specific outcome.',
      'Hiring decisions rest with employers. Outcomes depend on the market, the role, the employer, the competition and factors outside anyone’s control, including factors outside your control and ours.',
      'We do not claim to “beat” applicant tracking systems, we do not provide ATS scores, and we do not represent that any specific technology will advance your application.',
    ],
  },
  {
    heading: '5. Payments and delivery',
    blocks: [
      'Purchases are processed by our payment provider. Prices displayed on this site are display prices and may change; the price charged is the one confirmed at checkout.',
      'Unless otherwise stated, products are delivered electronically immediately after purchase and are licensed, not sold, for your personal, non-commercial use.',
      'Refunds are handled in line with the terms presented at checkout and applicable consumer law. Contact us and we will resolve it promptly.',
    ],
  },
  {
    heading: '6. Licence and acceptable use',
    blocks: [
      'You may use the materials for your own job search and may print or edit your own copies.',
      'You may not resell, redistribute, republish, share or upload the materials, in whole or in part, without written permission. You may not present the materials as your own work.',
      'You may not use the site or the products for unlawful purposes, for automated bulk scraping, or to interfere with the site’s operation.',
    ],
  },
  {
    heading: '7. Early-access list',
    blocks: [
      'Signing up for the early-access list is optional, free, and does not create a contract to purchase anything or guarantee access to the app.',
      'You can unsubscribe from any email we send. Unsubscribe requests are honoured promptly.',
    ],
  },
  {
    heading: '8. Affiliate programme',
    blocks: [
      'Affiliate participation is subject to the separate programme agreement. We may decline applications, and we may suspend or terminate access if promotion standards in the agreement are not met.',
      'Commission rates, attribution windows and payout terms are defined in that agreement rather than on this website.',
    ],
  },
  {
    heading: '9. Third-party services',
    blocks: [
      'Purchases are processed by a third-party payment provider, and the products are designed for use with third-party AI assistants. We do not control those services and are not responsible for their content, availability, data handling or outputs.',
      'Links to third-party sites are provided for convenience and do not imply endorsement.',
    ],
  },
  {
    heading: '10. Intellectual property',
    blocks: [
      'The Acme Jobs name, logo, brand identity, website content, guides and workbooks are our intellectual property or licensed to us, and are protected by applicable law.',
      'Nothing in these terms transfers ownership. Feedback you choose to send may be used to improve our products without obligation to you.',
    ],
  },
  {
    heading: '11. Limitation of liability',
    blocks: [
      'To the maximum extent permitted by law, Acme Jobs is not liable for indirect or consequential loss arising from use of the site or the products, including lost opportunities, lost interview invitations, or the contents of AI-generated text produced by a third-party tool.',
      'Nothing in these terms limits liability that cannot lawfully be limited, including liability for fraud.',
    ],
  },
  {
    heading: '12. Changes',
    blocks: [
      'We may update these terms. The date at the top of this page shows the current version, and continuing to use the site after a change means you accept it.',
    ],
  },
  {
    heading: '13. Contact',
    blocks: ['Questions about these terms: hello@acmejobs.co'],
  },
] as const;

const disclaimerPoints = [
  'Acme Jobs provides educational and career-preparation tools.',
  'We do not guarantee employment, interviews, offers, salary outcomes or any specific ATS score.',
  'Users remain responsible for verifying all application information before submission.',
  'Third-party AI assistants may produce inaccurate or inappropriate content. Review everything before use.',
  'Nothing on this site is professional legal, financial or recruitment advice.',
] as const;

function TermsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Terms', path: '/terms' },
        ])}
      />
      <Section tone="white" className="pt-28 sm:pt-32">
        <Container>
          <div className="mx-auto max-w-[46rem]">
            <p className="text-brand-700 text-[0.72rem] font-bold tracking-[0.18em] uppercase">
              Legal
            </p>
            <h1 className="text-navy-900 mt-4 text-[2.15rem] leading-[1.12] font-bold tracking-[-0.03em]">
              Terms of Use &amp; Disclaimer
            </h1>
            <p className="text-ink-muted mt-4 text-sm">
              Last updated: 1 March 2026 · Applies to acmejobs.co and its pages
            </p>

            <div className="mt-10 space-y-9">
              {terms.map((section) => (
                <section key={section.heading} aria-labelledby={`term-${section.heading}`}>
                  <h2
                    id={`term-${section.heading}`}
                    className="text-navy-900 text-[1.2rem] font-bold tracking-[-0.02em]"
                  >
                    {section.heading}
                  </h2>
                  <div className="mt-3.5 space-y-3">
                    {section.blocks.map((block) => (
                      <p key={block} className="text-ink-soft text-[1rem] leading-[1.75]">
                        {block}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <section
              id="disclaimer"
              aria-labelledby="disclaimer-heading"
              className="border-navy-200 bg-navy-900 text-brand-100 mt-12 scroll-mt-28 rounded-[--radius-panel] border p-6 sm:p-8"
            >
              <h2
                id="disclaimer-heading"
                className="text-[1.25rem] font-bold tracking-[-0.02em] text-white"
              >
                Product disclaimer
              </h2>
              <ul className="mt-5 space-y-3">
                {disclaimerPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-[0.98rem] leading-relaxed">
                    <span
                      aria-hidden="true"
                      className="bg-brand-400 mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                    />
                    <span className="text-brand-100/85">{point}</span>
                  </li>
                ))}
              </ul>
              <p className="text-brand-100/85 mt-6 border-t border-white/10 pt-5 text-[0.95rem] leading-relaxed">
                Our products are designed to help you present real experience more effectively. They
                cannot create experience, and they are not a substitute for your own judgement about
                what is true about your career.
              </p>
            </section>
          </div>
        </Container>
      </Section>
    </>
  );
}

export const Route = createFileRoute('/terms')({
  component: TermsPage,
  head,
});
