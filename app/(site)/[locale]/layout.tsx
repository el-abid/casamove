import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import "../../globals.css";
import "@/components/mobility/mobility.css";

import { ChatWidget } from "@/components/chat/ChatWidget";
import { Pwa } from "@/components/mobility/Pwa";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { UtilityBar } from "@/components/site/UtilityBar";
import { dictionary, dirs, isLocale, locales } from "@/content/dictionary";
import { mobilityText } from "@/content/mobility";

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

  const dict = dictionary[locale];

  return (
    <html lang={locale} dir={dirs[locale]}>
      <body className="mob-passenger">
        <a className="mob-skip" href="#main-content">
          {mobilityText(locale, "skip")}
        </a>
        <UtilityBar dict={dict} locale={locale} />
        <Header dict={dict} locale={locale} />
        {children}
        <Footer dict={dict} locale={locale} />
        <ChatWidget key={locale} dict={dict} locale={locale} />
        <Pwa />
      </body>
    </html>
  );
}
