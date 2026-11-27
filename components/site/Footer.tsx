import Link from "next/link";
import { contact, socials } from "@/content/site";
import type { Dict, Locale } from "@/content/dictionary";
import { mobilityText } from "@/content/mobility";
import type { ProviderId } from "@/content/providers";
import { BrandMark } from "./BrandMark";

export function Footer({
  dict,
  locale,
  base,
  brand,
  accent,
  provider,
  tagline,
  live,
  sources,
}: {
  dict: Dict;
  locale: Locale;
  base: string;
  brand: string;
  accent: string;
  provider: ProviderId;
  tagline: string;
  live: boolean;
  sources: string[];
}) {
  return (
    <footer className="footer" id="contact">
      <div className="container">
        <div className="footer__grid">
          <div>
            <Link href={base} className="brand">
              <BrandMark provider={provider} brand={brand} accent={accent} />
              {brand}
            </Link>
            <p>{tagline}</p>
          </div>

          {live ? (
            <>
              <div>
                <h3>{dict.footer.contactTitle}</h3>
                <div className="footer__contact">
                  <div>
                    {dict.footer.phoneLabel}
                    <br />
                    <a href={contact.phoneHref}>
                      <span className="num" dir="ltr">
                        {contact.phone}
                      </span>
                    </a>
                    <br />
                    <small>{dict.footer.hours}</small>
                  </div>
                  <div>
                    {dict.footer.emailLabel}
                    <br />
                    <a href={contact.emailHref}>
                      <span className="num" dir="ltr">
                        {contact.email}
                      </span>
                    </a>
                  </div>
                </div>
              </div>

              <div>
                <h3>{dict.footer.linksTitle}</h3>
                <div className="footer__links">
                  {(
                    [
                      ["journey", "journey"],
                      ["network", "network"],
                      ["traffic", "traffic"],
                      ["assistance", "help"],
                    ] as const
                  ).map(([path, label]) => (
                    <Link key={path} href={`${base}/${path}`}>
                      {mobilityText(locale, label)}
                    </Link>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <h3>{dict.footer.linksTitle}</h3>
              <div className="footer__links">
                {sources.map((source) => (
                  <span key={source}>{source}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="footer__bottom">
          <span>{dict.footer.rights}</span>
          {live ? (
            <div className="footer__socials">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                >
                  {social.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
