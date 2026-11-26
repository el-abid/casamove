"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/content/dictionary";
import {
  mobilityText,
  mobilityValue,
  type MobilityLabel,
} from "@/content/mobility";
import { stationById } from "@/lib/mobility/network";
import type {
  MobilityPreferences,
  Notice,
  PassengerSpace,
  SavedJourney,
} from "@/lib/mobility/store";
import {
  activeJourneyKey,
  formatTime,
  mobilityRequest,
  sessionValue,
} from "./client";
import { LineBadge, stationName, StationPicker } from "./NetworkMap";

const noticeLabel: Record<Notice["kind"], MobilityLabel> = {
  incident: "impact",
  resolution: "resolution",
  report: "reportUpdate",
  subscription: "subscriptionUpdate",
  complaint: "complaintUpdate",
};

function PreferencesForm({
  locale,
  preferences,
  save,
}: {
  locale: Locale;
  preferences: MobilityPreferences;
  save: (values: MobilityPreferences) => Promise<void>;
}) {
  const t = (label: MobilityLabel) => mobilityText(locale, label);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = data.get("language");
    const language =
      value === "fr" || value === "ar" || value === "en" ? value : null;
    void save({
      accessibility: data.has("accessibility"),
      history: data.has("history"),
      notifications: data.has("notifications"),
      language,
    });
  }
  return (
    <form className="mob-form" onSubmit={submit}>
      <label className="mob-check">
        <input
          defaultChecked={preferences.accessibility}
          type="checkbox"
          name="accessibility"
        />
        {t("accessible")}
      </label>
      <label className="mob-check">
        <input
          defaultChecked={preferences.history}
          type="checkbox"
          name="history"
        />
        {t("consentHistory")}
      </label>
      <label className="mob-check">
        <input
          defaultChecked={preferences.notifications}
          type="checkbox"
          name="notifications"
        />
        {t("disruptionNotices")}
      </label>
      <label>
        {t("language")}
        <select name="language" defaultValue={preferences.language ?? ""}>
          <option value="">{t("browserLanguage")}</option>
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
      </label>
      <button className="mob-button mob-primary">{t("save")}</button>
    </form>
  );
}

export function PersonalSpace({ locale }: { locale: Locale }) {
  const t = (label: MobilityLabel) => mobilityText(locale, label);
  const [space, setSpace] = useState<PassengerSpace>();
  const [favourite, setFavourite] = useState("");
  const [feedback, setFeedback] = useState<MobilityLabel>();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setSpace(
      await mobilityRequest<PassengerSpace>("space", "GET", undefined, signal)
    );
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setActive(!!sessionValue(activeJourneyKey));
    const poll = () => {
      void refresh(controller.signal).catch(() => {
        if (!controller.signal.aborted)
          setFeedback(navigator.onLine ? "failure" : "serviceOffline");
      });
    };
    poll();
    const timer = setInterval(poll, 8000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [refresh]);
  async function write(path: string, method: string, data: unknown) {
    setBusy(true);
    setFeedback(undefined);
    try {
      await mobilityRequest(path, method, data);
      await refresh();
      setFeedback("success");
      return true;
    } catch {
      setFeedback(navigator.onLine ? "failure" : "serviceOffline");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const route = (item: SavedJourney) =>
    `/${locale}/journey?from=${item.from}&to=${item.to}&preference=${item.preference}`;
  const frequency = new Map<
    string,
    { from: string; to: string; count: number }
  >();
  for (const item of space?.history ?? []) {
    const key = `${item.from}:${item.to}`;
    const count = (frequency.get(key)?.count ?? 0) + 1;
    frequency.set(key, { from: item.from, to: item.to, count });
  }
  const frequent = [...frequency.values()]
    .filter(({ count }) => count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const empty = <p className="mob-muted">{t("empty")}</p>;
  const noticeHref = (notice: Notice) => {
    if (notice.kind === "report") return `#report-${notice.target}`;
    if (notice.kind === "subscription") return "#mobility-wallet";
    if (notice.kind === "complaint") return "#account-complaints";
    return `#saved-${notice.target}`;
  };

  return (
    <div className="mob-personal" aria-busy={busy}>
      {feedback && (
        <p
          role="status"
          className={feedback === "success" ? "mob-muted" : "mob-error"}
        >
          {t(feedback)}
        </p>
      )}
      {!space ? (
        !feedback && <p role="status">{t("checking")}</p>
      ) : (
        <div className="mob-personal-grid">
          <section className="mob-card">
            <h2>{t("saved")}</h2>
            {active && (
              <Link
                className="mob-button mob-primary"
                href={`/${locale}/journey`}
              >
                {t("resume")} · {t("companion")}
              </Link>
            )}
            {!space.saved.length ? (
              empty
            ) : (
              <ul className="mob-account-list">
                {space.saved.map((item) => (
                  <li key={item.id} id={`saved-${item.id}`}>
                    <Link href={route(item)}>
                      <strong>{item.name}</strong>
                    </Link>
                    <span>
                      {stationName(item.from, locale)}{" "}
                      <span className="mob-arrow" aria-hidden>
                        →
                      </span>{" "}
                      {stationName(item.to, locale)}
                    </span>
                    {item.affected && (
                      <span className="mob-tag">
                        {t("demo")} · {t("affected")}
                      </span>
                    )}
                    <details>
                      <summary>{t("settings")}</summary>
                      <form
                        className="mob-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const values = new FormData(event.currentTarget);
                          void write(`routes/saved/${item.id}`, "PATCH", {
                            name: values.get("name"),
                            notify: values.has("notify"),
                          });
                        }}
                      >
                        <label>
                          {t("routeName")}
                          <input
                            name="name"
                            defaultValue={item.name}
                            required
                            maxLength={60}
                          />
                        </label>
                        <label className="mob-check">
                          <input
                            type="checkbox"
                            name="notify"
                            defaultChecked={item.notify}
                          />
                          {t("notifications")}
                        </label>
                        <div className="mob-inline">
                          <button className="mob-button" disabled={busy}>
                            {t("save")}
                          </button>
                          <button
                            type="button"
                            className="mob-button"
                            disabled={busy}
                            onClick={() =>
                              void write(
                                `routes/saved/${item.id}`,
                                "DELETE",
                                {}
                              )
                            }
                          >
                            {t("remove")}
                          </button>
                        </div>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            {!!frequent.length && (
              <div className="mob-form">
                <h3>{t("frequent")}</h3>
                {frequent.map(({ from, to, count }) => (
                  <Link
                    key={`${from}:${to}`}
                    href={`/${locale}/journey?from=${from}&to=${to}`}
                  >
                    {stationName(from, locale)} ↔ {stationName(to, locale)} ·{" "}
                    {count}
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section className="mob-card">
            <h2>{t("favourites")}</h2>
            <div className="mob-inline">
              <StationPicker
                locale={locale}
                label={t("station")}
                selected={favourite}
                onChange={setFavourite}
              />
              <button
                className="mob-button"
                disabled={!favourite || busy}
                onClick={() => {
                  void write("favourites", "POST", {
                    station: favourite,
                    add: true,
                  });
                  setFavourite("");
                }}
              >
                {t("add")}
              </button>
            </div>
            {!space.favourites.length ? (
              empty
            ) : (
              <ul className="mob-account-list">
                {space.favourites.map((id) => (
                  <li key={id} className="mob-favourite">
                    <Link href={`/${locale}/journey?from=${id}`}>
                      <LineBadge id={stationById.get(id)!.line} />{" "}
                      {stationName(id, locale)}
                    </Link>
                    <button
                      className="mob-button"
                      disabled={busy}
                      onClick={() =>
                        void write("favourites", "POST", {
                          station: id,
                          add: false,
                        })
                      }
                    >
                      {t("remove")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="mob-card" id="mobility-notifications">
            <div className="mob-section-heading">
              <h2>
                {t("notifications")}{" "}
                <span className="mob-count">
                  {space.notices.filter((item) => !item.read).length}
                </span>
              </h2>
              <button
                className="mob-button"
                disabled={busy || !space.notices.some((item) => !item.read)}
                onClick={() => void write("notifications", "PATCH", {})}
              >
                {t("readAll")}
              </button>
            </div>
            {!space.notices.length ? (
              empty
            ) : (
              <ul className="mob-account-list mob-notices">
                {space.notices.map((notice) => (
                  <li key={notice.id} data-read={notice.read}>
                    <Link href={noticeHref(notice)}>
                      <strong>{t(noticeLabel[notice.kind])}</strong>
                    </Link>
                    <span>
                      {notice.kind === "report"
                        ? mobilityValue(locale, notice.title)
                        : notice.title}
                    </span>
                    {(notice.kind === "incident" ||
                      notice.kind === "resolution") && (
                      <small>{t("demo")}</small>
                    )}
                    <time>{formatTime(notice.date, locale)}</time>
                    {notice.read ? (
                      <small>{t("read")}</small>
                    ) : (
                      <button
                        className="mob-button"
                        disabled={busy}
                        onClick={() =>
                          void write("notifications", "PATCH", {
                            ids: [notice.id],
                          })
                        }
                      >
                        {t("markRead")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="mob-card">
            <h2>{t("settings")}</h2>
            <PreferencesForm
              locale={locale}
              preferences={space.preferences}
              save={async (preferences) => {
                const saved = await write("preferences", "PATCH", preferences);
                if (
                  saved &&
                  preferences.language &&
                  preferences.language !== locale
                )
                  window.location.assign(`/${preferences.language}/account`);
              }}
            />
          </section>
          <section className="mob-card">
            <h2>{t("reports")}</h2>
            {!space.reports.length ? (
              empty
            ) : (
              <ul className="mob-account-list">
                {space.reports.map((report) => (
                  <li key={report.id} id={`report-${report.id}`}>
                    <strong>
                      {mobilityValue(locale, report.category)} ·{" "}
                      {stationName(report.station, locale)}
                      {report.endStation &&
                        ` ↔ ${stationName(report.endStation, locale)}`}
                    </strong>
                    <span>{mobilityValue(locale, report.status)}</span>
                    <time>{formatTime(report.createdAt, locale)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="mob-card">
            <h2>{t("history")}</h2>
            {!space.history.length ? (
              empty
            ) : (
              <ul className="mob-account-list">
                {space.history.map((item, index) => (
                  <li key={index}>
                    <Link
                      href={`/${locale}/journey?from=${item.from}&to=${item.to}`}
                    >
                      {stationName(item.from, locale)} →{" "}
                      {stationName(item.to, locale)}
                    </Link>
                    <time>{formatTime(item.completedAt, locale)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
