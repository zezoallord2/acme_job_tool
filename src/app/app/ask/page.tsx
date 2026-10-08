import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { askAcme } from "@/services/ask-acme-service";
import { Card, CardHeader, Alert } from "@/components/ui/primitives";
import { AskAcmeChat } from "@/components/ask-acme-chat";
import { AskAcmeInput } from "@/components/ask-acme-input";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acme Assistant" };

const EXAMPLES = [
  "What should I work on today?",
  "Which jobs am I strongest for?",
  "Which claims still need verification?",
  "Prepare me for Amazon tomorrow.",
  "What exactly did I send Google?",
  "Which follow-ups are overdue?",
  "What new evidence have I discovered recently?",
  "Which claims is Acme Jobs weakest on?",
];

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const initial = q ? await askAcme(user.id, q).catch(() => null) : null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title text-[var(--text)]">Acme Assistant</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Answers come from your structured records only. If Acme Jobs does not
          have the data, it says so rather than inventing history.
        </p>
      </header>

      <Alert tone="info" title="No hidden model">
        Most questions are answered deterministically by the database. When Acme
        Jobs does not have enough structured data, you can run the AI-assisted
        path in Manual Mode with no API key.
      </Alert>

      <AskAcmeInput examples={EXAMPLES} />

      {initial ? (
        <Card>
          <CardHeader title={q ?? "Answer"} />
          <AskAcmeChat
            question={q ?? ""}
            answer={initial.answer}
            citations={initial.citations}
            dataGaps={initial.dataGaps}
            suggestedActions={initial.suggestedActions}
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Try one of these" />
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {EXAMPLES.map((e) => (
              <li key={e}>
                <Link
                  href={`/app/ask?q=${encodeURIComponent(e)}`}
                  className="btn-secondary"
                  style={{ width: "100%", justifyContent: "flex-start" }}
                >
                  {e}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
