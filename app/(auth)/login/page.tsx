import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; denied?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const next =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/fr";

  if (user) {
    redirect(user.role === "admin" ? "/admin" : next);
  }

  return (
    <AuthShell
      title="Connexion"
      subtitle="Accédez à votre espace ou à la console agents."
      footer={
        <>
          Pas encore de compte ? <Link href="/register">Créer un compte</Link>
        </>
      }
    >
      <LoginForm denied={params.denied === "1"} next={next} />
    </AuthShell>
  );
}
