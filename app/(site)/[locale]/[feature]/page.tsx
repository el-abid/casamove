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

const features = {
  journey: { title: "journey", View: JourneyPlanner },
  network: { title: "network", View: NetworkPage },
  traffic: { title: "traffic", View: TrafficPage },
  reports: { title: "pulse", View: ReportForm },
  assistance: { title: "help", View: AssistancePage },
} as const;

export function generateStaticParams() {
  return Object.keys(features).map((feature) => ({ feature }));
}

export default async function MobilityPage({
  params,
}: {
  params: Promise<{ locale: string; feature: string }>;
}) {
  const { locale, feature } = await params;
  if (!isLocale(locale) || !Object.hasOwn(features, feature)) notFound();
  const { title, View } = features[feature as keyof typeof features];
  return (
    <main className="mob-site mob-page" id="main-content">
      <header className="mob-page-header">
        <h1>{mobilityText(locale, title)}</h1>
      </header>
      <View locale={locale} />
    </main>
  );
}
