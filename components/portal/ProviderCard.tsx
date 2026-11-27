import Link from "next/link";
import type { CSSProperties } from "react";

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

export function ProviderCard({
  provider,
  locale,
  delay = 0,
}: {
  provider: Provider;
  locale: Locale;
  delay?: number;
}) {
  const live = provider.status === "live";

  return (
    <Link
      href={`/${locale}/${provider.id}`}
      className={`provider-card${live ? " provider-card--live" : ""}`}
      data-reveal
      style={
        {
          "--card-accent": provider.accent,
          "--card-soft": provider.accentSoft,
          "--reveal-delay": `${delay}ms`,
        } as CSSProperties
      }
    >
      <div className="provider-card__top">
        <span className="provider-card__icon">
          <Icon name={icons[provider.id]} size={26} />
        </span>
        <span className={`provider-status provider-status--${provider.status}`}>
          {portalText(locale, live ? "live" : "soon")}
        </span>
      </div>

      <h2>{provider.name}</h2>
      <span className="provider-card__mode">
        {provider.mode[locale]} · {provider.operator}
      </span>
      <p>{provider.tagline[locale]}</p>

      <span className="provider-card__cta">
        {portalText(locale, live ? "open" : "soon")}{" "}
        {live ? <span aria-hidden>→</span> : null}
      </span>
    </Link>
  );
}
