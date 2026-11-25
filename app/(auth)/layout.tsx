import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../globals.css";
import "@/components/auth/auth.css";

export const metadata: Metadata = {
  title: "CasaMove · Connexion",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="auth-body">{children}</body>
    </html>
  );
}
