import Link from "next/link";
import { PageHero } from "@/components/marketing";

export const metadata = {
  title: "FAQ",
  description:
    "How Acme Jobs keeps your experience truthful and how the no-cost fallback works.",
};

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: "Will Acme Jobs invent things about my experience?",
    a: "No. Every generated claim is linked to the experience that supports it. If no source supports a number, tool or leadership claim, it is shown as unsupported and cannot pass Ready to Apply?. Truth Check lets you confirm, edit, remove or support it.",
  },
  {
    q: "Do I need to pay for an AI service?",
    a: "No. Acme Integrated AI is included with paid plans and runs one-click actions by default. Free users can use Manual Mode, and anyone can optionally bring their own provider key. Manual Mode builds a complete prompt, then validates the response you paste back.",
  },
  {
    q: "What does the free plan include?",
    a: "Quick Profile, career evidence, Resume Quick Check, basic Job Check, basic Match Breakdown, AI resume tailoring, Jobs for You across 16 sources, one STAR story, AI mock interviews, the 30-minute guided workflow, the Free Starter Guide, and saved work. It is enough to improve one real application.",
  },
  {
    q: "What is the Application Details?",
    a: 'A permanent record per application: the original job description, the analysis, the match breakdown, the recommendation, the resume, cover letter and answers you submitted, the date applied, interview prep, notes, follow-ups and outcome. It answers the question "what exactly did I send this company?" permanently, and it never changes after sealing.',
  },
  {
    q: "Is there an ATS score?",
    a: "No. There is no universal ATS score, so inventing one would be dishonest. Instead Ready to Apply? checks unsupported claims, dates, reviewed requirements, tailoring, contact details, verified metrics and consistency. It tells you whether you are ready, need a quick review or should fix something first.",
  },
  {
    q: "Will Acme Jobs learn things about me without asking?",
    a: "No. New observations become proposals. For example, if you mention onboarding new employees in two interviews, Acme Jobs suggests adding it as evidence with Add / Review / Ignore. Nothing is added to your career facts until you confirm it.",
  },
  {
    q: "Can it claim my analytics project improved my chances?",
    a: 'No. That requires a causal design Acme Jobs does not have. It reports observations only, for example: "Applications containing your analytics project received 4 replies from 11 submissions." With small samples it says so explicitly rather than implying a trend.',
  },
  {
    q: "Where is my data stored?",
    a: "In your own PostgreSQL database and your local data directory. Files live under ./data (uploads, exports, logs, backups). You can export your data at any time and delete individual items or the whole account.",
  },
  {
    q: "Does it send my resume to a third party?",
    a: "Only when you choose an integrated AI action or configure your own provider. The request goes to the selected provider and is recorded in the interaction log. Manual Mode remains available when you prefer to handle the prompt yourself.",
  },
  {
    q: "What happens if an AI provider is unavailable?",
    a: "Only AI features degrade. Your Career Profile, Resume, Applications, Sent Versions, notes and exports all keep working. The affected action offers retry, Manual Mode, or reporting a problem, and your work is preserved. Nothing is silently lost.",
  },
];

export default function FaqPage() {
  return (
    <main id="main" className="mx-auto max-w-[820px] px-4 py-10">
      <PageHero
        eyebrow="FAQ"
        title="Straight answers about what Acme Jobs will and will not do."
        lede="If a feature needs a paid service or an unsupported claim, it is not presented as working."
      />

      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => (
          <details key={item.q} className="card p-4" open={i === 0}>
            <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">
              {item.q}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
              {item.a}
            </p>
          </details>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/signup" className="btn-primary">
          Start free
        </Link>
        <Link href="/pricing" className="btn-secondary">
          Compare plans
        </Link>
      </div>
    </main>
  );
}
