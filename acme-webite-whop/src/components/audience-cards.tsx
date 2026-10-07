import { GraduationCap, Search, Shuffle, Sparkles, Target } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { Card } from '@/components/ui/card';
import { audiences, audienceHeadline } from '@/content/marketing';

const iconMap = {
  graduation: GraduationCap,
  shuffle: Shuffle,
  search: Search,
  target: Target,
  sparkles: Sparkles,
} as const;

export function AudienceCards() {
  return (
    <Section tone="light" aria-labelledby="audience-heading">
      <Container>
        <SectionHeading
          as="h2"
          id="audience-heading"
          eyebrow="Who this is for"
          title={audienceHeadline}
          description="If you have ever felt that your application was technically fine but somehow not landing, the problem is usually evidence and targeting — not effort."
        />

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map((audience) => {
            const Icon = iconMap[audience.icon] ?? Sparkles;
            return (
              <Card key={audience.title} interactive className="h-full p-6">
                <div className="from-navy-800 to-navy-600 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </div>
                <h3 className="text-navy-900 mt-4 text-[1.02rem] font-bold tracking-[-0.015em]">
                  {audience.title}
                </h3>
                <p className="text-ink-soft mt-2 text-[0.92rem] leading-relaxed">
                  {audience.description}
                </p>
              </Card>
            );
          })}

          <Card className="border-brand-300 bg-brand-100/70 h-full p-6">
            <p className="text-brand-800 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
              Not sure it fits?
            </p>
            <p className="text-navy-900 mt-3 text-[0.95rem] leading-relaxed">
              If you are applying for work and using AI to help, the method applies. Start with the
              free guide and see.
            </p>
            <a
              href="/free"
              className="text-brand-900 hover:text-navy-900 mt-4 inline-flex items-center gap-1.5 text-sm font-bold underline underline-offset-4"
            >
              Start free
            </a>
          </Card>
        </ul>
      </Container>
    </Section>
  );
}

export default AudienceCards;
