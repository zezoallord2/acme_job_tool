import { createFileRoute } from '@tanstack/react-router';
import { headFor } from '@/lib/head';

import { Container, Section } from '@/components/ui/container';
import { JsonLd } from '@/components/json-ld';
import { breadcrumbJsonLd  } from '@/lib/seo';

const head = () => headFor({
  title: 'Privacy Policy',
  description:
    'How Acme Jobs handles information submitted through this website, including early-access email signups and analytics. No advertising cookies.',
  path: '/privacy',
});

const sections = [
  {
    heading: 'What we collect',
    blocks: [
      'Information you give us directly. If you join the early-access list we store your email address, the page you signed up from, and the referring site if there was one. Nothing else is requested.',
      'Aggregate analytics. If analytics are enabled, we record which pages are viewed and which calls to action are clicked. We do not use advertising cookies, cross-site tracking or fingerprinting, and we do not build behavioural profiles.',
      'Technical data delivered automatically by your browser, such as browser type and approximate region, used only to keep the site working.',
    ],
  },
  {
    heading: 'Why we collect it',
    blocks: [
      'To operate the early-access list and to email you when the Acme Jobs app becomes available.',
      'To understand which pages and resources are genuinely useful, so we can improve them.',
      'To detect and prevent abuse of the waitlist endpoint.',
    ],
  },
  {
    heading: 'AI providers and your content',
    blocks: [
      'This website does not send your personal information to any AI provider. The Acme Jobs products are self-guided material that you use with whichever AI assistant you choose — in that case, your chosen provider’s own terms apply to anything you paste into it.',
      'The Acme Jobs app is in development. Its data-handling commitments will be published before it launches.',
    ],
  },
  {
    heading: 'Payments',
    blocks: [
      'Purchases are processed by our payment provider. We receive the transaction details needed to deliver your purchase and to handle refunds or support requests. We never see or store your full card details.',
      'Prices shown on this site are display prices. The final amount charged is confirmed at checkout.',
    ],
  },
  {
    heading: 'Cookies',
    blocks: [
      'This site does not set advertising or tracking cookies. If privacy-friendly analytics are enabled, they rely on cookieless measurement.',
    ],
  },
  {
    heading: 'Your rights',
    blocks: [
      'You can ask to see, correct or delete the information we hold about you, and you can withdraw from the early-access list at any time using the unsubscribe link in any email, or by contacting us directly.',
      'We will action legitimate requests promptly and free of charge.',
    ],
  },
  {
    heading: 'Retention and security',
    blocks: [
      'Early-access emails are kept until you unsubscribe or until the app launches, after which we delete the list. Analytics are kept in aggregate form.',
      'We apply reasonable technical safeguards. No system is perfectly secure, and we will not claim otherwise.',
    ],
  },
  {
    heading: 'Changes to this policy',
    blocks: [
      'If this policy changes materially, we will update the date below and, where the change affects you, mention it in the relevant email or on this page.',
    ],
  },
  {
    heading: 'Contact',
    blocks: ['For privacy questions or requests, email hello@acmejobs.co. We answer.'],
  },
] as const;

function PrivacyPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Privacy', path: '/privacy' },
        ])}
      />
      <Section tone="white" className="pt-28 sm:pt-32">
        <Container>
          <div className="mx-auto max-w-[46rem]">
            <p className="text-brand-700 text-[0.72rem] font-bold tracking-[0.18em] uppercase">
              Legal
            </p>
            <h1 className="text-navy-900 mt-4 text-[2.15rem] leading-[1.12] font-bold tracking-[-0.03em]">
              Privacy Policy
            </h1>
            <p className="text-ink-muted mt-4 text-sm">
              Last updated: 1 March 2026 · Applies to acmejobs.co and its pages
            </p>

            <div className="mt-10 space-y-9">
              {sections.map((section) => (
                <section key={section.heading} aria-labelledby={`privacy-${section.heading}`}>
                  <h2
                    id={`privacy-${section.heading}`}
                    className="text-navy-900 text-[1.3rem] font-bold tracking-[-0.02em]"
                  >
                    {section.heading}
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {section.blocks.map((block) => (
                      <li
                        key={block}
                        className="text-ink-soft flex items-start gap-3.5 text-[1rem] leading-[1.75]"
                      >
                        <span
                          aria-hidden="true"
                          className="bg-brand-500 mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        />
                        {block}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
  head,
});
