"use client";

import { useMemo, useState } from "react";

import { alsaText, type AlsaLabel } from "@/content/alsa";
import network from "@/content/providers/alsa/network.json";
import type { Locale } from "@/content/dictionary";
import { Icon } from "@/components/ui/Icon";

type BusStop = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  sequence: number;
  time: string | null;
};

type BusRoute = {
  id: string;
  shortName: string;
  color: string;
  textColor: string;
  from: string | null;
  to: string | null;
  firstTime: string | null;
  lastTime: string | null;
  frequencyMinutes: number | null;
  durationMinutes: number | null;
  stops: BusStop[];
};

type BusNetwork = {
  operator: string;
  source: string;
  fetchedAt: string;
  routes: BusRoute[];
};

const data = network as BusNetwork;
const fetchedOn = data.fetchedAt.slice(0, 10);
const uniqueStops = new Set(
  data.routes.flatMap((route) => route.stops.map((stop) => stop.id))
).size;

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const clock = (value: string | null) => (value ? value.slice(0, 5) : "—");

const clean = (value: string | null) =>
  (value ?? "")
    .replace(/^_+/, "")
    .replace(/A EROPORT/g, "AÉROPORT")
    .replace(/\s+/g, " ")
    .trim();

export function BusHome({ locale }: { locale: Locale }) {
  const t = (label: AlsaLabel) => alsaText(locale, label);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const routes = useMemo(() => {
    const needle = fold(query.trim());
    if (!needle) return data.routes;
    return data.routes.filter((route) =>
      [route.shortName, route.from, route.to, ...route.stops.map((s) => s.name)]
        .filter((value): value is string => Boolean(value))
        .some((value) => fold(value).includes(needle))
    );
  }, [query]);

  const selected = data.routes.find((route) => route.id === selectedId);

  return (
    <main id="main-content" className="mob-site bus-page">
      <section className="bus-hero">
        <span className="bus-kicker">{t("kicker")}</span>
        <h1>{t("title")}</h1>
        <p>{t("text")}</p>
        <div className="bus-stats">
          <div>
            <b>{data.routes.length}</b>
            <span>{t("lines")}</span>
          </div>
          <div>
            <b>{uniqueStops}</b>
            <span>{t("stops")}</span>
          </div>
          <div>
            <b>2</b>
            <span>{t("cities")}</span>
          </div>
        </div>
      </section>

      <div className={`bus-body${selected ? " has-selection" : ""}`}>
        <section className="bus-list">
          <div className="bus-search">
            <Icon name="bus" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
            />
            <span className="bus-count">
              {routes.length} {t("results")}
            </span>
          </div>
          <p className="bus-hint">{t("searchHint")}</p>

          <div className="bus-lines">
            {routes.map((route) => (
              <button
                key={route.id}
                type="button"
                className={`bus-line${
                  route.id === selectedId ? " is-selected" : ""
                }`}
                style={{ ["--line-color" as string]: route.color }}
                aria-pressed={route.id === selectedId}
                onClick={() =>
                  setSelectedId((current) =>
                    current === route.id ? null : route.id
                  )
                }
              >
                <span
                  className="bus-badge"
                  style={{ background: route.color, color: route.textColor }}
                >
                  {route.shortName}
                </span>
                <span className="bus-line__route">
                  <b>{clean(route.from) || t("terminus")}</b>
                  <small>{clean(route.to)}</small>
                </span>
                <span className="bus-line__meta">
                  {route.frequencyMinutes
                    ? `${route.frequencyMinutes} ${t("minutes")}`
                    : clock(route.firstTime)}
                </span>
              </button>
            ))}
          </div>

          {routes.length === 0 ? (
            <p className="bus-empty">{t("noResult")}</p>
          ) : null}

          <p className="bus-data">
            {t("data")} <b>{fetchedOn}</b> ·{" "}
            <a href={data.source} target="_blank" rel="noreferrer">
              {t("source")}
            </a>
          </p>
        </section>

        <aside className="bus-detail" aria-live="polite">
          {selected ? (
            <>
              <header
                className="bus-detail__head"
                style={{ ["--line-color" as string]: selected.color }}
              >
                <span
                  className="bus-badge"
                  style={{
                    background: selected.color,
                    color: selected.textColor,
                  }}
                >
                  {selected.shortName}
                </span>
                <h2>
                  {clean(selected.from)} <span aria-hidden>→</span>{" "}
                  {clean(selected.to)}
                </h2>
                <div className="bus-facts">
                  <span>
                    <b>{selected.frequencyMinutes ?? "—"}</b> {t("minutes")}
                  </span>
                  <span>
                    <b>{selected.durationMinutes ?? "—"}</b> {t("minutes")}
                  </span>
                  <span>
                    <b>{selected.stops.length}</b> {t("stops")}
                  </span>
                  <span>
                    <b>{clock(selected.firstTime)}</b> {t("first")}
                  </span>
                </div>
              </header>

              <h3>{t("allStops")}</h3>
              <ol className="bus-stops">
                {selected.stops.map((stop) => (
                  <li key={`${selected.id}-${stop.sequence}-${stop.id}`}>
                    <span className="bus-dot" aria-hidden />
                    <span>{clean(stop.name)}</span>
                    <time>{clock(stop.time)}</time>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <div className="bus-detail__empty">
              <Icon name="bus" size={24} />
              <p>{t("select")}</p>
            </div>
          )}
        </aside>
      </div>

      <p className="bus-about">{t("about")}</p>
    </main>
  );
}
