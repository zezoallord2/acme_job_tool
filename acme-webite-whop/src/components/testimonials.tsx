import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { Card } from '@/components/ui/card';

/**
 * ---------------------------------------------------------------------------
 * Testimonial architecture
 * ---------------------------------------------------------------------------
 * The component, the section and the data contract all exist so that when real
 * testimonials arrive they can be dropped in without redesigning anything.
 *
 * `TESTIMONIALS` is intentionally EMPTY. There are no invented names, no stock
 * photos, no fabricated star ratings and no invented job titles anywhere in this
 * project — until genuine, attributable reviews exist, Acme Jobs earns trust
 * through product transparency instead. When you have real quotes, add entries
 * to the array below with a name, role, quote and (optionally) an avatar path in
 * /public/testimonials/.
 *
 * While the array is empty the section renders nothing at all, so there is no
 * visible placeholder telling visitors that testimonials are "coming soon".
 * ---------------------------------------------------------------------------
 */

export interface Testimonial {
  quote: string;
  name: string;
  role?: string;
  company?: string;
  /** Path under /public, e.g. '/testimonials/jane-doe.jpg'. Omit for initials. */
  avatar?: string;
  /** ISO date the review was collected. */
  date?: string;
  verifiedPurchase?: boolean;
}

export const TESTIMONIALS: Testimonial[] = [];

export function Testimonials({ items = TESTIMONIALS }: { items?: Testimonial[] }) {
  // Never render an empty testimonials section.
  if (!items.length) return null;

  return (
    <Section tone="alt" aria-labelledby="testimonials-heading">
      <Container>
        <SectionHeading
          as="h2"
          id="testimonials-heading"
          align="center"
          eyebrow="What people say"
          title="Real reviews, collected from real purchases."
        />
        <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card
              key={`${item.name}-${item.quote.slice(0, 12)}`}
              className="flex h-full flex-col p-6"
            >
              <blockquote className="text-ink-soft flex-1 text-[0.95rem] leading-relaxed">
                “{item.quote}”
              </blockquote>
              <footer className="border-line-soft mt-5 flex items-center gap-3 border-t pt-4">
                {item.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.avatar}
                    alt=""
                    width={40}
                    height={40}
                    loading="lazy"
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="bg-navy-800 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  >
                    {item.name.charAt(0)}
                  </span>
                )}
                <div>
                  <p className="text-navy-900 text-sm font-bold">{item.name}</p>
                  <p className="text-ink-muted text-xs">
                    {[item.role, item.company].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </footer>
            </Card>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

export default Testimonials;
