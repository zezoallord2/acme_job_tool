import { createFileRoute } from '@tanstack/react-router';
import { headFor } from '@/lib/head';

import { Boxes, Layers, ShieldCheck, Sparkles, Sparkle, Workflow } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { Badge } from '@/components/ui/badge';
import { ComingSoon } from '@/components/coming-soon';
import { FinalCta } from '@/components/final-cta';
import { JsonLd } from '@/components/json-ld';
import { breadcrumbJsonLd  } from '@/lib/seo';
import { upcomingApp } from '@/content/marketing';

const head = () => headFor({
  title: 'The Acme Jobs App Is Coming',
  description:
    'Acme Jobs is becoming an interactive platform: Career Evidence, Job Analyzer, Claim Inspector, Resume Workspace, Interview Command Center and Application Tracker. Join the early access list.',
  path: '/app',
  imagePath: '/app/og.png',
});

const icons = [Layers, Workflow, ShieldCheck, Sparkle, Sparkles, Boxes] as const;

function AppPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Acme Jobs App', path: '/app' },
        ])}
      />

      <section className="relative isolate overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-36">
        <div
          aria-hidden="true"
          className="from-navy-950 via-navy-900 to-brand-900 absolute inset-0 bg-gradient-to-br"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(70%_60%_at_20%_10%,rgba(36,195,200,0.28),transparent_65%)]"
        />
        <div aria-hidden="true" className="grain-overlay absolute inset-0 opacity-[0.16]" />

        <Container className="relative">
          <div className="max-w-3xl">
            <Badge variant="light" size="md">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              {upcomingApp.badge}
            </Badge>
            <h1 className="mt-6 text-[2.15rem] leading-[1.1] font-bold tracking-[-0.03em] text-white sm:text-[2.85rem]">
              Acme Jobs is becoming more than a guide.
            </h1>
            <p className="text-brand-100/85 mt-6 text-[1.0625rem] leading-relaxed sm:text-lg">
              The guides taught the method. The app will make it automatic. We are turning the Acme
              Jobs methodology into an interactive platform â€” one that keeps your evidence central
              and refuses to invent anything on your behalf.
            </p>

            <div className="mt-9 flex flex-col gap-3.5 sm:flex-row sm:gap-4">
              <a
                href="#early-access"
                className="from-brand-600 to-brand-500 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r px-7 text-base font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 sm:w-auto"
              >
                Join the early access list
              </a>
              <a
                href="/free"
                className="inline-flex h-13 w-full items-center justify-center rounded-full border border-white/30 bg-white/10 px-7 text-base font-semibold text-white backdrop-blur-sm transition-colors duration-200 hover:border-white/60 hover:bg-white/15 sm:w-auto"
              >
                Use the method today, free
              </a>
            </div>

            <p className="text-brand-100/70 mt-6 flex items-center gap-2 text-sm">
              <ShieldCheck aria-hidden="true" className="text-brand-400 h-4 w-4 shrink-0" />
              No launch date has been announced. We would rather be late and honest.
            </p>
          </div>
        </Container>
      </section>

      <Section tone="white" aria-labelledby="capabilities-heading">
        <Container>
          <SectionHeading
            as="h2"
            id="capabilities-heading"
            eyebrow="Capabilities in development"
            title="What the app will do"
            description="Each capability exists to remove one specific failure mode from the manual workflow."
          />

          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingApp.cards.map((card, index) => {
              const Icon = icons[index] ?? Sparkles;
              return (
                <li
                  key={card.title}
                  className="border-line shadow-soft hover:border-brand-300 hover:shadow-lift flex h-full flex-col rounded-[--radius-card] border bg-white p-6 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="from-brand-600 to-navy-700 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <span className="bg-navy-50 text-navy-700 rounded-full px-2.5 py-1 text-[0.75rem] font-bold tracking-[0.1em] uppercase">
                      In dev
                    </span>
                  </div>
                  <h3 className="text-navy-900 mt-4 text-[1.02rem] font-bold tracking-[-0.015em]">
                    {card.title}
                  </h3>
                  <p className="text-ink-soft mt-2 text-[0.92rem] leading-relaxed">
                    {card.description}
                  </p>
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>

      <Section tone="alt" aria-labelledby="principles-heading">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
            <div>
              <SectionHeading
                as="h2"
                id="principles-heading"
                eyebrow="Non-negotiable"
                title="The app will still refuse to invent things."
                description="Automation is exactly how fabricated experience becomes normal. The product rule is unchanged from the guides: nothing enters your application unless your own evidence supports it."
              />
            </div>
            <ul className="space-y-4">
              {[
                {
                  t: 'You approve every change',
                  d: 'Suggestions are drafts. Nothing is written into an application without your explicit confirmation.',
                },
                {
                  t: 'Every claim is traceable',
                  d: 'Each suggested line points back to the part of your Career Evidence Profile that supports it.',
                },
                {
                  t: 'Unsupported claims get flagged',
                  d: 'If a draft asserts something your profile cannot back, the app tells you instead of smoothing it over.',
                },
                {
                  t: 'Your data stays yours',
                  d: 'Export and delete are first-class features, not a support request.',
                },
              ].map((item) => (
                <li
                  key={item.t}
                  className="border-line shadow-soft rounded-[--radius-card] border bg-white p-5"
                >
                  <p className="text-navy-900 flex items-center gap-2.5 text-[0.98rem] font-bold">
                    <ShieldCheck
                      aria-hidden="true"
                      className="text-brand-600 h-4.5 w-4.5 shrink-0"
                    />
                    {item.t}
                  </p>
                  <p className="text-ink-soft mt-2 pl-7 text-[0.92rem] leading-relaxed">{item.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      <ComingSoon />
      <FinalCta />
    </>
  );
}

export const Route = createFileRoute('/app')({
  component: AppPage,
  head,
});
