import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/session";
import "../globals.css";

export const metadata: Metadata = {
  title: "Console agents · CasaMove",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();

  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
