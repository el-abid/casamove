import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/fr");

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Suivez vos réclamations et retrouvez vos réponses."
      footer={
        <>
          Déjà inscrit ? <Link href="/login">Se connecter</Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
