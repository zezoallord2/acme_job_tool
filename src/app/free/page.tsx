import Link from "next/link";
import { PageHero } from "@/components/marketing";

export const metadata = {
  title: "Free — AI Job Search Starter Guide",
  description:
    "Free Edition: Quick Profile, Resume Quick Check, Job Analyzer, AI resume tailoring, one STAR story, AI mock interviews.",
};

const LESSONS = [
  {
    n: "1",
    t: "Build a Quick Profile",
    b: "Your name, level, target role and a short verified evidence base. Enough to start, honest about what is missing.",
  },
  {
    n: "2",
    t: "Read a job description properly",
    b: "Extract the real requirements and distinguish must-have from wish-list. No invented ATS score.",
  },
  {
    n: "3",
    t: "Compare requirements to evidence",
    b: "Strong, partial, missing, unknown — and the specific gaps that could disqualify you.",
  },
  {
    n: "4",
    t: "Tailor one resume honestly",
    b: "Reorder and re-word using only what you can defend. Remove anything unsupported.",
  },
  {
    n: "5",
    t: "Prepare one STAR story",
    b: "Situation, task, action, result — in language you would actually say out loud.",
  },
  {
    n: "6",
    t: "Practise five interview questions",
    b: "One at a time, with feedback on relevance, specificity, evidence, structure and clarity.",
  },
];

export default function FreePage() {
  const freeCheckout = process.env.WHOP_FREE_CHECKOUT_URL;
  return (
    <main id="main" className="mx-auto max-w-[960px] px-4 py-10">
      <PageHero
        eyebrow="Free Edition"
        title="AI Job Search Starter Guide — Free Edition"
        lede="Enough structure to fix one real application this week. Everything in the free plan is designed to produce a genuine win, not a teaser."
      >
        <Link href="/signup" className="btn-primary">
          Create your free account
        </Link>
        <Link href="/login" className="btn-secondary">
          Sign in
        </Link>
        {freeCheckout ? (
          <a
            href={freeCheckout}
            className="btn-secondary"
            rel="noopener noreferrer"
          >
            Claim this in the Whop checkout
          </a>
        ) : null}
      </PageHero>

      <section className="card p-5">
        <h2 className="text-base font-semibold text-[var(--text)]">
          The 30-minute guided workflow
        </h2>
        <ol className="mt-4 space-y-3">
          {LESSONS.map((l) => (
            <li key={l.n} className="flex gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: "var(--brand-accent)" }}
                aria-hidden
              >
                {l.n}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">
                  {l.t}
                </h3>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">{l.b}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <article className="card p-4">
          <h2 className="text-sm font-semibold text-[var(--text)]">
            Interactive version
          </h2>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            Sign in and the workflow runs inside the app: paste a description,
            see the matrix, tailor, practise. Saved automatically.
          </p>
          <Link href="/signup" className="btn-secondary mt-3">
            Start interactive
          </Link>
        </article>
        <article className="card p-4">
          <h2 className="text-sm font-semibold text-[var(--text)]">
            PDF edition
          </h2>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            The same guide as a printable document, generated locally — no
            document service required.
          </p>
          <Link href="/api/free-guide/pdf" className="btn-secondary mt-3">
            Download the guide (PDF)
          </Link>
        </article>
      </section>

      <section className="mt-6 card-muted p-4">
        <h2 className="text-sm font-semibold text-[var(--text)]">
          What free deliberately does not do
        </h2>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          Free gives you one career snapshot, one STAR story, five interview
          questions and a limited number of saved applications. It does not give
          you the full My Experience, the Truth Check, unlimited resume
          versions, Interview Prep, analytics or Today's Tasks. Those are in{" "}
          <Link href="/complete" className="underline">
            Complete Edition
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
