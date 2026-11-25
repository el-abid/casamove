"use client";

import { useEffect, useState } from "react";
import type { VocAggregate, VocPeriod } from "@/lib/agent/voc";

const themeColors = ["#1B2A4A", "#F5A524", "#2FA37C", "#C8452B", "#7A8AA8"];

const PERIOD_LABELS: Record<VocPeriod, string> = {
  "7": "7 jours",
  "30": "30 jours",
  all: "Tout",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  resolved: "Clôturés",
  rejected: "Rejetés",
};

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Africa/Casablanca",
  }).format(new Date(iso));
}

function delta(value: number | null, suffix = "") {
  if (value === null) return null;
  if (value === 0) return "stable";
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

export function VocPanel({
  onThemeClick,
  onLineClick,
}: {
  onThemeClick?: (theme: string, period: VocPeriod) => void;
  onLineClick?: (line: string, period: VocPeriod) => void;
}) {
  const [data, setData] = useState<VocAggregate | null>(null);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState<VocPeriod>("all");
  const [verbatimTheme, setVerbatimTheme] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(`/api/voc?period=${period}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as VocAggregate;
        if (active) {
          setData(payload);
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
      }
    }

    load();
    const timer = window.setInterval(load, 10_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [period]);

  if (failed) {
    return (
      <div className="adm-empty adm-empty--detail">
        <b>VoC indisponible.</b>
        <p>La base ne répond pas. Vérifiez Postgres puis rafraîchissez.</p>
      </div>
    );
  }

  if (!data) {
    return <div className="adm-empty">Chargement des indicateurs…</div>;
  }

  const maxTheme = Math.max(1, ...data.byTheme.map((item) => item.count));
  const maxLine = Math.max(1, ...data.byLine.map((item) => item.count));
  const maxDay = Math.max(1, ...data.byDay.map((item) => item.count));
  const negativeShare = data.total
    ? Math.round((data.negative / data.total) * 100)
    : 0;
  const positiveShare = data.total
    ? Math.round((data.positive / data.total) * 100)
    : 0;
  const positiveEnd = negativeShare + positiveShare;
  const maxCsat = Math.max(
    1,
    ...data.csatDistribution.map((item) => item.count)
  );
  const selectedVerbatimTheme = verbatimTheme || data.topTheme;
  const verbatims = data.verbatims.filter(
    (item) => item.theme === selectedVerbatimTheme
  );
  const totalDelta = data.previous ? data.total - data.previous.total : null;
  const negativeDelta = data.previous
    ? negativeShare - data.previous.negativeShare
    : null;
  const pendingDelta = data.previous
    ? data.pending - data.previous.pending
    : null;

  return (
    <div className="voc">
      <div className="voc-toolbar">
        <div className="voc-periods" role="group" aria-label="Période VoC">
          {(["7", "30", "all"] as VocPeriod[]).map((item) => (
            <button
              key={item}
              type="button"
              className={period === item ? "is-active" : ""}
              onClick={() => setPeriod(item)}
            >
              {PERIOD_LABELS[item]}
            </button>
          ))}
        </div>
        <a
          className="adm-btn adm-btn--ghost"
          href={`/api/voc/export?period=${period}`}
        >
          Exporter CSV
        </a>
      </div>

      <section className="adm-kpis voc-kpis">
        <div className="adm-kpi">
          <span>Dossiers analysés</span>
          <b>{data.total}</b>
          <small>
            {PERIOD_LABELS[data.period]}
            {totalDelta !== null ? ` · ${delta(totalDelta, " dossiers")}` : ""}
          </small>
        </div>
        <div className="adm-kpi">
          <span>Connotation négative</span>
          <b className="is-risk">{negativeShare} %</b>
          <small>
            {data.negative} dossiers
            {negativeDelta !== null ? ` · ${delta(negativeDelta, " pts")}` : ""}
          </small>
        </div>
        <div className="adm-kpi">
          <span>Thème dominant</span>
          <b className="voc-theme">{data.topTheme}</b>
          <small>
            {data.byTheme[0]?.count ?? 0} dossiers
            {data.previous ? ` · avant : ${data.previous.topTheme}` : ""}
          </small>
        </div>
        <div className="adm-kpi">
          <span>En attente</span>
          <b>{data.pending}</b>
          <small>
            à valider
            {pendingDelta !== null ? ` · ${delta(pendingDelta)}` : ""}
          </small>
        </div>
        <div className="adm-kpi">
          <span>Satisfaction</span>
          <b className="voc-theme">
            {data.csatCount ? `${data.csatAverage}/5` : "—"}
          </b>
          <small>{data.csatCount} avis</small>
        </div>
      </section>

      <div className="voc-grid">
        <section className="adm-panel voc-card">
          <header className="adm-panel__head">
            <b>Répartition par thème</b>
            <span>cliquer pour filtrer la file</span>
          </header>
          <div className="voc-bars">
            {data.byTheme.length === 0 ? (
              <p className="adm-empty">Aucun dossier.</p>
            ) : (
              data.byTheme.map((item, index) => (
                <button
                  type="button"
                  className="voc-bar voc-bar--link"
                  key={item.key}
                  onClick={() => onThemeClick?.(item.key, data.period)}
                  title={`Voir les dossiers ${item.key}`}
                >
                  <span className="voc-bar__label">{item.key}</span>
                  <div className="voc-bar__track">
                    <i
                      style={{
                        width: `${Math.round((item.count / maxTheme) * 100)}%`,
                        background: themeColors[index % themeColors.length],
                      }}
                    />
                  </div>
                  <b>{item.count}</b>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="adm-panel voc-card">
          <header className="adm-panel__head">
            <b>Répartition par ligne</b>
            <span>cliquer pour filtrer la file</span>
          </header>
          <div className="voc-bars">
            {data.byLine.length === 0 ? (
              <p className="adm-empty">Aucun dossier.</p>
            ) : (
              data.byLine.map((item, index) => (
                <button
                  type="button"
                  className="voc-bar voc-bar--link"
                  key={item.key}
                  onClick={() => onLineClick?.(item.key, data.period)}
                  title={`Voir les dossiers ${item.key}`}
                >
                  <span className="voc-bar__label">{item.key}</span>
                  <div className="voc-bar__track">
                    <i
                      style={{
                        width: `${Math.round((item.count / maxLine) * 100)}%`,
                        background: themeColors[index % themeColors.length],
                      }}
                    />
                  </div>
                  <b>{item.count}</b>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="adm-panel voc-card">
          <header className="adm-panel__head">
            <b>Priorités</b>
            <span>charge et criticité</span>
          </header>
          <div className="voc-prios">
            {(["P1", "P2", "P3"] as const).map((priority) => {
              const count =
                data.byPriority.find((item) => item.key === priority)?.count ??
                0;
              const share = data.total
                ? Math.round((count / data.total) * 100)
                : 0;
              return (
                <div className="voc-prio" key={priority}>
                  <span
                    className={`adm-badge adm-badge--${priority.toLowerCase()}`}
                  >
                    {priority}
                  </span>
                  <div className="voc-bar__track">
                    <i
                      style={{
                        width: `${share}%`,
                        background:
                          priority === "P1"
                            ? "#C8452B"
                            : priority === "P2"
                              ? "#F5A524"
                              : "#7A8AA8",
                      }}
                    />
                  </div>
                  <b>{count}</b>
                  <small>{share} %</small>
                </div>
              );
            })}
          </div>

          <div className="voc-status">
            {data.byStatus.map((item) => (
              <div key={item.key}>
                <span className={`adm-status adm-status--${item.key}`}>
                  {STATUS_LABELS[item.key] ?? item.key}
                </span>
                <b>{item.count}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="adm-panel voc-card">
          <header className="adm-panel__head">
            <b>Volume, 7 derniers jours</b>
            <span>dossiers créés</span>
          </header>
          <div className="voc-days">
            {data.byDay.map((day) => (
              <div className="voc-day" key={day.date}>
                <span className="voc-day__value">{day.count}</span>
                <i
                  style={{
                    height: `${Math.max(6, Math.round((day.count / maxDay) * 100))}%`,
                  }}
                />
                <span className="voc-day__label">{day.date.slice(8, 10)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="adm-panel voc-card">
          <header className="adm-panel__head">
            <b>Sentiment</b>
            <span>stocké à la création</span>
          </header>
          <div className="voc-sent">
            <div
              className="voc-donut"
              style={{
                background: `conic-gradient(#C8452B 0 ${negativeShare}%, #2FA37C ${negativeShare}% ${positiveEnd}%, #DCE3EE ${positiveEnd}% 100%)`,
              }}
            >
              <span>{negativeShare}%</span>
            </div>
            <ul>
              <li>
                <i style={{ background: "#C8452B" }} />
                Négatif <b>{data.negative}</b>
              </li>
              <li>
                <i style={{ background: "#DCE3EE" }} />
                Neutre <b>{data.neutral}</b>
              </li>
              <li>
                <i style={{ background: "#2FA37C" }} />
                Positif <b>{data.positive}</b>
              </li>
            </ul>
          </div>
          <p className="voc-note">
            Sentiment classé à la création par le modèle, avec repli lexical.
            Les dossiers existants sont reclassés par script.
          </p>
          <div className="voc-csat">
            <span className="adm-label">Satisfaction 1 à 5</span>
            {data.csatDistribution.map((item) => (
              <div className="voc-csat__row" key={item.key}>
                <span>{item.key} ★</span>
                <div className="voc-bar__track">
                  <i
                    style={{
                      width: `${Math.round((item.count / maxCsat) * 100)}%`,
                    }}
                  />
                </div>
                <b>{item.count}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="adm-panel voc-card voc-verbatims">
          <header className="adm-panel__head">
            <b>Verbatims par thème</b>
            <span>3 citations négatives</span>
          </header>
          <div className="voc-verbatim__head">
            <select
              className="adm-filter"
              value={selectedVerbatimTheme}
              onChange={(event) => setVerbatimTheme(event.target.value)}
              aria-label="Choisir le thème des verbatims"
            >
              {data.byTheme.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.key}
                </option>
              ))}
            </select>
          </div>
          <div className="voc-verbatim__list">
            {verbatims.length === 0 ? (
              <p className="adm-empty">
                Aucun verbatim négatif pour ce thème sur la période.
              </p>
            ) : (
              verbatims.map((item) => (
                <blockquote className="voc-verbatim" key={item.number}>
                  <p>“{item.query}”</p>
                  <footer>
                    {item.number} · {formatDay(item.createdAt)}
                  </footer>
                </blockquote>
              ))
            )}
          </div>
        </section>

        <section className="adm-panel voc-card voc-recent">
          <header className="adm-panel__head">
            <b>Derniers dossiers</b>
            <span>8 plus récents</span>
          </header>
          <div className="voc-table">
            {data.recent.length === 0 ? (
              <p className="adm-empty">Aucun dossier.</p>
            ) : (
              data.recent.map((ticket) => (
                <div className="voc-row" key={ticket.number}>
                  <span className="adm-id">{ticket.number}</span>
                  <span className="voc-row__theme">{ticket.theme}</span>
                  <span
                    className={`adm-badge adm-badge--${ticket.priority.toLowerCase()}`}
                  >
                    {ticket.priority}
                  </span>
                  <span className={`adm-status adm-status--${ticket.status}`}>
                    {STATUS_LABELS[ticket.status] ?? ticket.status}
                  </span>
                  <span className="voc-row__date">
                    {formatDay(ticket.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
