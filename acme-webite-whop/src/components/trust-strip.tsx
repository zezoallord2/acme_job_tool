import { CheckCircle2 } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { trustStrip } from '@/content/marketing';

export function TrustStrip({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark';
  return (
    <Section
      tone={dark ? 'navy' : 'light'}
      className={dark ? 'py-10 sm:py-12' : 'border-line-soft border-y py-10 sm:py-12'}
    >
      <Container>
        <ul
          className={`grid gap-4 sm:grid-cols-3 sm:gap-6 ${dark ? 'text-brand-100' : 'text-navy-800'}`}
        >
          {trustStrip.map((item) => (
            <li key={item} className="flex items-center justify-center gap-2.5 text-center">
              <CheckCircle2
                aria-hidden="true"
                className={`h-[1.15rem] w-[1.15rem] shrink-0 ${dark ? 'text-brand-300' : 'text-brand-600'}`}
              />
              <span className="text-[0.92rem] font-semibold tracking-[-0.01em]">{item}</span>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

export default TrustStrip;
