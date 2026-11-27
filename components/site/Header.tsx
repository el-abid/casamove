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
}: {
  dict: Dict;
  locale: Locale;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = signedIn
    ? navigation
    : navigation.filter(([, label]) => label !== "space");
  const rest = pathname.replace(/^\/(fr|ar|en)(?=\/|$)/, "");

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link
          href={`/${locale}`}
          className="brand"
          aria-label={`CasaMove, ${dict.meta.title}`}
        >
          <span className="brand__mark" aria-hidden />
          CasaMove
        </Link>

        <nav
          id="site-nav"
          className={open ? "nav nav--open" : "nav"}
          aria-label={dict.a11y.menu}
        >
          {links.map(([path, label]) => (
            <a
              key={label}
              href={`/${locale}${path}`}
              className={
                pathname === `/${locale}${path}` ? "is-active" : undefined
              }
              aria-current={
                pathname === `/${locale}${path}` ? "page" : undefined
              }
              onClick={() => setOpen(false)}
            >
              {mobilityText(locale, label)}
            </a>
          ))}

          <div className="nav__extras">
            <div className="lang" aria-label={dict.a11y.language}>
              {locales.map((item) => (
                <Link
                  key={item}
                  href={`/${item}${rest}`}
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
                  redirectTo={`/${locale}`}
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
