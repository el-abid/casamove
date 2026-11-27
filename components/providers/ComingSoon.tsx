import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/content/dictionary";
import type { Provider } from "@/content/providers";
import { portalText } from "@/content/portal";

const icons = {
  tram: "tram",
  bus: "bus",
  train: "train",
  air: "plane",
  port: "ship",
} as const;

export function ComingSoon({
  provider,
  locale,
}: {
  provider: Provider;
  locale: Locale;
}) {
  return (
    <main
      id="main-content"
      className="mob-site mob-soon"
      style={{ ["--provider-accent" as string]: provider.accent }}
    >
      <div className="container mob-soon__inner">
        <span className="mob-soon__icon">
          <Icon name={icons[provider.id]} size={30} />
        </span>
        <span className="mob-soon__kicker">
          {provider.mode[locale]} · {provider.operator}
        </span>
        <h1>{portalText(locale, "comingTitle")}</h1>
        <p>{portalText(locale, "comingText")}</p>
        <p className="mob-soon__tagline">{provider.tagline[locale]}</p>
        <div className="mob-soon__sources">
          <span>{portalText(locale, "source")}</span>
          {provider.sources.map((source) => (
            <b key={source}>{source}</b>
          ))}
        </div>
        <Link className="mob-button" href={`/${locale}`}>
          {portalText(locale, "back")}
        </Link>
      </div>
    </main>
  );
}
