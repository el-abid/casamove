import { notFound } from "next/navigation";

import { BusHome } from "@/components/bus/BusHome";
import { PassengerHome } from "@/components/mobility/PassengerPages";
import { ComingSoon } from "@/components/providers/ComingSoon";
import { isLocale } from "@/content/dictionary";
import { getProvider } from "@/content/providers";

export const dynamic = "force-dynamic";

export default async function ProviderHomePage({
  params,
}: {
  params: Promise<{ locale: string; provider: string }>;
}) {
  const { locale, provider } = await params;
  if (!isLocale(locale)) notFound();

  const config = getProvider(provider);
  if (!config) notFound();

  if (config.status === "live" && config.id === "tram") {
    return (
      <main id="main-content" className="mob-site mob-home">
        <PassengerHome locale={locale} />
      </main>
    );
  }

  if (config.status === "live" && config.id === "bus") {
    return <BusHome locale={locale} />;
  }

  return <ComingSoon provider={config} locale={locale} />;
}
