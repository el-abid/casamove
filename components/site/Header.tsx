"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { mobilityText } from "@/content/mobility";
import type { Dict, Locale } from "@/content/dictionary";

const navigation = [
  ["", "home"],
  ["/journey", "journey"],
  ["/network", "network"],
  ["/traffic", "traffic"],
  ["/reports", "reports"],
  ["/account", "space"],
  ["/assistance", "help"],
] as const;

export function Header({ dict, locale }: { dict: Dict; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
          {navigation.map(([path, label]) => (
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
