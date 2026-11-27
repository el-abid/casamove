import { notFound } from "next/navigation";

import { JourneyPlanner } from "@/components/mobility/JourneyPlanner";
import {
  AssistancePage,
  NetworkPage,
  ReportForm,
  TrafficPage,
} from "@/components/mobility/PassengerPages";
import { isLocale } from "@/content/dictionary";
import { mobilityText } from "@/content/mobility";
import { getProvider } from "@/content/providers";

const features = {
  journey: { title: "journey", lead: "journeyLead", View: JourneyPlanner },
  network: { title: "network", lead: "networkLead", View: NetworkPage },
  traffic: { title: "traffic", lead: "trafficLead", View: TrafficPage },
  reports: { title: "reports", lead: "reportsLead", View: ReportForm },
  assistance: { title: "help", lead: "helpLead", View: AssistancePage },
} as const;

export const dynamic = "force-dynamic";

export default async function MobilityPage({
  params,
}: {
  params: Promise<{ locale: string; provider: string; feature: string }>;
}) {
  const { locale, provider, feature } = await params;
  if (!isLocale(locale)) notFound();

  const config = getProvider(provider);
  if (!config || config.status !== "live" || config.id !== "tram") notFound();
  if (!Object.hasOwn(features, feature)) notFound();

  const { title, lead, View } = features[feature as keyof typeof features];
  return (
    <main className="mob-site mob-page" id="main-content">
      <header className="mob-page-header" data-reveal>
        <h1>{mobilityText(locale, title)}</h1>
        <p className="mob-page-lead">{mobilityText(locale, lead)}</p>
      </header>
      <View locale={locale} />
    </main>
  );
}
