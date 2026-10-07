import { createFileRoute } from '@tanstack/react-router';
import { headFor } from '@/lib/head';

import { Link } from '@/components/link';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { WorkflowSteps } from '@/components/workflow-steps';
import { MethodSection } from '@/components/sections/method-section';
import { NeverInventedSection } from '@/components/sections/never-invented-section';
import { FaqSection } from '@/components/faq-accordion';
import { FinalCta } from '@/components/final-cta';
import { JsonLd } from '@/components/json-ld';
import { breadcrumbJsonLd, faqJsonLd  } from '@/lib/seo';
import { faqsForJsonLd } from '@/content/faq';

const head = () => headFor({
  title: 'How It Works — The Acme Jobs Method',
  description:
    'The five-step Acme Jobs workflow: capture what is real, understand the job, match your evidence, build the application, and repeat the system across every role.',
  path: '/how-it-works',
});

const steps = [
  {
    number: '1',
    title: "Tell us what's real",
    description: 'Build career information from your actual experience.',
    detail:
      'Everything starts with a plain, accurate record of what you have done. If this step is vague, every later step is vague. AI helps you organise and clarify — it does not supply the facts.',
    watchOut:
      'The most common mistake is writing a summary instead of a record. Include the unglamorous work: the projects that stalled, the processes you inherited, the customers who complained.',
  },
  {
    number: '2',
    title: 'Understand the job',
    description: 'Break the job description down into what really matters in this role.',
    detail:
      'A posting is a compressed brief. Extract hard requirements, preferences and the expectations they imply, then decide whether the role is worth your hours.',
    watchOut:
      'Do not skip straight to editing your resume against the posting. Reading is the step that tells you which parts of your experience to emphasise.',
  },
  {
    number: '3',
    title: 'Match your evidence',
    description:
      'Identify the experience, skills and results that genuinely support those requirements.',
    detail:
      'This is where honesty is structural rather than aspirational. Matching produces an explicit list of gaps, and gaps can be addressed — reframed, acknowledged, or treated as reasons not to apply.',
    watchOut:
      'If a requirement has no supporting evidence in your history, do not let a model fill the gap. Missing evidence is a decision point, not a writing problem.',
  },
  {
    number: '4',
    title: 'Build the application',
    description: 'Improve your resume, your answers and your interview preparation together.',
    detail:
      'Resume bullets, cover letter, application form answers and interview stories are all drawn from the same evidence. That is why they stop contradicting each other.',
    watchOut:
      'Treat AI output as a first draft. Read every sentence aloud, then verify every claim. If you cannot defend it in an interview, it does not go in.',
  },
  {
    number: '5',
    title: 'Repeat the system',
    description: 'Use the same structured approach for future applications.',
    detail:
      'Your evidence stays; the analysis and tailoring are rebuilt per role. This is the step that turns a one-off improvement into something that compounds across a whole search.',
    watchOut:
      'Keep a single master version of your career information. Duplicated and drifting resumes are how people end up unable to say what they claimed.',
  },
] as const;

function HowItWorksPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'How it works', path: '/how-it-works' },
        ])}
      />
      <JsonLd
        data={faqJsonLd(
          faqsForJsonLd().filter((item) =>
            /evidence|generic|fake|STAR|multiple jobs|interview/i.test(item.question)
          )
        )}
      />

      <section className="bg-navy-900 relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(85%_70%_at_15%_0%,rgba(17,142,148,0.28),transparent_65%)]"
        />
        <div aria-hidden="true" className="grain-overlay absolute inset-0" />
        <Container className="relative">
          <div className="max-w-3xl">
            <p className="text-brand-300 text-[0.72rem] font-bold tracking-[0.18em] uppercase">
              How it works
            </p>
            <h1 className="mt-4 text-[2.15rem] leading-[1.1] font-bold tracking-[-0.03em] text-white sm:text-[2.85rem]">
              A repeatable method, not a bag of prompts.
            </h1>
            <p className="text-brand-100/85 mt-6 text-[1.0625rem] leading-relaxed sm:text-lg">
              Five steps. Run them in order for every role. The method works for a graduate writing
              their first application and for a director repositioning after fifteen years in one
              industry — the only difference is the evidence available at step one.
            </p>
            <div className="mt-9 flex flex-col gap-3.5 sm:flex-row sm:gap-4">
              <Link
                href="/free"
                className="from-brand-600 to-brand-500 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r px-7 text-base font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 sm:w-auto"
              >
                Start free
              </Link>
              <Link
                href="/resources/how-to-tailor-a-resume-with-ai-without-lying"
                className="inline-flex h-13 w-full items-center justify-center rounded-full border border-white/30 bg-white/10 px-7 text-base font-semibold text-white backdrop-blur-sm transition-colors duration-200 hover:border-white/60 hover:bg-white/15 sm:w-auto"
              >
                Read the free guide on tailoring
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <Section tone="white" aria-labelledby="steps-heading">
        <Container>
          <SectionHeading
            as="h2"
            id="steps-heading"
            eyebrow="The five steps"
            title="What each step actually involves"
            description="Including the part most guides leave out: what goes wrong at each stage, and what to do instead."
          />

          <ol className="mt-12 space-y-5">
            {steps.map((step) => (
              <li
                key={step.number}
                className="border-line shadow-soft grid gap-5 rounded-[--radius-panel] border bg-white p-6 sm:p-8 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-8"
              >
                <div className="flex items-start gap-4 lg:flex-col lg:items-center lg:gap-3">
                  <span className="from-navy-800 to-navy-600 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-lg font-bold text-white">
                    {step.number}
                  </span>
                  <span aria-hidden="true" className="bg-line hidden h-10 w-px lg:block" />
                </div>

                <div>
                  <h3 className="text-navy-900 text-[1.15rem] font-bold tracking-[-0.02em]">
                    {step.title}
                  </h3>
                  <p className="text-brand-800 mt-1.5 text-[0.95rem] font-semibold">
                    {step.description}
                  </p>
                  <p className="text-ink-soft mt-4 text-[0.95rem] leading-relaxed">{step.detail}</p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                  <p className="text-[0.75rem] font-bold tracking-[0.14em] text-amber-800 uppercase">
                    Watch out
                  </p>
                  <p className="mt-2 text-[0.9rem] leading-relaxed text-amber-950">
                    {step.watchOut}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <WorkflowSteps />
      <MethodSection />
      <NeverInventedSection />
      <FaqSection />
      <FinalCta />
    </>
  );
}

export const Route = createFileRoute('/how-it-works')({
  component: HowItWorksPage,
  head,
});
