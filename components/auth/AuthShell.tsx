import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="auth">
      <section className="auth__brand">
        <Link href="/fr" className="brand auth__logo">
          <span className="brand__mark" aria-hidden />
          CasaMove
        </Link>

        <div>
          <span className="auth__kicker">Espace client</span>
          <h1>Le service client, sans quitter le site.</h1>
          <p className="auth__lead">
            Un compte CasaMove permet de suivre vos réclamations et de retrouver
            vos réponses. Le chat reste ouvert à tous.
          </p>

          <ul className="auth__points">
            <li>Suivi des dossiers avec numéro et échéance</li>
            <li>Réponses validées par un agent</li>
            <li>Trois langues, un seul compte</li>
          </ul>
        </div>

        <span className="auth__demo">
          Démonstration CasaMove · données de test
        </span>
      </section>

      <section className="auth__panel">
        <div className="auth__card">
          <h2>{title}</h2>
          <p className="auth__sub">{subtitle}</p>
          {children}
        </div>
        <p className="auth__footer">{footer}</p>
      </section>
    </main>
  );
}
