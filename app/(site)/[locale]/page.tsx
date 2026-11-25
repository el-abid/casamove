import { notFound } from "next/navigation";

import { AppPromo } from "@/components/site/AppPromo";
import { Hero } from "@/components/site/Hero";
import { NewsGrid } from "@/components/site/NewsGrid";
import { Newsletter } from "@/components/site/Newsletter";
import { QuickAccess } from "@/components/site/QuickAccess";
import { dictionary, isLocale } from "@/content/dictionary";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = dictionary[locale];

  return (
    <main>
      <Hero dict={dict} />
      <QuickAccess dict={dict} />
      <NewsGrid dict={dict} />
      <AppPromo dict={dict} />
      <Newsletter dict={dict} />
    </main>
  );
}
