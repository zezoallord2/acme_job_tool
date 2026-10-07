import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { workflowSteps } from '@/content/marketing';

export function WorkflowSteps() {
  return (
    <Section tone="light" aria-labelledby="workflow-heading">
      <Container>
        <SectionHeading
          as="h2"
          id="workflow-heading"
          align="center"
          eyebrow="How it works"
          title="The same five steps, every time."
          description="This is the spine of Acme Jobs. It works for a career-changer applying to a role they have never done, and for a graduate improving their first application."
        />

        <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          {workflowSteps.map((step, index) => (
            <li key={step.number} className="relative">
              <div className="group border-line shadow-soft hover:border-brand-300 hover:shadow-lift h-full rounded-[--radius-card] border bg-white p-5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <span className="from-navy-800 to-navy-600 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-base font-bold text-white">
                    {step.number}
                  </span>
                  {index < workflowSteps.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="from-brand-300 hidden h-px w-full max-w-6 translate-x-3 bg-gradient-to-r to-transparent lg:block"
                    />
                  ) : null}
                </div>
                <h3 className="text-navy-900 mt-4 text-[1rem] font-bold tracking-[-0.015em]">
                  {step.title}
                </h3>
                <p className="text-ink-soft mt-2 text-[0.88rem] leading-relaxed">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="text-ink-soft mx-auto mt-10 max-w-2xl text-center text-[0.95rem] leading-relaxed">
          Steps 1 and 5 are what turn a one-off improvement into a system. Everything in between
          exists to keep your application honest.
        </p>
      </Container>
    </Section>
  );
}

export default WorkflowSteps;
