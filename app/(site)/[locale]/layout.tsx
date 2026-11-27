import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import "../../globals.css";
import "@/components/mobility/mobility.css";

import { Pwa } from "@/components/mobility/Pwa";
import { Reveal } from "@/components/ui/Reveal";
import { dictionary, dirs, isLocale, locales } from "@/content/dictionary";
import { mobilityText } from "@/content/mobility";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const dict = dictionary[locale];

  return {
    title: dict.meta.title,
    description: dict.meta.description,
    manifest: "/manifest.webmanifest",
    alternates: {
      languages: { fr: "/fr", ar: "/ar", en: "/en" },
    },
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      locale,
      type: "website",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} dir={dirs[locale]}>
      <body className="mob-passenger">
        <noscript>
          <style>{`[data-reveal]{opacity:1 !important;transform:none !important}`}</style>
        </noscript>
        <a className="mob-skip" href="#main-content">
          {mobilityText(locale, "skip")}
        </a>
        {children}
        <Pwa />
        <Reveal />
      </body>
    </html>
  );
}
