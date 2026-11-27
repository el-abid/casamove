import Link from "next/link";

import { localeNames, locales, type Locale } from "@/content/dictionary";
import { portalText } from "@/content/portal";

export function PortalHeader({
  locale,
  signedIn,
  languageLabel,
}: {
  locale: Locale;
  signedIn: boolean;
  languageLabel: string;
}) {
  return (
    <header className="portal-header">
      <div className="portal-container portal-header__inner">
        <Link href={`/${locale}`} className="portal-brand">
          <span className="portal-brand__mark" aria-hidden>
            M
          </span>
          {portalText(locale, "brand")}
        </Link>

        <div className="portal-header__actions">
          <div className="lang" aria-label={languageLabel}>
            {locales.map((item) => (
              <Link
                key={item}
                href={`/${item}`}
                hrefLang={item}
                aria-current={item === locale ? "true" : undefined}
              >
                {localeNames[item]}
              </Link>
            ))}
          </div>
          {signedIn ? (
            <Link className="portal-link" href={`/${locale}/account`}>
              {portalText(locale, "account")}
            </Link>
          ) : (
            <>
              <Link className="portal-link" href="/login">
                {portalText(locale, "login")}
              </Link>
              <Link className="portal-cta" href="/register">
                {portalText(locale, "register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
