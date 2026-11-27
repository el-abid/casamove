import type { Locale } from "@/content/dictionary";
import { portalText } from "@/content/portal";

export function PortalFooter({ locale }: { locale: Locale }) {
  return (
    <footer className="portal-footer">
      <div className="portal-container portal-footer__inner">
        <span className="portal-footer__brand">
          {portalText(locale, "brand")}
        </span>
        <p>{portalText(locale, "footer")}</p>
      </div>
    </footer>
  );
}
