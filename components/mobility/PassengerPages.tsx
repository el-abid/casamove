"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/content/dictionary";
import {
  mobilityText,
  mobilityValue,
  type MobilityLabel,
} from "@/content/mobility";
import { Icon } from "@/components/ui/Icon";
import { useProviderScope } from "@/components/providers/ProviderContext";
import { lines, network, stations } from "@/lib/mobility/network";
import type { PassengerSpace, Report } from "@/lib/mobility/store";
import { JourneyPlanner, StatusPanel } from "./JourneyPlanner";
import { LineBadge, NetworkMap, stationName } from "./NetworkMap";
import {
  formatTime,
  MobilityRequestError,
  mobilityRequest,
  useNetworkStatus,
} from "./client";
import { GeographicMap } from "./GeographicMap";
import { reportCategories, severities } from "@/lib/mobility/categories";

export function PassengerHome({ locale }: { locale: Locale }) {
  const t = (label: MobilityLabel) => mobilityText(locale, label);
  const { base } = useProviderScope(locale);
  const status = useNetworkStatus();
  const [saved, setSaved] = useState<PassengerSpace["saved"]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void mobilityRequest<PassengerSpace>(
      "space",
      "GET",
      undefined,
      controller.signal
    )
      .then((space) => setSaved(space.saved.slice(0, 3)))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <>
      <section className="mob-hero">
        <div className="mob-hero-copy">
          <span className="mob-hero-caption">
            <Icon name="tram" size={18} /> {t("tramway")} &amp; {t("busway")}
          </span>
          <h1>{t("hero")}</h1>
          <p>{t("heroText")}</p>
          <Link
            href={`${base}/network`}
            className="mob-button mob-hero-link"
          >
            {t("openNetwork")}{" "}
            <span className="mob-arrow" aria-hidden>
              →
            </span>
          </Link>
        </div>
        <JourneyPlanner locale={locale} compact />
      </section>
      <div className="mob-home-content">
        <section className="mob-home-network" data-reveal>
          <div className="mob-section-heading">
            <div>
              <h2>{t("network")}</h2>
              <p>
                {lines.length} {t("lines").toLocaleLowerCase(locale)} ·{" "}
                {stations.length} {t("stations").toLocaleLowerCase(locale)}
              </p>
            </div>
            <Link href={`${base}/network`}>
              {t("openNetwork")}{" "}
              <span className="mob-arrow" aria-hidden>
                ↗
              </span>
            </Link>
          </div>
          <div className="mob-line-grid">
            {lines.map((line) => (
              <Link
                key={line.id}
                href={`${base}/network?line=${line.id}`}
                style={{ borderBlockStartColor: line.color }}
              >
                <LineBadge id={line.id} />
                <span>
                  {stationName(line.stations[0], locale)}
                  <small>{stationName(line.stations.at(-1)!, locale)}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="mob-home-status" data-reveal>
          <div className="mob-section-heading">
            <h2>{t("traffic")}</h2>
            <Link href={`${base}/traffic`}>
              {t("details")} <span aria-hidden>↗</span>
            </Link>
          </div>
          <StatusPanel locale={locale} state={status} compact />
        </section>
        {saved.length > 0 && (
          <section className="mob-card mob-home-saved" data-reveal>
            <h2>{t("saved")}</h2>
            <div className="mob-inline">
              {saved.map((item) => (
                <Link
                  className="mob-button"
                  key={item.id}
                  href={`${base}/journey?from=${item.from}&to=${item.to}&preference=${item.preference}`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </section>
        )}
        <section id="tarifs" className="mob-shortcuts" data-reveal>
          {(
            [
              ["reports", "reports", "map"],
              ["account", "subscriptions", "shop"],
              ["assistance", "help", "chat"],
            ] as const
          ).map(([path, label, icon]) => (
            <Link key={path} href={`${base}/${path}`} className="mob-card">
              <Icon name={icon} />
              <strong>{t(label)}</strong>
              <span className="mob-arrow" aria-hidden>
                ↗
              </span>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}

export function NetworkPage({ locale }: { locale: Locale }) {
  const t = (label: MobilityLabel) => mobilityText(locale, label);
  const result = useNetworkStatus();
  const [geographic, setGeographic] = useState(false);
  const [line, setLine] = useState<(typeof lines)[number]["id"]>();
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("line");
    setLine(lines.find((line) => line.id === id)?.id);
  }, []);
  return (
    <>
      <div className="mob-filters mob-map-toggle" aria-label={t("network")} data-reveal>
        <button
          type="button"
          aria-pressed={!geographic}
          onClick={() => setGeographic(false)}
        >
          {t("schematic")}
        </button>
        <button
          type="button"
          aria-pressed={geographic}
          onClick={() => setGeographic(true)}
        >
          {t("geographic")}
        </button>
      </div>
      {geographic ? (
        <GeographicMap locale={locale} />
      ) : (
        <NetworkMap
          key={line}
          locale={locale}
          impacts={result.status?.incidents}
          initialLine={line}
        />
      )}
      <StatusPanel locale={locale} state={result} compact />
    </>
  );
}

export function TrafficPage({ locale }: { locale: Locale }) {
  const state = useNetworkStatus();
  return (
    <>
      <StatusPanel locale={locale} state={state} />
      <NetworkMap locale={locale} impacts={state.status?.incidents} />
    </>
  );
}

export function ReportForm({ locale }: { locale: Locale }) {
  const t = (label: MobilityLabel) => mobilityText(locale, label);
  const { base } = useProviderScope(locale);
  const [line, setLine] = useState("");
  const [station, setStation] = useState("");
  const [feedback, setFeedback] = useState<MobilityLabel>();
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/me", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        setAuthenticated(response.ok && !!body.user);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });
    return () => controller.abort();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      const response = await mobilityRequest<{
        report: Report;
        duplicate: boolean;
      }>("reports", "POST", {
        station,
        endStation: data.get("endStation") || null,
        category: data.get("category"),
        description: data.get("description"),
        severity: data.get("severity"),
      });
      setFeedback(response.duplicate ? "reportDuplicate" : "reportSubmitted");
      if (!response.duplicate) {
        form.reset();
        setStation("");
        setLine("");
      }
    } catch (error) {
      setFeedback(
        !navigator.onLine
          ? "serviceOffline"
          : error instanceof MobilityRequestError && error.status === 429
            ? "rateLimit"
            : error instanceof MobilityRequestError && error.status === 401
              ? "guestReport"
              : "failure"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mob-card mob-form-panel" data-reveal>
      <p>{t("reportIntro")}</p>
      {!loaded && <p role="status">{t("checking")}</p>}
      {loaded && !authenticated && (
        <div>
          <p>{t("guestReport")}</p>
          <Link
            className="mob-button mob-primary"
            href={`/login?next=${encodeURIComponent(`${base}/reports`)}`}
          >
            {t("signIn")}
          </Link>
        </div>
      )}
      {authenticated && (
        <form onSubmit={submit} className="mob-form">
          <div className="mob-form-grid">
            <label>
              {t("lines")}
              <select
                name="line"
                aria-label={t("lines")}
                required
                value={line}
                onChange={(event) => {
                  setLine(event.target.value);
                  setStation("");
                }}
              >
                <option value="">{t("choose")}</option>
                {lines.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} · {t(item.mode)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("station")}
              <select
                name="station"
                aria-label={t("station")}
                required
                value={station}
                disabled={!line}
                onChange={(event) => setStation(event.target.value)}
              >
                <option value="">{t("choose")}</option>
                {lines
                  .find((item) => item.id === line)
                  ?.stations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {stationName(item, locale)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t("segmentEnd")}
              <select
                name="endStation"
                aria-label={t("segmentEnd")}
                key={station}
                disabled={!station}
              >
                <option value="">—</option>
                {lines
                  .find((item) => item.id === line)
                  ?.stations.filter((item) => item.id !== station)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {stationName(item, locale)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t("category")}
              <select required name="category" aria-label={t("category")}>
                {reportCategories.map((item) => (
                  <option key={item} value={item}>
                    {mobilityValue(locale, item)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("severity")}
              <select name="severity" aria-label={t("severity")}>
                {severities.map((item) => (
                  <option key={item} value={item}>
                    {mobilityValue(locale, item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            {t("description")}
            <textarea name="description" maxLength={600} rows={4} />
          </label>
          <button className="mob-button mob-primary" disabled={busy}>
            {t("reportSend")}
          </button>
        </form>
      )}
      {feedback && <p role="status">{t(feedback)}</p>}
    </section>
  );
}

export function AssistancePage({ locale }: { locale: Locale }) {
  const t = (label: MobilityLabel) => mobilityText(locale, label);
  const { base } = useProviderScope(locale);
  return (
    <section className="mob-card mob-form-panel" data-reveal>
      <p>{t("assistText")}</p>
      <div className="mob-inline">
        <Link className="mob-button" href={`/${locale}/account`}>
          {t("space")}
        </Link>
        <a className="mob-button" href="tel:+212522998383">
          <bdi>+212 5 22 99 83 83</bdi>
        </a>
        <a className="mob-button" href={network.operatorTraffic}>
          {t("official")}
        </a>
      </div>
    </section>
  );
}
