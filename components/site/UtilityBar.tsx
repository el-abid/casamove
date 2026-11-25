import Link from "next/link";
import { contact } from "@/content/site";
import {
  localeNames,
  locales,
  type Dict,
  type Locale,
} from "@/content/dictionary";

export function UtilityBar({ dict, locale }: { dict: Dict; locale: Locale }) {
  return (
    <div className="utility">
      <div className="container utility__inner">
        <div className="utility__left">
          <span>{dict.utility.network}</span>
          <a className="utility__phone" href={contact.phoneHref}>
            {dict.utility.service}{" "}
            <span className="num" dir="ltr">
              {contact.phone}
            </span>
          </a>
          <span>{dict.utility.hours}</span>
        </div>
        <div className="utility__right">
          <Link className="utility__account" href={`/${locale}/account`}>
            {dict.header.account}
          </Link>
          <div className="lang" aria-label={dict.a11y.language}>
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
        </div>
      </div>
    </div>
  );
}
