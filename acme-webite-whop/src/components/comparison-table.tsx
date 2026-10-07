import { Check, Minus } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { CtaLink } from '@/components/cta-link';
import { comparison } from '@/content/marketing';
import { cn } from '@/lib/utils';

/**
 * Free vs Complete comparison.
 *
 * On phones a 3-column table would be unusable, so the same data is rendered as
 * stacked per-feature cards below `sm`. Both render from one source of truth.
 */
export function ComparisonTable() {
  return (
    <Section tone="alt" id="compare" aria-labelledby="compare-heading">
      <Container>
        <SectionHeading
          as="h2"
          id="compare-heading"
          align="center"
          eyebrow="Compare"
          title="Free starter or the complete system?"
          description="Both use the same evidence-first method. The difference is depth, reuse and how many roles you are applying to."
        />

        {/* Desktop / tablet table */}
        <div className="border-line shadow-soft mt-12 hidden overflow-hidden rounded-[--radius-panel] border bg-white sm:block">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Comparison of the free AI Job Search Starter Guide and AI Job Hunter — Complete
              Edition
            </caption>
            <thead>
              <tr className="border-line bg-canvas-alt border-b">
                <th
                  scope="col"
                  className="text-ink-muted px-5 py-4 text-[0.72rem] font-bold tracking-[0.12em] uppercase sm:px-6"
                >
                  What you get
                </th>
                <th scope="col" className="px-5 py-4 sm:px-6">
                  <span className="text-ink-muted block text-[0.72rem] font-bold tracking-[0.12em] uppercase">
                    Free starter
                  </span>
                  <span className="text-navy-900 mt-1 block text-[1rem] font-bold">
                    Starter Guide
                  </span>
                </th>
                <th scope="col" className="bg-brand-50/70 px-5 py-4 sm:px-6">
                  <span className="text-brand-800 block text-[0.72rem] font-bold tracking-[0.12em] uppercase">
                    Complete Edition
                  </span>
                  <span className="text-navy-900 mt-1 block text-[1rem] font-bold">
                    AI Job Hunter
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row, index) => (
                <tr
                  key={row.feature}
                  className={cn('border-line-soft border-b', index % 2 === 1 && 'bg-canvas-alt/40')}
                >
                  <th
                    scope="row"
                    className="text-navy-900 px-5 py-4 text-[0.88rem] font-semibold sm:px-6"
                  >
                    {row.feature}
                  </th>
                  <td className="text-ink-soft px-5 py-4 text-[0.88rem] sm:px-6">
                    <span className="flex items-start gap-2">
                      <Check aria-hidden="true" className="text-navy-500 mt-0.5 h-4 w-4 shrink-0" />
                      {row.free}
                    </span>
                  </td>
                  <td className="bg-brand-50/40 text-navy-900 px-5 py-4 text-[0.88rem] font-medium sm:px-6">
                    <span className="flex items-start gap-2">
                      <Check
                        aria-hidden="true"
                        className="text-brand-600 mt-0.5 h-4 w-4 shrink-0"
                        strokeWidth={2.5}
                      />
                      {row.complete}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="mt-10 space-y-4 sm:hidden">
          {comparison.rows.map((row) => (
            <li
              key={row.feature}
              className="border-line shadow-soft overflow-hidden rounded-2xl border bg-white"
            >
              <p className="border-line-soft bg-canvas-alt text-navy-900 border-b px-4 py-3 text-[0.82rem] font-bold tracking-[0.04em] uppercase">
                {row.feature}
              </p>
              <dl className="divide-line-soft divide-y">
                <div className="flex items-start gap-3 px-4 py-3.5">
                  <dt className="text-ink-muted w-[7.5rem] shrink-0 text-[0.72rem] font-bold tracking-[0.06em] uppercase">
                    Free
                  </dt>
                  <dd className="text-ink-soft flex items-start gap-2 text-[0.88rem]">
                    <Check aria-hidden="true" className="text-navy-500 mt-0.5 h-4 w-4 shrink-0" />
                    {row.free}
                  </dd>
                </div>
                <div className="bg-brand-50/50 flex items-start gap-3 px-4 py-3.5">
                  <dt className="text-brand-800 w-[7.5rem] shrink-0 text-[0.72rem] font-bold tracking-[0.06em] uppercase">
                    Complete
                  </dt>
                  <dd className="text-navy-900 flex items-start gap-2 text-[0.88rem] font-semibold">
                    <Check
                      aria-hidden="true"
                      className="text-brand-600 mt-0.5 h-4 w-4 shrink-0"
                      strokeWidth={2.5}
                    />
                    {row.complete}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        <div className="border-line shadow-soft mt-12 grid gap-5 rounded-[--radius-panel] border bg-white p-6 sm:p-8 lg:grid-cols-2 lg:gap-10">
          <div>
            <p className="text-brand-700 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
              New here?
            </p>
            <p className="text-navy-900 mt-2 text-lg font-bold">Start free.</p>
            <p className="text-ink-soft mt-2 text-[0.92rem] leading-relaxed">
              Use the Starter Guide on one real application. Find out whether the method works for
              you before spending anything.
            </p>
            <CtaLink intent="free" size="lg" className="mt-5 w-full justify-center sm:w-auto">
              Start free
            </CtaLink>
          </div>
          <div className="lg:border-line lg:border-l lg:pl-10">
            <p className="text-navy-600 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
              Already ready for the full system?
            </p>
            <p className="text-navy-900 mt-2 text-lg font-bold">Get the Complete Edition.</p>
            <p className="text-ink-soft mt-2 text-[0.92rem] leading-relaxed">
              If you are applying to several roles at once, the Career Master Profile and reusable
              workflow pay for themselves quickly.
            </p>
            <CtaLink
              intent="complete"
              size="lg"
              variant="primary"
              className="mt-5 w-full justify-center sm:w-auto"
            >
              Get Complete Edition
            </CtaLink>
          </div>
        </div>

        <p className="text-ink-muted mt-6 flex items-start justify-center gap-2 text-center text-sm">
          <Minus aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          Neither version includes job placement, interview guarantees or invented content.
        </p>
      </Container>
    </Section>
  );
}

export default ComparisonTable;
