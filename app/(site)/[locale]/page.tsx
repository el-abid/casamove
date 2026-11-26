import { notFound } from "next/navigation";
import { PassengerHome } from "@/components/mobility/PassengerPages";
import { isLocale } from "@/content/dictionary";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main id="main-content" className="mob-site mob-home">
      <PassengerHome locale={locale} />
    </main>
  );
}
