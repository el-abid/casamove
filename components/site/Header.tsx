"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  localeNames,
  locales,
  type Dict,
  type Locale,
} from "@/content/dictionary";
import { mobilityText } from "@/content/mobility";
import { portalText } from "@/content/portal";
import { useProviderScope } from "@/components/providers/ProviderContext";
import { BrandMark } from "./BrandMark";
import { LogoutButton } from "./LogoutButton";

const navigation = [
  ["", "home"],
  ["/journey", "journey"],
  ["/network", "network"],
  ["/traffic", "traffic"],
  ["/reports", "reports"],
  ["/account", "space"],
  ["/assistance", "help"],
] as const;

export function Header({
  dict,
  locale,
  signedIn,
  brand,
  accent,
  nav = "full",
}: {
  dict: Dict;
  locale: Locale;
  signedIn: boolean;
  brand: string;
  accent: string;
  nav?: "full" | "portal";
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { id: provider, base } = useProviderScope(locale);
  const links =
    nav === "full"
      ? signedIn
        ? navigation
        : navigation.filter(([, label]) => label !== "space")
      : ([["", "portal"]] as const);
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link
          href={base}
          className="brand"
          aria-label={brand}
        >
          <BrandMark provider={provider} brand={brand} accent={accent} />
          {brand}
        </Link>

        <nav
          id="site-nav"
          className={open ? "nav nav--open" : "nav"}
          aria-label={dict.a11y.menu}
        >
          {links.map(([path, label]) => {
            const href =
              label === "space"
                ? `/${locale}/account`
                : nav === "full"
                  ? `${base}${path}`
                  : `/${locale}${path}`;
            return (
              <a
                key={label}
                href={href}
                className={pathname === href ? "is-active" : undefined}
                aria-current={pathname === href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {label === "portal"
                  ? portalText(locale, "portal")
                  : mobilityText(locale, label)}
              </a>
            );
          })}

          <div className="nav__extras">
            <div className="lang" aria-label={dict.a11y.language}>
              {locales.map((item) => (
                <Link
                  key={item}
                  href={`/${item}/${provider}${rest}`}
                  hrefLang={item}
                  aria-current={item === locale ? "true" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {localeNames[item]}
                </Link>
              ))}
            </div>
            <div className="nav__auth">
              {signedIn ? (
                <LogoutButton
                  label={dict.account.logout}
                  redirectTo={base}
                  className="nav__logout"
                />
              ) : (
                <>
                  <Link
                    className="nav__signin"
                    href="/login"
                    onClick={() => setOpen(false)}
                  >
                    {mobilityText(locale, "signIn")}
                  </Link>
                  <Link
                    className="nav__register"
                    href="/register"
                    onClick={() => setOpen(false)}
                  >
                    {mobilityText(locale, "register")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>

        <div className="header__actions">
          <button
            type="button"
            className="menu-btn"
            aria-expanded={open}
            aria-controls="site-nav"
            aria-label={dict.a11y.menu}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
