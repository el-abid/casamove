import Link from "next/link";
import { contact, socials } from "@/content/site";
import type { Dict, Locale } from "@/content/dictionary";

export function Footer({ dict, locale }: { dict: Dict; locale: Locale }) {
  return (
    <footer className="footer" id="contact">
      <div className="container">
        <div className="footer__grid">
          <div>
            <Link href={`/${locale}`} className="brand">
              <span className="brand__mark" aria-hidden />
              CasaMove
            </Link>
            <p>{dict.utility.network}</p>
          </div>

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
              {dict.footer.links.map((link) => (
                <a key={link} href="#contact">
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <span>{dict.footer.rights}</span>
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
        </div>
      </div>
    </footer>
  );
}
