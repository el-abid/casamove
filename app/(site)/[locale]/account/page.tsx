import "@/components/portal/portal.css";
import { notFound } from "next/navigation";

import { LogoutButton } from "@/components/site/LogoutButton";
import { PersonalSpace } from "@/components/mobility/PersonalSpace";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { ProviderScope } from "@/components/providers/ProviderContext";
import { dictionary, isLocale } from "@/content/dictionary";
import { mobilityText } from "@/content/mobility";
import { listTicketsByUser } from "@/lib/agent/tickets";
import {
  describeSubscription,
  getSubscription,
} from "@/lib/agent/subscriptions";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const providerLabels: Record<string, string> = {
  tram: "CasaMove",
  bus: "Casabus",
  train: "ONCF",
  air: "Aéroports",
  port: "Ports",
};

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const base = `/${locale}/account`;
  const dict = dictionary[locale];
  const user = await requireUser(base);
  const tickets = await listTicketsByUser(user.id);
  const subscription = await getSubscription(user.id);
  const subscriptionInfo = subscription
    ? describeSubscription(subscription, locale)
    : null;
  const replies = tickets.filter(
    (ticket) => ticket.status === "in_progress" || ticket.status === "resolved"
  );

  const dateTag =
    locale === "ar" ? "ar-MA" : locale === "en" ? "en-GB" : "fr-FR";
  const dateFormat = new Intl.DateTimeFormat(dateTag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Casablanca",
  });

  return (
    <>
      <PortalHeader
        locale={locale}
        signedIn
        languageLabel={dict.a11y.language}
      />
      <main className="section mob-site mob-account" id="main-content">
        <div className="container account">
          <header className="account__head" data-reveal>
            <div>
              <span className="kicker">{dict.account.title}</span>
              <h1>{user.fullName}</h1>
              <p>{dict.account.subtitle}</p>
            </div>
            <LogoutButton label={dict.account.logout} redirectTo={`/${locale}`} />
          </header>

        <div className="account__grid">
          <aside className="account__card" data-reveal>
            <h2>{dict.account.email}</h2>
            <p className="account__value">{user.email}</p>
            <h2>{dict.account.phone}</h2>
            <p className="account__value">{user.phone ?? "—"}</p>
          </aside>

          <section className="account__card" id="account-complaints" data-reveal>
            <h2>{dict.account.tickets}</h2>

            {tickets.length === 0 ? (
              <p className="account__empty">{dict.account.empty}</p>
            ) : (
              <div className="account__list">
                {tickets.map((ticket) => (
                  <div className="account__row" key={ticket.number}>
                    <span className="account__id">{ticket.number}</span>
                    <span className="account__theme">
                      <span
                        className={`account__provider account__provider--${ticket.provider}`}
                      >
                        {providerLabels[ticket.provider] ?? ticket.provider}
                      </span>
                      {ticket.theme}
                    </span>
                    <span
                      className={`account__prio account__prio--${ticket.priority.toLowerCase()}`}
                    >
                      {ticket.priority}
                    </span>
                    <span
                      className={`account__status account__status--${ticket.status}`}
                    >
                      {dict.account.status[ticket.status]}
                    </span>
                    <time>{dateFormat.format(new Date(ticket.createdAt))}</time>
                  </div>
                ))}
              </div>
            )}
          </section>

          {replies.length > 0 ? (
            <section className="account__card account__replies" data-reveal>
              <h2>{dict.account.responses}</h2>
              <div className="account__list">
                {replies.map((ticket) => (
                  <details className="account__reply" key={ticket.number}>
                    <summary>
                      <span className="account__id">{ticket.number}</span>
                      <span>{ticket.theme}</span>
                    </summary>
                    <p>{ticket.draft}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <section
          id="mobility-wallet"
          className="account__card account__sub mob-wallet"
          data-reveal
        >
          <span className="mob-tag">{mobilityText(locale, "demoWallet")}</span>
          <h2>{mobilityText(locale, "wallet")}</h2>

          {subscriptionInfo && subscription ? (
            <div className="account__subrow">
              <div>
                <span>{dict.account.subscription}</span>
                <b>
                  {subscriptionInfo.planLabel} · {subscriptionInfo.statusLabel}
                </b>
              </div>
              <div>
                <span>{mobilityText(locale, "validity")}</span>
                <b>
                  {dateFormat.formatRange(
                    new Date(subscription.startedAt),
                    new Date(subscriptionInfo.endsAt)
                  )}
                </b>
              </div>
              <div>
                <span>{dict.account.daysLeft}</span>
                <b>{subscriptionInfo.daysLeft}</b>
              </div>
              <div>
                <span>{mobilityText(locale, "renewal")}</span>
                <b>
                  {mobilityText(
                    locale,
                    subscription.autoRenew ? "enabled" : "disabled"
                  )}
                </b>
              </div>
            </div>
          ) : (
            <p className="account__empty">{dict.account.noSubscription}</p>
          )}
        </section>
        <ProviderScope value={{ id: "tram", base: `/${locale}/tram` }}>
          <PersonalSpace locale={locale} />
        </ProviderScope>
      </div>
      </main>
      <PortalFooter locale={locale} />
    </>
  );
}
