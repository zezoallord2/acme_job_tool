import { ArrowRight, ArrowDown } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { methodology, methodHeadline } from '@/content/marketing';

function FlowColumn({
  title,
  items,
  tone,
}: {
  title: string;
  items: readonly string[];
  tone: 'muted' | 'accent';
}) {
  const accent = tone === 'accent';
  return (
    <div
      className={`rounded-[--radius-panel] border p-6 sm:p-7 ${
        accent ? 'border-brand-300 bg-brand-100/80' : 'border-line bg-white'
      }`}
    >
      <p
        className={`text-[0.75rem] font-bold tracking-[0.14em] uppercase ${
          accent ? 'text-brand-800' : 'text-ink-muted'
        }`}
      >
        {title}
      </p>
      <ol className="mt-5 space-y-2.5">
        {items.map((item, index) => (
          <li
            key={item}
            className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-[0.92rem] leading-snug font-semibold ${
              accent
                ? 'border-brand-200 text-navy-900 bg-white'
                : 'border-line-soft bg-canvas-alt text-ink-soft'
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-bold ${
                accent ? 'bg-brand-600 text-white' : 'bg-navy-100 text-navy-700'
              }`}
            >
              {index + 1}
            </span>
            {item}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function MethodSection() {
  return (
    <Section tone="alt" className="relative overflow-hidden" aria-labelledby="method-heading">
      <div
        aria-hidden="true"
        className="bg-brand-200/50 absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl"
      />
      <Container className="relative">
        <SectionHeading
          as="h2"
          eyebrow="The Acme Jobs difference"
          title={methodHeadline}
          description="Generic AI starts from the document. Acme Jobs starts from your life. Everything after that — the analysis, the tailoring, the interview prep — is built from evidence you can actually defend."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-4">
          <FlowColumn title="Generic AI workflow" items={methodology.generic} tone="muted" />

          <div className="flex items-center justify-center py-2 lg:py-0">
            <span
              aria-hidden="true"
              className="border-line text-navy-700 shadow-soft flex h-11 w-11 rotate-90 items-center justify-center rounded-full border bg-white lg:rotate-0"
            >
              <ArrowRight className="h-5 w-5" />
            </span>
          </div>

          <FlowColumn title="Acme Jobs workflow" items={methodology.acme} tone="accent" />
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <ArrowDown aria-hidden="true" className="text-brand-600 hidden h-5 w-5 sm:block" />
          <p className="text-navy-900 max-w-3xl text-xl leading-snug font-bold sm:text-2xl lg:text-[1.75rem]">
            “{methodology.statement}”
          </p>
          <p className="text-ink-soft max-w-2xl text-[0.95rem] leading-relaxed">
            That single rule is why every Acme Jobs workflow starts with evidence and ends with a
            conversation you are prepared for.
          </p>
        </div>
      </Container>
    </Section>
  );
}

export default MethodSection;
