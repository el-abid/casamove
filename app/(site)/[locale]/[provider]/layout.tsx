import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { ChatWidget } from "@/components/chat/ChatWidget";
import "@/components/bus/bus.css";
import { ProviderScope } from "@/components/providers/ProviderContext";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { dictionary, isLocale } from "@/content/dictionary";
import { getProvider, isProviderId } from "@/content/providers";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ProviderLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; provider: string }>;
}) {
  const { locale, provider } = await params;
  if (!isLocale(locale) || !isProviderId(provider)) notFound();

  const config = getProvider(provider);
  if (!config) notFound();

  const dict = dictionary[locale];
  const base = `/${locale}/${provider}`;
  const user = await getCurrentUser();

  return (
    <ProviderScope value={{ id: config.id, base }}>
      <Header
        dict={dict}
        locale={locale}
        signedIn={Boolean(user)}
        brand={config.name}
        accent={config.accent}
        nav={config.id === "tram" ? "full" : "portal"}
      />
      {children}
      <Footer
        dict={dict}
        locale={locale}
        base={base}
        brand={config.name}
        accent={config.accent}
        provider={config.id}
        tagline={config.tagline[locale]}
        live={config.id === "tram"}
        sources={config.sources}
      />
      {config.id === "tram" || config.id === "bus" ? (
        <ChatWidget key={`${locale}-${provider}`} dict={dict} locale={locale} />
      ) : null}
    </ProviderScope>
  );
}
