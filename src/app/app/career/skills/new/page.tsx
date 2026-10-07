import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui/primitives";
import { SkillForm } from "@/components/career-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add a skill" };

export default async function NewSkillPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-[560px] space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Add a skill
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Only add skills you could defend if asked. An unmatched skill becomes
          a critical gap in the evidence matrix.
        </p>
      </header>
      <Card>
        <CardHeader title="Skill" />
        <SkillForm />
      </Card>
      <p className="text-sm">
        <Link href="/app/career" className="underline">
          Back to your profile
        </Link>
      </p>
    </div>
  );
}
