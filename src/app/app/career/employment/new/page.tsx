import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui/primitives";
import {
  EmploymentForm,
  SkillForm,
  EducationForm,
} from "@/components/career-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add to career" };

export default async function NewEmploymentPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-[720px] space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Add to your career profile
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Roles, education and skills are the backbone of your evidence.
          Accuracy here directly improves every match.
        </p>
      </header>

      <Card>
        <CardHeader title="Employment" />
        <EmploymentForm />
      </Card>

      <Card>
        <CardHeader title="Education" />
        <EducationForm />
      </Card>

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
