import { createFileRoute } from '@tanstack/react-router';
import { headFor } from '@/lib/head';

import { Compass, FileCheck2, Target, Users } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { LiquidHero } from '@/components/hero/liquid-hero';
import { BrandMark } from '@/components/brand/logo';
import { FinalCta } from '@/components/final-cta';
import { JsonLd } from '@/components/json-ld';
import { breadcrumbJsonLd, organizationJsonLd  } from '@/lib/seo';
import { brandPromise, brandTagline } from '@/content/marketing';

const head = () => headFor({
  title: 'About Acme Jobs — Better Opportunities Ahead.',
  description:
    'Acme Jobs was created around a simple problem: AI can help people improve applications, but without structure it often creates generic or exaggerated content.',
  path: '/about',
});

const focus = [
  {
    icon: FileCheck2,
    title: 'Real experience',
    description:
      'Everything starts from what you have genuinely done. We do not generate qualifications, metrics, tools or responsibilities you have not described to us.',
  },
  {
    icon: Target,
    title: 'Clear evidence',
    description:
      'Recommendations connect back to something you can name and defend. Missing evidence is reported as missing, not quietly filled in.',
  },
  {
    icon: Compass,
    title: 'Better targeting',
    description:
      'The right experience, presented for the right role. A job description is a brief, and it should be read as one.',
  },
  {
    icon: Users,
    title: 'Stronger preparation',
    description:
      'Interviews reward consistency between what you applied with and what you say. Our workflow keeps those two things aligned.',
  },
] as const;

function AboutPage() {
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ])}
      />

      <section className="relative isolate overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-36">
        <LiquidHero variant="hero" />
        <div
          aria-hidden="true"
          className="from-navy-950/88 via-navy-950/62 to-navy-950/28 absolute inset-0 bg-gradient-to-r"
        />
        <Container className="relative">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-16">
            <div className="max-w-2xl">
              <p className="text-brand-300 text-[0.72rem] font-bold tracking-[0.18em] uppercase">
                About
              </p>
              <h1 className="mt-4 text-[2.15rem] leading-[1.1] font-bold tracking-[-0.03em] text-white sm:text-[2.85rem]">
                {brandTagline}
              </h1>
              <p className="text-brand-100/85 mt-6 text-[1.0625rem] leading-relaxed sm:text-lg">
                Acme Jobs exists because AI can help people improve applications, but without
                structure it often produces generic or exaggerated content — and job seekers end up
                defending things they never did.
              </p>
            </div>

            <div className="rounded-[--radius-panel] border border-white/12 bg-white/[0.07] p-7 backdrop-blur-md">
              <BrandMark className="h-14 w-14" />
              <p className="mt-6 text-xl leading-snug font-bold text-white">{brandPromise}</p>
              <p className="text-brand-100/80 mt-4 text-[0.95rem] leading-relaxed">
                Not a slogan — a product rule. It is why every Acme Jobs workflow begins with your
                own evidence and ends with you approving what goes out.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <Section tone="white" aria-labelledby="story-heading">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <SectionHeading
                as="h2"
                id="story-heading"
                eyebrow="The origin"
                title="A simple problem, taken seriously"
              />
              <div className="text-ink-soft mt-6 space-y-5 text-[1.0625rem] leading-[1.75]">
                <p>
                  Almost everyone using AI in a job search hits the same wall. You paste in a
                  resume, ask for an improvement, and get back something polished, plausible and
                  slightly fictional. It reads well. It also gets you asked about a 40% improvement
                  that never happened.
                </p>
                <p>
                  The problem is not the tool. It is the absence of a system: no source of truth
                  about your experience, no requirement analysis, no check that the output is
                  actually supported by your history.
                </p>
                <p>
                  Acme Jobs was created to supply that missing system. The guides teach it in
                  writing. The app is being built to make it automatic — with the same rule enforced
                  in software.
                </p>
              </div>
            </div>

            <div className="border-navy-200 bg-navy-900 text-brand-100 rounded-[--radius-panel] border p-7 sm:p-8">
              <p className="text-brand-300 text-[0.75rem] font-bold tracking-[0.16em] uppercase">
                Our mission
              </p>
              <p className="mt-4 text-xl leading-snug font-bold text-white sm:text-2xl">
                Help job seekers make better use of what they already know and have done.
              </p>
              <p className="text-brand-100/75 mt-5 text-[0.95rem] leading-relaxed">
                Not help them become something they are not. Most candidates already have more
                relevant experience than they can articulate — the work is making it visible,
                specific and targeted.
              </p>
              <div className="mt-7 space-y-3 border-t border-white/10 pt-6">
                {[
                  'We do not invent experience, metrics or credentials.',
                  'We do not promise jobs, interviews or offers.',
                  'We do not invent ATS scores or success rates.',
                  'We do not publish fake reviews or customer counts.',
                ].map((line) => (
                  <p
                    key={line}
                    className="text-brand-100/80 flex items-start gap-2.5 text-[0.92rem]"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-brand-400 mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                    />
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="alt" aria-labelledby="focus-heading">
        <Container>
          <SectionHeading
            as="h2"
            id="focus-heading"
            align="center"
            eyebrow="What we focus on"
            title="Four things, consistently"
            description="Narrow focus is deliberate. It is what lets us be specific in a category full of vague claims."
          />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {focus.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.title}
                  className="border-line shadow-soft h-full rounded-[--radius-card] border bg-white p-6"
                >
                  <div className="from-brand-600 to-navy-700 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <h3 className="text-navy-900 mt-4 text-[1rem] font-bold">{item.title}</h3>
                  <p className="text-ink-soft mt-2 text-[0.9rem] leading-relaxed">
                    {item.description}
                  </p>
                </li>
              );
            })}
          </ul>

          <p className="border-line text-ink-soft shadow-soft mx-auto mt-12 max-w-2xl rounded-2xl border bg-white px-6 py-5 text-center text-[0.95rem] leading-relaxed">
            We have not published customer counts, review scores or press logos on this site,
            because we do not have real ones yet. Trust should come from what we refuse to claim.
          </p>
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}

export const Route = createFileRoute('/about')({
  component: AboutPage,
  head,
});
