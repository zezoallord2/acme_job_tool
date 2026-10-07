import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { EvidenceForm } from "@/components/evidence-form";
import { Card, CardHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add evidence" };

export default async function NewEvidencePage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-[720px] space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Add an achievement
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Record one thing you actually did. Smaller, specific entries beat one
          long paragraph — they are what later suggestions are built from.
        </p>
      </header>
      <Card>
        <CardHeader title="New evidence record" />
        <EvidenceForm />
      </Card>
      <p className="text-sm">
        <Link href="/app/evidence" className="underline">
          Back to the Evidence Ledger
        </Link>
      </p>
    </div>
  );
}
