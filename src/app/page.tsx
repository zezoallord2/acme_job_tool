import Link from "next/link";
import { MarketingNav, MarketingFooter } from "@/components/marketing";
import { Icon } from "@/components/nav";
import { TubesHero } from "@/components/tubes-hero";

export const metadata = {
  title: "Stop Sending Generic Applications",
  description:
    "Acme Jobs gives you practical AI-powered systems to understand job descriptions, improve your resume, prepare for interviews, and turn your real experience into stronger applications.",
};

const DIFFERENTIATORS = [
  {
    title: "Evidence, not invention",
    body: "Every suggestion points back to something you actually did. Your experience. AI-assisted. Never invented.",
  },
  {
    title: "You can see why",
    body: 'Ask "why is Acme Jobs saying this?" on any suggestion and see the exact evidence used — and what was excluded because it was unsupported.',
  },
  {
    title: "What you sent is preserved",
    body: "When you apply, Acme Jobs freezes an immutable capsule of the job description, resume, letter and answers you sent. Editing later never rewrites history.",
  },
  {
    title: "Honest recommendations",
    body: "No fake ATS score. No invented interview odds. Just evidence coverage, the gaps that matter, and where your next hour is best spent.",
  },
];

const WORKFLOW = [
  {
    step: "Career",
    body: "Organise your real experience into a verified evidence ledger.",
  },
  {
    step: "Job",
    body: "Paste a description. See the real requirements, not a guessed score.",
  },
  {
    step: "Evidence matrix",
    body: "Compare requirements against what you can actually prove.",
  },
  {
    step: "Application",
    body: "Tailored resume, consistent answers, readiness gate before you send.",
  },
  {
    step: "Sent",
    body: "An immutable record of exactly what that company received.",
  },
  {
    step: "Interview",
    body: "Prepare from your strongest evidence. Review afterwards to improve.",
  },
];

const COST_NOTE =
  "Private AI runs on the app server when configured—never on your phone. Manual Mode remains the no-install fallback.";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <MarketingNav current="/" />

      <main id="main">
        <TubesHero>
          <div className="px-4 pb-16 pt-20 sm:pb-20 sm:pt-24">
            <div className="mx-auto max-w-[1120px]">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#75e3e6]">
                Evidence-first career intelligence
              </p>
              <h1 className="max-w-[900px] text-[36px] font-semibold leading-[1.04] tracking-[-0.035em] text-white sm:text-[60px] lg:text-[72px]">
                Stop Sending Generic Applications.
                <br />
                <span className="text-[#75e3e6]">
                  Build Better Ones With AI.
                </span>
              </h1>
              <p className="mt-6 max-w-[720px] text-[15px] leading-relaxed text-slate-200 sm:text-[18px]">
                Acme Jobs gives you practical AI-powered systems to understand
                job descriptions, improve your resume, prepare for interviews,
                and turn your real experience into stronger applications.
              </p>
              <p className="mt-4 text-sm font-semibold text-[#75e3e6]">
                Your experience. AI-assisted. Never invented.
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <Link
                  href="/signup"
                  className="btn-primary !bg-[#24c3c8] !text-[#07131f]"
                >
                  Start free — no card
                </Link>
                <Link
                  href="/free"
                  className="btn-secondary !border-white/25 !bg-white/10 !text-white backdrop-blur-md"
                >
                  Read the Free Starter Guide
                </Link>
                <Link
                  href="/pricing"
                  className="btn-secondary !border-white/25 !bg-white/10 !text-white backdrop-blur-md"
                >
                  See Complete Edition
                </Link>
              </div>

              <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-slate-300">
                <Icon name="shield" size={13} />
                {COST_NOTE}
              </p>
            </div>
          </div>
        </TubesHero>

        <section
          className="border-y px-4 py-10"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="mx-auto grid max-w-[1120px] gap-4 sm:grid-cols-2">
            {DIFFERENTIATORS.map((d) => (
              <article key={d.title} className="card p-4">
                <h2 className="text-[15px] font-semibold text-[var(--text)]">
                  {d.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
                  {d.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="px-4 py-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="text-[20px] font-semibold tracking-tight text-[var(--text)]">
              How it fits together
            </h2>
            <p className="mt-2 max-w-[720px] text-sm text-[var(--text-muted)]">
              Three objects hold everything together: your career, the job, and
              the application you actually sent.
            </p>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {WORKFLOW.map((w, i) => (
                <li key={w.step} className="card p-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ background: "var(--brand-accent)" }}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-[var(--text)]">
                      {w.step}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    {w.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-4 pb-14">
          <div className="mx-auto grid max-w-[1120px] gap-4 lg:grid-cols-2">
            <article className="card flex flex-col p-5">
              <h2 className="text-[17px] font-semibold text-[var(--text)]">
                AI Job Search Starter Guide — Free Edition
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Career Snapshot, Resume Quick Check, Job Analyzer, basic
                tailoring, one STAR story and a five-question mock interview.
                Enough to improve one real application.
              </p>
              <p
                className="mt-3 text-xs font-semibold"
                style={{ color: "var(--brand-accent)" }}
              >
                Understand + Try
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/free" className="btn-secondary">
                  Open the guide
                </Link>
                <Link href="/signup" className="btn-primary">
                  Create free account
                </Link>
              </div>
            </article>

            <article
              className="card flex flex-col p-5"
              style={{ borderColor: "var(--brand-accent)" }}
            >
              <h2 className="text-[17px] font-semibold text-[var(--text)]">
                AI Job Hunter — Complete Edition
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                The full system: achievement mining, deep job analysis,
                effort-vs-opportunity ranking, master resume and versions, claim
                inspector, readiness gate, interview command centre, immutable
                sent versions, analytics and a daily priority engine.
              </p>
              <p
                className="mt-3 text-xs font-semibold"
                style={{ color: "var(--brand-accent)" }}
              >
                Build + Execute + Repeat
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link href="/pricing" className="btn-primary">
                  Launch price $9.99
                </Link>
                <Link href="/complete" className="btn-secondary">
                  What is included
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
