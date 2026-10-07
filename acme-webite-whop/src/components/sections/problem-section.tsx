import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/section-heading';
import { methodology, problemHeadline, problems } from '@/content/marketing';
import { AlertTriangle } from 'lucide-react';

export function ProblemSection() {
  return (
    <section
      id="problem"
      className="relative bg-white py-16 sm:py-20 lg:py-28"
      aria-labelledby="problem-heading"
    >
      <div className="mx-auto w-full max-w-[78rem] px-5 sm:px-8">
        <SectionHeading
          as="h2"
          id="problem-heading"
          eyebrow="The problem"
          title={<span id="problem-heading-text">{problemHeadline}</span>}
          description="Almost everyone using AI for their job search hits the same wall. None of it is your fault — you were given a powerful tool and a set of disconnected prompts."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((problem) => (
            <Card key={problem.title} interactive className="h-full p-5 sm:p-6">
              <div className="bg-navy-50 text-navy-700 flex h-9 w-9 items-center justify-center rounded-xl">
                <AlertTriangle aria-hidden="true" className="h-[1.05rem] w-[1.05rem]" />
              </div>
              <h3 className="text-navy-900 mt-4 text-[0.98rem] font-bold tracking-[-0.015em]">
                {problem.title}
              </h3>
              <p className="text-ink-soft mt-2 text-[0.9rem] leading-relaxed">
                {problem.description}
              </p>
            </Card>
          ))}
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          <Card className="border-navy-200 bg-navy-900 text-brand-100 p-6 sm:p-7">
            <p className="text-brand-300 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
              What usually happens
            </p>
            <p className="mt-3 text-lg leading-snug font-semibold text-white">
              You paste your resume into a chatbot, ask it to “make it better”, and get back
              something polished, plausible and slightly fictional.
            </p>
            <p className="text-brand-100/75 mt-3 text-[0.92rem] leading-relaxed">
              Then the interview asks about the 40% improvement that never happened. The tool was
              not the problem. The missing system was.
            </p>
          </Card>

          <Card className="border-brand-200 bg-brand-100 p-6 sm:p-7">
            <p className="text-brand-800 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
              What changes with a system
            </p>
            <p className="text-navy-900 mt-3 text-lg leading-snug font-semibold">
              You keep one source of truth about your real experience, and every output is checked
              against it.
            </p>
            <p className="text-ink-soft mt-3 text-[0.92rem] leading-relaxed">
              That is the entire Acme Jobs difference, and it is what the rest of this page
              explains.
            </p>
          </Card>
        </div>

        <p className="sr-only">{methodology.statement}</p>
      </div>
    </section>
  );
}

export default ProblemSection;
