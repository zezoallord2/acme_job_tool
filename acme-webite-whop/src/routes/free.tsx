import { createFileRoute } from '@tanstack/react-router';
import { headFor } from '@/lib/head';

import { Link } from '@/components/link';
import {
  Check,
  CircleHelp,
  Clock,
  FileSearch,
  MessageSquareQuote,
  RefreshCw,
  Sparkles,
  Target,
  Wand2,
} from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { Badge } from '@/components/ui/badge';
import { CtaLink } from '@/components/cta-link';
import { LiquidHero } from '@/components/hero/liquid-hero';
import { ProductVisual } from '@/components/product-visual';
import { WorkflowSteps } from '@/components/workflow-steps';
import { BeforeAfter } from '@/components/before-after';
import { FinalCta } from '@/components/final-cta';
import { JsonLd } from '@/components/json-ld';
import { breadcrumbJsonLd, productJsonLd  } from '@/lib/seo';
import { freeProduct } from '@/content/marketing';

const head = () => headFor({
  title: 'AI Job Search Starter Guide â€” Free',
  description:
    'Free AI job search starter guide: career snapshot, resume quick check, job description analysis, resume tailoring basics, STAR stories and a mock interview. No paid AI subscription needed.',
  path: '/free',
  imagePath: '/free/og.png',
});

const modules = [
  {
    icon: Sparkles,
    title: 'Career Snapshot',
    description:
      'Write down what you have genuinely done â€” roles, projects, responsibilities, tools and results â€” in one place. Everything later depends on this being accurate.',
    detail: 'Because AI cannot work from an empty or vague profile.',
  },
  {
    icon: FileSearch,
    title: 'Resume Quick Check',
    description:
      'A fast review of your current resume against four questions: is it specific, is it evidenced, is it targeted, and can you defend every line?',
    detail: 'You will leave with a short list of specific fixes, not a rewrite.',
  },
  {
    icon: Target,
    title: 'Job Description Analyzer',
    description:
      'Turn a real posting into a ranked list of what the role actually needs, including the expectations the posting implies but does not say.',
    detail: 'This is where you decide whether the role is worth your hours.',
  },
  {
    icon: Wand2,
    title: 'Resume Tailoring Basics',
    description:
      'Match your real evidence to the top requirements and rewrite only the bullets that matter for this one role.',
    detail: 'No invented metrics. If the evidence is missing, the guide says so.',
  },
  {
    icon: MessageSquareQuote,
    title: 'STAR Story Builder',
    description:
      'Build one strong Situationâ€“Taskâ€“Actionâ€“Result story from something that genuinely happened to you, with an honest result.',
    detail: 'One well-built story teaches you the pattern for all the others.',
  },
  {
    icon: CircleHelp,
    title: 'AI Mock Interview',
    description:
      'Five questions an interviewer is likely to ask about your experience, with a way to check whether your answers are specific or vague.',
    detail: 'The gap between how it feels and how it sounds is the lesson.',
  },
] as const;

function FreePage() {
  return (
    <>
      <JsonLd
        data={productJsonLd({
          name: `${freeProduct.name} â€” ${freeProduct.edition}`,
          description:
            'A free, practical introduction to using AI for career snapshotting, resume review, job description analysis, resume tailoring, STAR interview stories and a mock interview.',
          price: '0',
          priceCurrency: 'USD',
          path: '/free',
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Free Starter Guide', path: '/free' },
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
                {freeProduct.badge}
              </Badge>

              <h1 className="mt-6 text-[2.15rem] leading-[1.1] font-bold tracking-[-0.03em] text-white sm:text-[2.85rem]">
                {freeProduct.name}
                <span className="text-gradient-teal block">{freeProduct.headline}</span>
              </h1>

              <p className="text-brand-100/85 mt-6 max-w-xl text-[1.0625rem] leading-relaxed">
                {freeProduct.mainMessage}
              </p>

              <div className="mt-9 flex flex-col gap-3.5 sm:flex-row sm:items-center sm:gap-4">
                <CtaLink
                  intent="free"
                  size="xl"
                  className="w-full justify-center sm:w-auto"
                  data-testid="free-page-cta"
                >
                  {freeProduct.cta}
                </CtaLink>
                <a
                  href="#modules"
                  className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 text-base font-semibold text-white backdrop-blur-sm transition-colors duration-200 hover:border-white/60 hover:bg-white/15 sm:w-auto"
                >
                  See what is inside
                </a>
              </div>

              <p className="text-brand-100/70 mt-4 text-sm">
                {freeProduct.price} Â· {freeProduct.microcopy}
              </p>

              <ul className="text-brand-100/75 mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-6 text-sm">
                <li className="inline-flex items-center gap-2">
                  <Check aria-hidden="true" className="text-brand-400 h-4 w-4" />
                  Works with free AI tiers
                </li>
                <li className="inline-flex items-center gap-2">
                  <Check aria-hidden="true" className="text-brand-400 h-4 w-4" />
                  No account required
                </li>
                <li className="inline-flex items-center gap-2">
                  <Check aria-hidden="true" className="text-brand-400 h-4 w-4" />
                  Yours to keep
                </li>
              </ul>
            </div>

            <ProductVisual variant="free" />
          </div>
        </Container>
      </section>

      {/* What's inside */}
      <Section id="modules" tone="white" aria-labelledby="modules-heading">
        <Container>
          <SectionHeading
            as="h2"
            id="modules-heading"
            eyebrow="What you get"
            title="Six modules. One real application."
            description="The Starter Guide is deliberately small. It is built to be finished in an afternoon and applied immediately to a posting you actually want."
          />

          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module, index) => {
              const Icon = module.icon;
              return (
                <li key={module.title} className="h-full">
                  <div className="border-line shadow-soft hover:border-brand-300 hover:shadow-lift flex h-full flex-col rounded-[--radius-card] border bg-white p-6 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1">
                    <div className="flex items-center justify-between">
                      <div className="from-navy-800 to-navy-600 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </div>
                      <span className="text-ink-muted text-[0.75rem] font-bold tracking-[0.12em]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="text-navy-900 mt-4 text-[1.02rem] font-bold tracking-[-0.015em]">
                      {module.title}
                    </h3>
                    <p className="text-ink-soft mt-2 flex-1 text-[0.92rem] leading-relaxed">
                      {module.description}
                    </p>
                    <p className="border-line-soft text-brand-800 mt-4 border-t pt-3.5 text-[0.82rem] leading-relaxed">
                      {module.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>

      {/* Workflow band */}
      <Section
        tone="navy"
        className="relative overflow-hidden"
        aria-labelledby="workflow-band-heading"
      >
        <div aria-hidden="true" className="grain-overlay absolute inset-0" />
        <Container className="relative">
          <SectionHeading
            as="h2"
            id="workflow-band-heading"
            align="center"
            tone="light"
            eyebrow="Bonus module"
            title={freeProduct.workflow}
            description="A repeatable thirty-minute sequence that turns a job posting into a finished application â€” the part most people skip, and the part that makes the biggest difference."
          />
          <ol className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { t: '0â€“5 min', d: 'Snapshot' },
              { t: '5â€“12 min', d: 'Analyse the job' },
              { t: '12â€“20 min', d: 'Match evidence' },
              { t: '20â€“27 min', d: 'Tailor the top three bullets' },
              { t: '27â€“30 min', d: 'Claim check and send' },
            ].map((step) => (
              <li
                key={step.t}
                className="rounded-xl border border-white/12 bg-white/[0.06] p-4 text-center backdrop-blur-sm"
              >
                <p className="text-brand-300 text-[0.75rem] font-bold tracking-[0.1em] uppercase">
                  {step.t}
                </p>
                <p className="mt-1.5 text-[0.9rem] font-semibold text-white">{step.d}</p>
              </li>
            ))}
          </ol>
          <p className="text-brand-100/70 mx-auto mt-8 flex max-w-2xl items-center justify-center gap-2 text-center text-sm">
            <Clock aria-hidden="true" className="text-brand-400 h-4 w-4 shrink-0" />
            Run it on one role first. The {freeProduct.edition} is enough to know whether the method
            works for you.
          </p>
        </Container>
      </Section>

      <WorkflowSteps />
      <BeforeAfter />

      {/* Upgrade path */}
      <Section tone="gradient-light" aria-labelledby="upgrade-heading">
        <Container>
          <div className="border-line shadow-soft grid gap-8 rounded-[--radius-panel] border bg-white p-6 sm:p-9 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
            <div>
              <p className="text-brand-800 flex items-center gap-2 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                When you need more
              </p>
              <h2
                id="upgrade-heading"
                className="text-navy-900 mt-3 text-[1.6rem] leading-tight font-bold tracking-[-0.025em] sm:text-[2rem]"
              >
                Ready for the full system?
              </h2>
              <p className="text-ink-soft mt-4 max-w-xl text-base leading-relaxed">
                If you are applying to several roles, the Starter Guide will run out. The Complete
                Edition adds a Career Master Profile, achievement mining, deep job analysis, cover
                letters, application answers, LinkedIn positioning, a full STAR story bank and
                advanced interview preparation.
              </p>
              <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                {[
                  'Career Master Profile',
                  'Achievement mining',
                  'Deep job analysis',
                  'Full STAR story bank',
                  'Cover letter workflow',
                  'Advanced interview prep',
                ].map((item) => (
                  <li
                    key={item}
                    className="text-navy-900 flex items-center gap-2.5 text-[0.9rem] font-medium"
                  >
                    <Check aria-hidden="true" className="text-brand-600 h-4 w-4 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <CtaLink
                  intent="complete"
                  size="lg"
                  variant="primary"
                  className="w-full justify-center sm:w-auto"
                >
                  Explore Complete Edition
                </CtaLink>
                <Link
                  href="/complete#compare"
                  className="text-navy-800 hover:text-brand-800 inline-flex h-11 items-center justify-center rounded-full px-2 text-sm font-semibold underline underline-offset-4"
                >
                  Compare free vs complete
                </Link>
              </div>
            </div>
            <div className="border-brand-200 bg-brand-50 rounded-2xl border p-6">
              <p className="text-brand-800 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
                Our honest advice
              </p>
              <p className="text-navy-900 mt-3 text-[0.98rem] leading-relaxed font-semibold">
                Use the free guide on one real job application first.
              </p>
              <p className="text-ink-soft mt-2.5 text-[0.9rem] leading-relaxed">
                If the method produces a clearer application and you feel more prepared for the
                interview, the Complete Edition is worth buying. If not, we would rather you did not
                spend the money.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}

export const Route = createFileRoute('/free')({
  component: FreePage,
  head,
});
