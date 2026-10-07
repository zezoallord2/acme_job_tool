import Link from "next/link";
import { PageHero } from "@/components/marketing";
import { Icon } from "@/components/nav";

export const metadata = {
  title: "About Acme Jobs",
  description:
    "Why Acme Jobs is built around evidence, explainability, consistency, memory and workflow instead of a resume rewriter.",
};

export default function AboutPage() {
  return (
    <main id="main" className="mx-auto max-w-[880px] px-4 py-10">
      <PageHero
        eyebrow="About"
        title="A job-search operating system, not a resume rewriter."
        lede="Acme Jobs exists because most AI job tools produce confident text that quietly invents your history. We built the opposite: a system where every claim traces back to something you actually did."
      />

      <section className="space-y-6">
        <article className="card p-5">
          <h2 className="text-base font-semibold text-[var(--text)]">
            The principle
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            Your experience. AI-assisted. Never invented. That sentence is a
            contract, not a slogan. It is enforced by code: generated claims are
            linked to evidence records, unsupported numbers are rejected, and
            anything that cannot be supported is shown to you as unsupported
            rather than quietly written into your resume.
          </p>
        </article>

        <article className="card p-5">
          <h2 className="text-base font-semibold text-[var(--text)]">
            What we refuse to build
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--text-muted)]">
            {[
              "A fake ATS score. There is no universal ATS score, so we do not invent one.",
              "An interview odds percentage. We cannot know that, so we do not claim it.",
              "Automatic mass applications. Quality-first, user-controlled.",
              "Silent rewriting of your career facts. Learning proposes; you decide.",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span style={{ color: "var(--brand-accent)" }} aria-hidden>
                  ✓
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card p-5">
          <h2 className="text-base font-semibold text-[var(--text)]">
            Built to run at $0
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            Acme Jobs runs on a local PostgreSQL database with a database-backed
            job queue, local file storage and local structured logs. The default
            AI mode is Manual Mode: the app produces a complete prompt, you run
            it in whatever assistant you already pay for, and Acme Jobs
            validates the result. Optional local AI (Ollama) and
            bring-your-own-key providers are adapters, never requirements.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
            <Icon name="shield" size={14} />
            Your career data never leaves your own machine in the default
            configuration.
          </p>
        </article>

        <article className="card p-5">
          <h2 className="text-base font-semibold text-[var(--text)]">
            Who it is for
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            Fresh graduates, career changers, people getting few replies,
            professionals applying to competitive roles, and anyone already
            using ChatGPT, Claude or Gemini but tired of generic output. You do
            not need to know how prompting works.
          </p>
        </article>
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/signup" className="btn-primary">
          Start free
        </Link>
        <Link href="/pricing" className="btn-secondary">
          See pricing
        </Link>
      </div>
    </main>
  );
}
