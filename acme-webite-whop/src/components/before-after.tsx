import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { beforeAfter } from '@/content/marketing';
import { ArrowRight, Info } from 'lucide-react';

export function BeforeAfter() {
  return (
    <Section tone="alt" aria-labelledby="before-after-heading">
      <Container>
        <SectionHeading
          as="h2"
          id="before-after-heading"
          align="center"
          eyebrow="Workflow comparison"
          title="What actually changes"
          description="This compares process, not outcomes. Nobody can promise you a job — but a structured application is measurably easier to review than a generic one."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <div className="border-line rounded-[--radius-panel] border bg-white p-6 sm:p-8">
            <p className="text-ink-muted text-[0.75rem] font-bold tracking-[0.14em] uppercase">
              Before · unstructured AI
            </p>
            <ul className="mt-6 space-y-3.5">
              {beforeAfter.before.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-navy-300 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  />
                  <span className="text-ink-soft text-[0.95rem] leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-brand-300 from-brand-50 relative rounded-[--radius-panel] border bg-gradient-to-b to-white p-6 sm:p-8">
            <p className="text-brand-800 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
              After · Acme Jobs workflow
            </p>
            <ul className="mt-6 space-y-3.5">
              {beforeAfter.after.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <ArrowRight aria-hidden="true" className="text-brand-600 mt-1 h-4 w-4 shrink-0" />
                  <span className="text-navy-900 text-[0.95rem] leading-relaxed font-medium">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="border-line text-ink-muted mt-6 flex items-start justify-center gap-2 rounded-xl border bg-white px-4 py-3.5 text-center text-[0.85rem] leading-relaxed">
          <Info aria-hidden="true" className="text-navy-500 mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="text-ink-soft font-semibold">{beforeAfter.label}.</strong>{' '}
            {beforeAfter.disclaimer}
          </span>
        </p>
      </Container>
    </Section>
  );
}

export default BeforeAfter;
