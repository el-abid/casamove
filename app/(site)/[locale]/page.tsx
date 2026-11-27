import "@/components/portal/portal.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortalFooter } from "@/components/portal/PortalFooter";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { ProviderCard } from "@/components/portal/ProviderCard";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { dictionary, isLocale } from "@/content/dictionary";
import { providers } from "@/content/providers";
import { portalText } from "@/content/portal";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: `${portalText(locale, "brand")} · ${portalText(locale, "title")}`,
    description: portalText(locale, "subtitle"),
    alternates: { languages: { fr: "/fr", ar: "/ar", en: "/en" } },
  };
}

export default async function PortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = dictionary[locale];
  const user = await getCurrentUser();

  return (
    <>
      <PortalHeader
        locale={locale}
        signedIn={Boolean(user)}
        languageLabel={dict.a11y.language}
      />
      <main id="main-content" className="portal">
        <section className="portal-container portal-hero">
          <span className="portal-kicker">{portalText(locale, "kicker")}</span>
          <h1>{portalText(locale, "title")}</h1>
          <p>{portalText(locale, "subtitle")}</p>
        </section>

        <section className="portal-container portal-grid" aria-label="Modes de transport">
          {providers.map((provider, index) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              locale={locale}
              delay={index * 60}
            />
          ))}
        </section>
      </main>
      <ChatWidget dict={dict} locale={locale} general />
      <PortalFooter locale={locale} />
    </>
  );
}
