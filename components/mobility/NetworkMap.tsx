"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import type { Locale } from "@/content/dictionary";
import { mobilityText, mobilityValue } from "@/content/mobility";
import {
  edgeId,
  findStations,
  lineById,
  lines,
  network,
  rideEdges,
  stationById,
  transfers,
  type LineId,
  type Station,
} from "@/lib/mobility/network";
import {
  edgeWithinImpact,
  type Impact,
  type Journey,
} from "@/lib/mobility/routing";

export function stationName(station: Station | string, locale: Locale): string {
  const value =
    typeof station === "string" ? stationById.get(station) : station;
  return value ? value[locale === "ar" ? "ar" : "fr"] : "";
}

export function LineBadge({ id }: { id: LineId }) {
  const line = lineById.get(id)!;
  return (
    <span
      dir="ltr"
      className="mob-badge"
      style={{ backgroundColor: line.color, color: line.ink }}
    >
      {id}
    </span>
  );
}

export function StationPicker({
  locale,
  label,
  selected,
  onChange,
  recent = [],
  required = false,
  onlyBoardable = true,
}: {
  locale: Locale;
  label: string;
  selected: string;
  onChange: (id: string) => void;
  recent?: readonly string[];
  required?: boolean;
  onlyBoardable?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(-1);
  const list = query
    ? findStations(query, 8, onlyBoardable)
    : recent.length
      ? recent.flatMap((id) => stationById.get(id) ?? [])
      : findStations("", 6, onlyBoardable);
  const select = (value: string) => {
    onChange(value);
    setQuery("");
    setFocused(-1);
    setOpen(false);
  };
  return (
    <div className="mob-combobox">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={
          open && focused >= 0 ? `${id}-${focused}` : undefined
        }
        aria-required={required}
        placeholder={mobilityText(locale, "search")}
        value={selected ? stationName(selected, locale) : query}
        onFocus={() => {
          setQuery(selected ? stationName(selected, locale) : "");
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          onChange("");
          setQuery(event.target.value);
          setOpen(true);
          setFocused(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setFocused((index) =>
              Math.max(
                0,
                Math.min(
                  list.length - 1,
                  index + (event.key === "ArrowDown" ? 1 : -1)
                )
              )
            );
          }
          if (event.key === "Enter" && open && list[focused]) {
            event.preventDefault();
            select(list[focused].id);
          }
        }}
      />
      {open && (
        <ul
          id={`${id}-list`}
          className="mob-suggestions"
          role="listbox"
          aria-label={label}
        >
          {!list.length && (
            <li role="presentation">{mobilityText(locale, "noneFound")}</li>
          )}
          {!query && recent.length > 0 && (
            <li className="mob-muted" role="presentation">
              {mobilityText(locale, "recents")}
            </li>
          )}
          {list.map((station, index) => (
            <li
              key={station.id}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === focused}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => select(station.id)}
            >
              <LineBadge id={station.line} />
              <span>{stationName(station, locale)}</span>
              {locale !== "ar" && (
                <small lang="ar" dir="rtl">
                  {station.ar}
                </small>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function stationImpacts(station: Station, impacts: readonly Impact[]) {
  return impacts.filter((impact) => {
    if (impact.line !== station.line) return false;
    if (!impact.station) return true;
    const start = stationById.get(impact.station)!.order;
    const end = impact.endStation
      ? stationById.get(impact.endStation)!.order
      : start;
    return (
      station.order >= Math.min(start, end) &&
      station.order <= Math.max(start, end)
    );
  });
}

export function NetworkMap({
  locale,
  journey,
  impacts = [],
  showDirectory = true,
  initialLine,
  id,
}: {
  locale: Locale;
  journey?: Journey;
  impacts?: readonly Impact[];
  showDirectory?: boolean;
  initialLine?: LineId;
  id?: string;
}) {
  const t = (label: Parameters<typeof mobilityText>[1]) =>
    mobilityText(locale, label);
  const [selected, setSelected] = useState<string>();
  const [filter, setFilter] = useState<LineId | "all">(initialLine ?? "all");
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const path = new Set(
    journey?.stations
      .slice(1)
      .map((to, index) => edgeId(journey.stations[index], to))
  );
  const highlighted = new Set(journey?.stations);
  const transferStations = new Set(
    transfers.flatMap((edge) => [edge.from, edge.to])
  );
  const visible = lines.filter(
    (line) => filter === "all" || line.id === filter
  );
  const selectedStation = selected ? stationById.get(selected) : null;
  const y = (station: Station) => (filter === "all" ? station.schematic.y : 82);
  const x = (station: Station) => station.schematic.x;
  const directory = query
    ? findStations(query, 151).filter(
        (station) => filter === "all" || station.line === filter
      )
    : visible.flatMap((line) => line.stations);
  const title = useId();

  function chooseFilter(value: LineId | "all") {
    setFilter(value);
    setSelected(undefined);
  }

  return (
    <section className="mob-map" id={id} aria-label={t("schematic")}>
      <div className="mob-map-toolbar">
        <div className="mob-filters" aria-label={t("lines")}>
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => chooseFilter("all")}
          >
            {t("allLines")}
          </button>
          {lines.map((line) => (
            <button
              type="button"
              key={line.id}
              aria-pressed={filter === line.id}
              onClick={() => chooseFilter(line.id)}
            >
              <LineBadge id={line.id} />
            </button>
          ))}
        </div>
        <div className="mob-filters">
          <button
            type="button"
            aria-label={t("zoomOut")}
            disabled={zoom <= 1}
            onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
          >
            −
          </button>
          <button
            type="button"
            aria-label={t("zoomIn")}
            disabled={zoom >= 2.5}
            onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              viewport.current?.scrollTo(0, 0);
            }}
          >
            {t("reset")}
          </button>
        </div>
      </div>
      <div
        className="mob-map-viewport"
        data-zoomed={zoom > 1}
        dir="ltr"
        ref={viewport}
        tabIndex={0}
        aria-label={t("schematic")}
        onPointerDown={(event) => {
          if (
            event.pointerType !== "mouse" ||
            event.button !== 0 ||
            (event.target as Element).closest("[data-station]")
          )
            return;
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          event.currentTarget.scrollLeft =
            drag.current.left + drag.current.x - event.clientX;
          event.currentTarget.scrollTop =
            drag.current.top + drag.current.y - event.clientY;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        <svg
          viewBox={`0 0 1040 ${filter === "all" ? 510 : 165}`}
          style={{ width: `${zoom * 100}%`, minWidth: zoom * 750 }}
          role="group"
          aria-labelledby={title}
        >
          <title id={title}>{t("schematic")}</title>
          {filter === "all" &&
            transfers.map((edge) => {
              const a = stationById.get(edge.from)!;
              const b = stationById.get(edge.to)!;
              const middle = (y(a) + y(b)) / 2;
              const active = path.has(edge.id);
              return (
                <path
                  key={edge.id}
                  d={`M ${x(a)} ${y(a)} C ${x(a)} ${middle}, ${x(b)} ${middle}, ${x(b)} ${y(b)}`}
                  fill="none"
                  stroke={active ? "#142a42" : "#6c8093"}
                  opacity={active ? 1 : journey ? 0.16 : 0.45}
                  strokeWidth={active ? 4 : 1.5}
                  strokeDasharray={active ? "6 4" : "4 5"}
                />
              );
            })}
          {visible.map((line) => {
            const first = line.stations[0];
            const last = line.stations.at(-1)!;
            return (
              <g key={line.id}>
                <rect
                  x={27}
                  y={y(first) - 13}
                  width={52}
                  height={27}
                  rx={7}
                  fill={line.color}
                />
                <text
                  x={53}
                  y={y(first) + 5}
                  textAnchor="middle"
                  fill={line.ink}
                  className="mob-svg-badge"
                >
                  {line.id}
                </text>
                <text
                  x={x(first)}
                  y={y(first) - 20}
                  textAnchor="start"
                  className="mob-svg-label"
                >
                  {stationName(first, locale)}
                </text>
                <text
                  x={x(last)}
                  y={y(last) - 20}
                  textAnchor="end"
                  className="mob-svg-label"
                >
                  {stationName(last, locale)}
                </text>
                {rideEdges
                  .filter(
                    (edge) => stationById.get(edge.from)?.line === line.id
                  )
                  .map((edge) => {
                    const disrupted = impacts.some(
                      (impact) =>
                        (impact.effect === "segment-closure" ||
                          impact.effect === "line-suspension") &&
                        edgeWithinImpact(edge, impact)
                    );
                    return (
                      <line
                        key={edge.id}
                        x1={x(stationById.get(edge.from)!)}
                        x2={x(stationById.get(edge.to)!)}
                        y1={y(first)}
                        y2={y(first)}
                        stroke={disrupted ? "#b4233b" : line.color}
                        strokeWidth={path.has(edge.id) ? 10 : 5}
                        strokeDasharray={disrupted ? "3 3" : undefined}
                        opacity={
                          !journey || path.has(edge.id) || disrupted ? 1 : 0.33
                        }
                      />
                    );
                  })}
                {line.stations.map((station) => {
                  const isTransfer = transferStations.has(station.id);
                  const active = selected === station.id;
                  const disrupted = stationImpacts(station, impacts).some(
                    ({ effect }) => effect !== "information"
                  );
                  const ring =
                    active ||
                    highlighted.has(station.id) ||
                    station.terminus ||
                    isTransfer;
                  return (
                    <g
                      key={station.id}
                      data-station={station.id}
                      role="button"
                      tabIndex={
                        showDirectory ? -1 : active || station.terminus ? 0 : -1
                      }
                      aria-label={`${line.id} ${stationName(station, locale)}`}
                      aria-pressed={active}
                      onClick={() => setSelected(station.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(station.id);
                        }
                      }}
                    >
                      <title>{stationName(station, locale)}</title>
                      <circle
                        cx={x(station)}
                        cy={y(station)}
                        r={13}
                        fill="transparent"
                      />
                      <circle
                        cx={x(station)}
                        cy={y(station)}
                        r={active ? 9 : ring ? 6 : 3.5}
                        fill={
                          disrupted
                            ? "#b4233b"
                            : station.boarding === "unconfirmed"
                              ? "#b9c3cc"
                              : "#fff"
                        }
                        stroke={active || isTransfer ? "#142a42" : line.color}
                        strokeWidth={ring ? 3 : 1}
                      />
                      {disrupted && (
                        <path
                          d={`m${x(station) - 2} ${y(station) - 2} 4 4 m0 -4 -4 4`}
                          stroke="white"
                          strokeWidth={1.2}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      {showDirectory && (
        <p className="mob-muted mob-map-hint">{t("mapHint")}</p>
      )}
      {selectedStation && (
        <div className="mob-map-detail" aria-live="polite">
          <strong>
            <LineBadge id={selectedStation.line} />{" "}
            {stationName(selectedStation, locale)}
          </strong>
          {selectedStation.terminus && <span>{t("terminus")}</span>}
          {selectedStation.boarding === "unconfirmed" && (
            <span>{t("unconfirmed")}</span>
          )}
          {stationImpacts(selectedStation, impacts).map((impact, index) => (
            <span className="mob-warning" key={index}>
              {mobilityValue(locale, impact.effect)}
            </span>
          ))}
          {transfers
            .filter(
              (edge) =>
                edge.from === selectedStation.id ||
                edge.to === selectedStation.id
            )
            .map((edge) => {
              const other = stationById.get(
                edge.from === selectedStation.id ? edge.to : edge.from
              )!;
              return (
                <span key={edge.id}>
                  ↔ <LineBadge id={other.line} /> {stationName(other, locale)}
                </span>
              );
            })}
          {showDirectory && selectedStation.boarding !== "unconfirmed" && (
            <div className="mob-inline">
              <Link href={`/${locale}/journey?from=${selectedStation.id}`}>
                {t("pickDeparture")}
              </Link>
              <Link href={`/${locale}/journey?to=${selectedStation.id}`}>
                {t("pickDestination")}
              </Link>
            </div>
          )}
        </div>
      )}
      {showDirectory && (
        <details className="mob-directory" open={filter !== "all" || undefined}>
          <summary>
            {t("stations")} · {directory.length}
          </summary>
          <label>
            {t("search")}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <ul>
            {directory.map((station) => (
              <li key={station.id}>
                <button
                  type="button"
                  aria-pressed={selected === station.id}
                  onClick={() => setSelected(station.id)}
                >
                  <LineBadge id={station.line} /> {stationName(station, locale)}
                  {station.boarding === "unconfirmed" ? (
                    <small>{t("unconfirmed")}</small>
                  ) : station.terminus ? (
                    <small>{t("terminus")}</small>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mob-map-source">
        <a href={network.operatorMap}>{t("official")}</a> ·{" "}
        <bdi>{network.version}</bdi>
      </p>
    </section>
  );
}
