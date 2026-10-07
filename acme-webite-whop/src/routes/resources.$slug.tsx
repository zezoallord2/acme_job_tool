import { createFileRoute, notFound } from '@tanstack/react-router';
import { headFor } from '@/lib/head';
import { Link } from '@/components/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { Container } from '@/components/ui/container';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CtaLink } from '@/components/cta-link';
import { ArticleCard } from '@/components/resource-preview';
import { JsonLd } from '@/components/json-ld';
import {
  getArticle,
  getSortedArticles,
  type ArticleBlock,
} from '@/content/articles';
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd } from '@/lib/seo';
import { siteConfig } from '@/lib/config';

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <h2
          id={block.id}
          className="mt-12 scroll-mt-28 text-[1.5rem] font-bold tracking-[-0.022em] text-navy-900 sm:text-[1.7rem]"
        >
          {block.text}
        </h2>
      );
    case 'paragraph':
      return <p className="mt-5 text-[1.0625rem] leading-[1.75] text-ink-soft">{block.text}</p>;
    case 'list':
      return block.ordered ? (
        <ol className="mt-6 space-y-3">
          {block.items.map((item, index) => (
            <li key={item} className="flex items-start gap-3.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-800 text-[0.75rem] font-bold text-white">
                {index + 1}
              </span>
              <span className="text-[1.0625rem] leading-[1.7] text-ink-soft">{item}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="mt-6 space-y-3">
          {block.items.map((item) => (
            <li key={item} className="flex items-start gap-3.5">
              <span
                aria-hidden="true"
                className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
              />
              <span className="text-[1.0625rem] leading-[1.7] text-ink-soft">{item}</span>
            </li>
          ))}
        </ul>
      );
    case 'callout':
      return (
        <aside
          className={`mt-8 rounded-2xl border p-5 sm:p-6 ${
            block.tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-brand-200 bg-brand-50'
          }`}
        >
          <p
            className={`text-[0.75rem] font-bold tracking-[0.14em] uppercase ${
              block.tone === 'warn' ? 'text-amber-800' : 'text-brand-800'
            }`}
          >
            {block.title}
          </p>
          <p
            className={`mt-2.5 text-[1rem] leading-[1.7] ${
              block.tone === 'warn' ? 'text-amber-950' : 'text-navy-900'
            }`}
          >
            {block.text}
          </p>
        </aside>
      );
    case 'example':
      return (
        <figure className="mt-8 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          <figcaption className="border-b border-line-soft bg-canvas-alt px-5 py-3 text-[0.85rem] font-bold text-navy-900 sm:px-6">
            {block.title}
          </figcaption>
          <div className="divide-y divide-line-soft">
            <div className="px-5 py-4 sm:px-6">
              <p className="text-[0.75rem] font-bold tracking-[0.14em] text-ink-muted uppercase">
                Generic
              </p>
              <p className="mt-2 text-[0.98rem] leading-relaxed text-ink-muted">{block.before}</p>
            </div>
            <div className="bg-brand-50/60 px-5 py-4 sm:px-6">
              <p className="text-[0.75rem] font-bold tracking-[0.14em] text-brand-800 uppercase">
                Evidence-based
              </p>
              <p className="mt-2 text-[0.98rem] leading-relaxed font-medium text-navy-900">
                {block.after}
              </p>
            </div>
          </div>
        </figure>
      );
    case 'steps':
      return (
        <ol className="mt-6 space-y-3">
          {block.items.map((item, index) => (
            <li key={item.title} className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
              <p className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-800 text-[0.75rem] font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-[1rem] font-bold text-navy-900">{item.title}</span>
              </p>
              <p className="mt-2 pl-9 text-[1rem] leading-[1.7] text-ink-soft">{item.text}</p>
            </li>
          ))}
        </ol>
      );
    default:
      return null;
  }
}

export const Route = createFileRoute('/resources/$slug')({
  component: ArticlePage,
  head: ({ params }) => {
    const article = getArticle(params.slug);
    if (!article) {
      return headFor({
        title: 'Resource not found',
        description: 'This Acme Jobs resource could not be found.',
        path: `/resources/${params.slug}`,
        noindex: true,
      });
    }
    return headFor({
      title: article.title,
      description: article.description,
      path: `/resources/${article.slug}`,
      type: 'article',
    });
  },
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const article = getArticle(slug);

  if (!article) {
    return <NotFoundArticle slug={slug} />;
  }

  const related = getSortedArticles().filter((item) => item.slug !== article.slug).slice(0, 3);

  const jsonLdFaq = article.faq.map((item) => ({ question: item.question, answer: item.answer }));

  return (
    <>
      <JsonLd
        data={articleJsonLd({
          title: article.title,
          description: article.description,
          path: `/resources/${article.slug}`,
          published: article.published,
          updated: article.updated,
          readingMinutes: article.readingMinutes,
          section: article.section,
        })}
      />
      <JsonLd data={faqJsonLd(jsonLdFaq)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Resources', path: '/resources' },
          { name: article.title, path: `/resources/${article.slug}` },
        ])}
      />

      <article>
        <header className="relative overflow-hidden bg-navy-900 pt-28 pb-14 sm:pt-32 sm:pb-16">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(85%_70%_at_15%_0%,rgba(17,142,148,0.26),transparent_65%)]"
          />
          <div aria-hidden="true" className="absolute inset-0 grain-overlay" />
          <Container className="relative">
            <div className="mx-auto max-w-3xl">
              <Link
                href="/resources"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-300 transition-colors hover:text-brand-200"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                All resources
              </Link>

              <p className="mt-6 text-[0.72rem] font-bold tracking-[0.18em] text-brand-300 uppercase">
                {article.section}
              </p>
              <h1 className="mt-3 text-[2rem] leading-[1.12] font-bold tracking-[-0.03em] text-white sm:text-[2.6rem]">
                {article.title}
              </h1>
              <p className="mt-5 text-[1.0625rem] leading-relaxed text-brand-100/85">
                {article.summary}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-sm text-brand-100/70">
                <span className="inline-flex items-center gap-1.5">
                  <Clock aria-hidden="true" className="h-4 w-4 text-brand-400" />
                  {article.readingMinutes} min read
                </span>
                <span>
                  Published{' '}
                  <time dateTime={article.published}>{formatDate(article.published)}</time>
                </span>
                <span>
                  Updated{' '}
                  <time dateTime={article.updated}>{formatDate(article.updated)}</time>
                </span>
                <span>By {siteConfig.name}</span>
              </div>
            </div>
          </Container>
        </header>

        <div className="bg-white py-14 sm:py-16">
          <Container>
            <div className="mx-auto max-w-[46rem]">
              <div className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-[0.95rem] font-bold text-navy-900">
                    Want this as a repeatable system?
                  </p>
                  <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-soft">
                    The free Starter Guide turns this into six modules you can apply today.
                  </p>
                </div>
                <CtaLink intent="free" size="md" className="shrink-0 justify-center">
                  Start free
                </CtaLink>
              </div>

              <nav
                aria-label="Article contents"
                className="mt-10 rounded-2xl border border-line bg-canvas-alt p-5"
              >
                <p className="text-[0.72rem] font-bold tracking-[0.14em] text-ink-muted uppercase">
                  In this guide
                </p>
                <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                  {article.sections.map((section, index) => (
                    <li key={section.id} className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-[0.72rem] font-bold text-brand-700">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <a
                        href={`#${section.id}`}
                        className="text-[0.9rem] leading-snug text-ink-soft underline-offset-4 transition-colors hover:text-brand-800 hover:underline"
                      >
                        {section.heading}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>

              <div className="mt-10">
                {article.sections.map((section) => (
                  <section key={section.id} aria-labelledby={section.id}>
                    <h2
                      id={section.id}
                      className="mt-12 scroll-mt-28 text-[1.5rem] font-bold tracking-[-0.022em] text-navy-900 sm:text-[1.7rem]"
                    >
                      {section.heading}
                    </h2>
                    <div className="mt-4">
                      {section.blocks.map((block, index) => (
                        <Block key={`${section.id}-${index}`} block={block} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <section aria-labelledby="article-faq" className="mt-16 border-t border-line pt-10">
                <h2
                  id="article-faq"
                  className="text-[1.5rem] font-bold tracking-[-0.022em] text-navy-900"
                >
                  Frequently asked questions
                </h2>
                <Accordion type="single" collapsible className="mt-6 space-y-3">
                  {article.faq.map((item) => (
                    <AccordionItem key={item.question} value={item.question}>
                      <AccordionTrigger>{item.question}</AccordionTrigger>
                      <AccordionContent>{item.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>

              <section aria-labelledby="related" className="mt-14 border-t border-line pt-10">
                <h2
                  id="related"
                  className="text-[1.35rem] font-bold tracking-[-0.02em] text-navy-900"
                >
                  Keep reading
                </h2>
                <ul className="mt-5 grid gap-2">
                  {article.related.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="inline-flex items-center gap-2 text-[0.95rem] font-semibold text-brand-800 underline underline-offset-4 transition-colors hover:text-navy-900"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </Container>
        </div>
      </article>

      <section className="border-t border-line bg-canvas-alt py-14" aria-labelledby="more-guides">
        <Container>
          <h2 id="more-guides" className="text-[1.35rem] font-bold tracking-[-0.02em] text-navy-900">
            More from Acme Jobs
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <li key={item.slug} className="relative">
                <ArticleCard article={item} />
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </>
  );
}

/** TanStack's notFound() aborts the loader; this keeps the HTTP 200 + branded body. */
function NotFoundArticle({ slug }: { slug: string }) {
  void notFound;
  return (
    <section className="bg-white pt-32 pb-20 sm:pt-40">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[0.72rem] font-bold tracking-[0.18em] text-brand-700 uppercase">
            Error 404
          </p>
          <h1 className="mt-4 text-[2rem] leading-tight font-bold tracking-[-0.03em] text-navy-900">
            This resource does not exist.
          </h1>
          <p className="mt-4 text-base text-ink-soft">
            We could not find an article at{' '}
            <code className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[0.85rem] text-navy-700">
              /resources/{slug}
            </code>
            .
          </p>
          <Link
            href="/resources"
            className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-navy-800 px-7 text-base font-semibold text-white transition-colors hover:bg-navy-700"
          >
            Browse all resources
          </Link>
        </div>
      </Container>
    </section>
  );
}
