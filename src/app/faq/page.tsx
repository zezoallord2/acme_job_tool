import Link from "next/link";
import { PageHero } from "@/components/marketing";

export const metadata = {
  title: "FAQ",
  description:
    "How Acme Jobs works, what the evidence ledger guarantees, and how the zero-cost mode works.",
};

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: "Will Acme Jobs invent things about my experience?",
    a: "No. Every generated claim is linked to the evidence records that support it. If no evidence supports a number, a tool or a leadership claim, it is shown as unsupported and cannot pass the Readiness Gate. Unsupported claims are shown in the Claim Inspector so you can confirm, edit, remove or attach evidence.",
  },
  {
    q: "Do I need to pay for an AI service?",
    a: "No. The default is Manual Mode: Acme Jobs builds a complete, self-contained prompt, you paste it into whatever assistant you already use, then paste the result back. Acme Jobs validates the response with a schema check and continues. Optional local AI (Ollama) and bring-your-own-key providers exist, but nothing requires them.",
  },
  {
    q: "What does the free plan include?",
    a: "Career Snapshot, career evidence, Resume Quick Check, basic Job Description Analyzer, basic Evidence Matrix, basic resume tailoring, one STAR story, a five-question mock interview, the 30-minute guided workflow, the Free Starter Guide, limited Ask Acme and saved work. It is enough to improve one real application.",
  },
  {
    q: "What is the Application Capsule?",
    a: 'A permanent record per application: the original job description, the analysis, the evidence matrix, the recommendation, the resume, cover letter and answers you submitted, the date applied, interview prep, notes, follow-ups and outcome. It answers the question "what exactly did I send this company?" permanently, and it never changes after sealing.',
  },
  {
    q: "Is there an ATS score?",
    a: "No. There is no universal ATS score, so inventing one would be dishonest. Instead the Readiness Gate lists concrete conditions: unsupported claims, date consistency, requirements reviewed, tailoring, contact completeness, metrics verified, answer consistency and cross-document consistency. The result is READY, READY_WITH_WARNINGS or NOT_READY.",
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
    a: "Not in the default configuration. Manual AI Mode means your text is only ever on your screen. If you configure a provider yourself (local AI or your own API key), that request goes to the provider you chose, and the app records that in the interaction log.",
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
