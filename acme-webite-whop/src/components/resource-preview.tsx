import Link from '@/components/link';
import { ArrowRight, Clock } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { getSortedArticles, type Article } from '@/content/articles';

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="group border-line shadow-soft hover:border-brand-300 hover:shadow-lift flex h-full flex-col rounded-[--radius-card] border bg-white p-6 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1">
      <div className="text-brand-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] font-bold tracking-[0.1em] uppercase">
        <span>{article.section}</span>
        <span aria-hidden="true" className="text-brand-300">
          /
        </span>
        <span className="text-ink-muted inline-flex items-center gap-1">
          <Clock aria-hidden="true" className="h-3 w-3" />
          {article.readingMinutes} min read
        </span>
      </div>

      <h3 className="text-navy-900 mt-3 text-[1.05rem] font-bold tracking-[-0.015em]">
        <Link
          href={`/resources/${article.slug}`}
          className="after:absolute after:inset-0 after:content-['']"
        >
          <span className="from-brand-700 to-brand-500 bg-gradient-to-r bg-[length:0%_2px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 group-hover:bg-[length:100%_2px]">
            {article.title}
          </span>
        </Link>
      </h3>

      <p className="text-ink-soft mt-2.5 flex-1 text-[0.9rem] leading-relaxed">
        {article.description}
      </p>

      <p className="text-ink-muted mt-5 flex items-center justify-between text-[0.78rem]">
        <time dateTime={article.updated}>Updated {formatDate(article.updated)}</time>
        <span className="text-brand-800 inline-flex items-center gap-1 font-semibold">
          Read
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </span>
      </p>
    </article>
  );
}

/** Compact resources block used on the homepage. */
export function ResourcePreview() {
  const latest = getSortedArticles().slice(0, 3);

  return (
    <Section tone="alt" aria-labelledby="resources-preview-heading">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            as="h2"
            id="resources-preview-heading"
            eyebrow="Resources"
            title="Practical guides, no filler."
            description="Short, specific articles on using AI for job search properly — written for humans, not for search engines."
          />
          <Link
            href="/resources"
            className="border-navy-200 text-navy-800 hover:border-brand-400 hover:bg-brand-50 inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full border bg-white px-5 text-sm font-semibold transition-colors duration-200 sm:self-auto"
          >
            All resources
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((article) => (
            <li key={article.slug} className="relative">
              <ArticleCard article={article} />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

export default ResourcePreview;
