"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Locale } from "@/content/dictionary";
import { mobilityText } from "@/content/mobility";
import {
  lineById,
  lines,
  stations,
  type LineId,
  type Station,
} from "@/lib/mobility/network";
import { LineBadge, stationName } from "./NetworkMap";

const positions = stations.filter(
  (
    station
  ): station is Station & { geographic: NonNullable<Station["geographic"]> } =>
    !!station.geographic
);

export function GeographicMap({ locale }: { locale: Locale }) {
  const [line, setLine] = useState<LineId | "all">("all");
  const [tileError, setTileError] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [selected, setSelected] = useState<string>();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap>(null);
  const markers = useRef(new Map<string, CircleMarker>());
  const visible = positions.filter(
    (station) => line === "all" || station.line === line
  );
  const title = mobilityText(locale, "geographic");
  const tileText = {
    fr: "Le fond de carte est indisponible. Les positions et le répertoire restent consultables.",
    ar: "خريطة الخلفية غير متاحة. تظل مواقع المحطات والدليل متاحة.",
    en: "The basemap is unavailable. Station positions and the directory are still accessible.",
  }[locale];

  useEffect(() => {
    let cancelled = false;
    void import("leaflet")
      .then((L) => {
        if (!container.current || cancelled || !positions.length) return;
        const instance = L.map(container.current, {
          scrollWheelZoom: false,
          maxZoom: 19,
          zoomControl: false,
        });
        L.control
          .zoom({
            zoomInTitle: mobilityText(locale, "zoomIn"),
            zoomOutTitle: mobilityText(locale, "zoomOut"),
          })
          .addTo(instance);
        map.current = instance;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
          maxZoom: 19,
          keepBuffer: 1,
        })
          .on("tileerror", () => setTileError(true))
          .on("load", () => setTileError(false))
          .addTo(instance);
        const current = positions.filter(
          (station) => line === "all" || station.line === line
        );
        for (const station of current) {
          const name = document.createElement("span");
          name.textContent = `${station.line} · ${stationName(station, locale)}`;
          const marker = L.circleMarker(
            [station.geographic.latitude, station.geographic.longitude],
            {
              radius: 6,
              color: "#142a42",
              fillColor: lineById.get(station.line)!.color,
              fillOpacity: 0.95,
              weight: 2,
            }
          )
            .bindTooltip(name)
            .on("click", () => setSelected(station.id))
            .addTo(instance);
          markers.current.set(station.id, marker);
        }
        instance.fitBounds(
          current.map(
            ({ geographic }) =>
              [geographic.latitude, geographic.longitude] as [number, number]
          ),
          { padding: [24, 24], maxZoom: 15 }
        );
      })
      .catch(() => setTileError(true));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
    };
  }, [locale, line]);

  function locate() {
    if (!navigator.geolocation) return setGeoError(true);
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        map.current?.setView([coords.latitude, coords.longitude], 15);
      },
      () => setGeoError(true),
      { timeout: 6000, maximumAge: 30000 }
    );
  }

  return (
    <section className="mob-map" aria-label={title}>
      <div className="mob-map-toolbar">
        <div className="mob-filters">
          <button
            type="button"
            aria-pressed={line === "all"}
            onClick={() => {
              setSelected(undefined);
              setLine("all");
            }}
          >
            {mobilityText(locale, "allLines")}
          </button>
          {lines.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={line === item.id}
              onClick={() => {
                setSelected(undefined);
                setLine(item.id);
              }}
            >
              <LineBadge id={item.id} />
            </button>
          ))}
        </div>
        <button type="button" className="mob-button" onClick={locate}>
          {
            {
              fr: "Centrer sur ma position",
              ar: "اعرض موقعي",
              en: "Centre on my location",
            }[locale]
          }
        </button>
      </div>
      <p className="mob-map-hint">
        {positions.length}/{stations.length}{" "}
        {
          {
            fr: "stations cartographiées · points issus d’OpenStreetMap",
            ar: "محطة محددة على الخريطة · المصدر OpenStreetMap",
            en: "stations mapped · positions from OpenStreetMap",
          }[locale]
        }
      </p>
      {geoError && (
        <p role="status" className="mob-map-hint">
          {
            {
              fr: "Votre position n’est pas disponible.",
              ar: "موقعك غير متاح.",
              en: "Your location is unavailable.",
            }[locale]
          }
        </p>
      )}
      {tileError && (
        <p role="status" className="mob-map-hint">
          {tileText}
        </p>
      )}
      <div
        ref={container}
        className="mob-geo"
        dir="ltr"
        role="region"
        aria-label={title}
      />
      {selected && (
        <p className="mob-map-detail" role="status">
          {stationName(selected, locale)}
        </p>
      )}
      <details className="mob-directory">
        <summary>
          {mobilityText(locale, "stations")} · {visible.length}
        </summary>
        <ul>
          {visible.map((station) => (
            <li key={station.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(station.id);
                  map.current?.setView(
                    [station.geographic.latitude, station.geographic.longitude],
                    16
                  );
                  markers.current.get(station.id)?.openTooltip();
                }}
              >
                <LineBadge id={station.line} /> {stationName(station, locale)}
              </button>
            </li>
          ))}
        </ul>
      </details>
      <p className="mob-map-source">
        <a href="https://www.openstreetmap.org/copyright">
          © OpenStreetMap contributors
        </a>{" "}
        · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>
      </p>
    </section>
  );
}
