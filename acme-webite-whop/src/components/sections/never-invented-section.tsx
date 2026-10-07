import { ShieldCheck, Layers, UserCog } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { Card } from '@/components/ui/card';
import { neverInvented, neverInventedHeadline } from '@/content/marketing';

const icons = [ShieldCheck, Layers, UserCog] as const;

export function NeverInventedSection() {
  return (
    <Section
      tone="navy"
      className="grain-overlay relative overflow-hidden"
      aria-labelledby="never-invented-heading"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_0%,rgba(17,142,148,0.28),transparent_70%)]"
      />
      <Container className="relative">
        <SectionHeading
          as="h2"
          align="center"
          tone="light"
          eyebrow="Our rule"
          title={neverInventedHeadline}
          description="AI is very good at making weak experience sound impressive. The problem is that interviewers ask follow-up questions, and the fabrication collapses on contact."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {neverInvented.map((item, index) => {
            const Icon = icons[index] ?? ShieldCheck;
            return (
              <div
                key={item.title}
                className="hover:border-brand-400/40 rounded-[--radius-panel] border border-white/12 bg-white/[0.06] p-6 backdrop-blur-sm transition-colors duration-300 hover:bg-white/[0.09] sm:p-7"
              >
                <div className="from-brand-500 to-brand-700 shadow-glow flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </div>
                <h3 className="text-brand-300 mt-5 text-[0.75rem] font-bold tracking-[0.16em] uppercase">
                  {item.title}
                </h3>
                <p className="text-brand-100/85 mt-2.5 text-[0.95rem] leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        <Card className="border-brand-400/30 mt-10 bg-white p-6 text-center sm:p-8">
          <p className="text-navy-900 text-lg leading-snug font-bold sm:text-xl">
            Missing evidence is better than invented evidence.
          </p>
          <p className="text-ink-soft mx-auto mt-3 max-w-2xl text-[0.95rem] leading-relaxed">
            A gap in your resume gets you a question. A fabricated metric gets you a question you
            cannot answer — and it costs you the interview.
          </p>
        </Card>
      </Container>
    </Section>
  );
}

export default NeverInventedSection;
