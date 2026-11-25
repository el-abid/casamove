"use client";

import Link from "next/link";
import { useState } from "react";
import { navItems } from "@/content/site";
import type { Dict, Locale } from "@/content/dictionary";

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function Header({ dict, locale }: { dict: Dict; locale: Locale }) {
  const [open, setOpen] = useState(false);

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
          {navItems.map((item, index) => (
            <Link
              key={item.key}
              href={item.href}
              className={index === 0 ? "is-active" : undefined}
              aria-current={index === 0 ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {dict.nav[item.key]}
            </Link>
          ))}
        </nav>

        <div className="header__actions">
          <div className="search">
            <SearchIcon />
            {dict.header.search}
          </div>
          <Link className="btn" href="#tarifs">
            {dict.header.recharge}
          </Link>
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
