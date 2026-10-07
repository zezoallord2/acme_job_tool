import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/app");
  return (
    <AuthShell
      title="Sign in"
      subtitle="Pick up your job search where you left off."
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
