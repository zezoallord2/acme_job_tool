import { CheckCircle2, FileText, ListChecks, Sparkles } from 'lucide-react';
import { freeProduct, paidProduct } from '@/content/marketing';
import { cn } from '@/lib/utils';

/**
 * Product visual: an honest, responsive “module map” of what is inside each
 * product.
 *
 * It is deliberately not a fake product screenshot — it is a labelled diagram of
 * the actual module list, rendered as crisp markup so it stays sharp on every
 * display, ships zero image bytes, and can never be mistaken for evidence of
 * something we do not offer. Real screenshots can be added later through
 * `src/content/gallery.ts` + <ProductGallery>.
 */
export function ProductVisual({ variant = 'free' }: { variant?: 'free' | 'complete' }) {
  const complete = variant === 'complete';
  const modules = complete
    ? [
        'Career Master Profile',
        'Achievement Mining',
        'Deep Job Analysis',
        'Evidence Matching',
        'Resume Tailoring',
        'Bullet Improvement',
        'Cover Letters',
        'Application Answers',
        'LinkedIn Positioning',
        'STAR Story Bank',
        'Advanced Mock Interviews',
        'Interview Preparation',
        'Post-Interview Review',
      ]
    : [...freeProduct.supports];

  const title = complete ? paidProduct.name : freeProduct.name;
  const subtitle = complete ? paidProduct.edition : freeProduct.edition;

  return (
    <figure
      className="relative"
      role="img"
      aria-label={`Illustrative module map for ${title}, ${subtitle}: ${modules.join(', ')}.`}
    >
      <div
        aria-hidden="true"
        className={cn(
          'absolute -inset-5 -z-10 rounded-[2.5rem] blur-3xl',
          complete ? 'bg-navy-200/45' : 'bg-brand-200/50'
        )}
      />
      <div className="border-navy-200 shadow-lift overflow-hidden rounded-[--radius-panel] border bg-white">
        {/* window chrome */}
        <div className="border-line bg-navy-50/80 flex items-center gap-2 border-b px-4 py-3">
          <span className="bg-navy-200 h-2.5 w-2.5 rounded-full" />
          <span className="bg-navy-200 h-2.5 w-2.5 rounded-full" />
          <span className="bg-brand-300 h-2.5 w-2.5 rounded-full" />
          <p className="text-navy-700 ml-2 truncate text-[0.72rem] font-semibold tracking-[0.02em]">
            {title} — module map
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-navy-900 text-[0.95rem] font-bold">{title}</p>
              <p className="text-ink-muted mt-0.5 text-[0.78rem] font-medium">
                {subtitle} · {modules.length} modules
              </p>
            </div>
            <span className="bg-brand-100 text-brand-900 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.75rem] font-bold tracking-[0.06em] uppercase">
              {complete ? (
                <Sparkles aria-hidden="true" className="h-3 w-3" />
              ) : (
                <FileText aria-hidden="true" className="h-3 w-3" />
              )}
              {complete ? paidProduct.launchPrice : freeProduct.price}
            </span>
          </div>

          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {modules.map((module, index) => (
              <li
                key={module}
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[0.8rem] leading-snug font-semibold',
                  complete
                    ? 'border-brand-200 bg-brand-50/70 text-navy-900'
                    : 'border-line bg-canvas-alt text-navy-900'
                )}
              >
                <CheckCircle2
                  aria-hidden="true"
                  className={cn(
                    'mt-px h-3.5 w-3.5 shrink-0',
                    complete ? 'text-brand-600' : 'text-navy-500'
                  )}
                />
                <span>
                  <span className="text-ink-muted text-[0.75rem]">
                    {String(index + 1).padStart(2, '0')}
                  </span>{' '}
                  {module}
                </span>
              </li>
            ))}
          </ul>

          <p className="border-line-soft text-ink-muted mt-5 flex items-start gap-2 border-t pt-4 text-[0.72rem] leading-snug">
            <ListChecks aria-hidden="true" className="text-navy-500 mt-px h-3.5 w-3.5 shrink-0" />
            Illustrative module map of the actual contents — not a software screenshot.
          </p>
        </div>
      </div>
      <figcaption className="text-ink-muted mt-3 text-center text-xs">
        {complete ? paidProduct.name : freeProduct.name} ·{' '}
        {complete ? paidProduct.edition : freeProduct.edition} contents at a glance
      </figcaption>
    </figure>
  );
}

export default ProductVisual;
