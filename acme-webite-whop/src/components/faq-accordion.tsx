import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { faqs } from '@/content/faq';
import { cn } from '@/lib/utils';

interface FaqAccordionProps {
  items?: typeof faqs;
  /** Render a compact variant for use inside a page hero. */
  className?: string;
  defaultOpen?: string;
}

export function FaqAccordion({ items = faqs, className, defaultOpen }: FaqAccordionProps) {
  return (
    <div className={cn('w-full', className)}>
      <Accordion type="single" collapsible defaultValue={defaultOpen} className="space-y-3">
        {items.map((item) => (
          <AccordionItem key={item.question} value={item.question}>
            <AccordionTrigger>
              <span className="flex flex-col gap-1">
                {item.question}
                <span className="text-brand-700 text-[0.75rem] font-bold tracking-[0.12em] uppercase">
                  {item.group}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

interface FaqSectionProps {
  eyebrow?: string;
  title?: string;
  description?: string;
}

export function FaqSection({
  eyebrow = 'FAQ',
  title = 'Questions people actually ask.',
  description = 'Straight answers, including the ones that are less flattering than the marketing version.',
}: FaqSectionProps) {
  return (
    <section id="faq" className="bg-white py-16 sm:py-20 lg:py-24" aria-labelledby="faq-heading">
      <Container>
        <SectionHeading
          as="h2"
          id="faq-heading"
          align="center"
          eyebrow={eyebrow}
          title={title}
          description={description}
        />
        <FaqAccordion className="mx-auto mt-12 max-w-3xl" />
      </Container>
    </section>
  );
}

export default FaqAccordion;
