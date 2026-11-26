"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { mobilityValue } from "@/content/mobility";
import {
  incidentCategories,
  reportStatuses,
  severities,
} from "@/lib/mobility/categories";
import { lineById, lines, stations, stationById } from "@/lib/mobility/network";
import { effects, type Effect } from "@/lib/mobility/routing";
import type { Incident, Report, TowerOverview } from "@/lib/mobility/store";
import { formatTime, MobilityRequestError, mobilityRequest } from "./client";
import { LineBadge, NetworkMap, stationName } from "./NetworkMap";
import "./tower.css";

const categoryName: Record<string, string> = {
  operations: "Exploitation",
  infrastructure: "Infrastructure",
  vehicle: "Véhicule",
  weather: "Météo",
  event: "Événement",
  other: "Autre",
};
const actionName: Record<string, string> = {
  created: "Créé",
  updated: "Mis à jour",
  resolved: "Résolu",
};

function IncidentForm({
  incident,
  write,
  cancel,
  busy,
}: {
  incident?: Incident;
  write: (path: string, method: string, data: unknown) => Promise<boolean>;
  cancel: () => void;
  busy: boolean;
}) {
  const [line, setLine] = useState<Incident["line"]>(incident?.line ?? "T3");
  const [effect, setEffect] = useState<Effect>(
    incident?.effect ?? "segment-closure"
  );
  const stationOptions = lineById.get(line)!.stations;
  const hasStation = effect !== "line-suspension";
  const hasEnd =
    effect === "segment-closure" ||
    effect === "delay" ||
    effect === "information";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const expiry = data.get("expiresAt");
    const ok = await write(
      incident ? `disruptions/${incident.id}` : "disruptions",
      incident ? "PATCH" : "POST",
      {
        line,
        effect,
        station: data.get("station") || null,
        endStation: data.get("endStation") || null,
        title: data.get("title"),
        description: data.get("description"),
        category: data.get("category"),
        severity: data.get("severity"),
        published: data.has("published"),
        expiresAt:
          typeof expiry === "string" && expiry
            ? new Date(expiry).toISOString()
            : null,
        revision: incident?.revision,
      }
    );
    if (ok) {
      form.reset();
      cancel();
    }
  }
  const localExpiry = incident?.expiresAt
    ? new Date(
        new Date(incident.expiresAt).getTime() -
          new Date(incident.expiresAt).getTimezoneOffset() * 60000
      )
        .toISOString()
        .slice(0, 16)
    : "";

  return (
    <section className="mob-card">
      <h2>{incident ? "Modifier la simulation" : "Créer une simulation"}</h2>
      <form className="mob-form" onSubmit={submit}>
        <div className="mob-form-grid">
          <label>
            Ligne
            <select
              value={line}
              onChange={(event) => {
                const item = lineById.get(event.target.value);
                if (item) setLine(item.id);
              }}
            >
              {lines.map((item) => (
                <option key={item.id}>{item.id}</option>
              ))}
            </select>
          </label>
          <label>
            Effet opérationnel
            <select
              value={effect}
              onChange={(event) => {
                const value = effects.find(
                  (item) => item === event.target.value
                );
                if (value) setEffect(value);
              }}
            >
              {effects.map((item) => (
                <option key={item} value={item}>
                  {mobilityValue("fr", item)}
                </option>
              ))}
            </select>
          </label>
          {hasStation && (
            <label>
              Station de début
              <select
                key={`start-${line}-${effect}`}
                name="station"
                required={
                  effect === "segment-closure" || effect === "station-closure"
                }
                defaultValue={
                  incident?.line === line ? (incident.station ?? "") : ""
                }
              >
                <option value="">Toute la ligne</option>
                {stationOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fr}
                  </option>
                ))}
              </select>
            </label>
          )}
          {hasEnd && (
            <label>
              Station de fin
              <select
                key={`end-${line}-${effect}`}
                name="endStation"
                required={effect === "segment-closure"}
                defaultValue={
                  incident?.line === line ? (incident.endStation ?? "") : ""
                }
              >
                <option value="">Sélectionner</option>
                {stationOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fr}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Catégorie
            <select
              name="category"
              defaultValue={incident?.category ?? "operations"}
            >
              {incidentCategories.map((item) => (
                <option key={item} value={item}>
                  {categoryName[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Gravité
            <select
              name="severity"
              defaultValue={incident?.severity ?? "major"}
            >
              {severities.map((item) => (
                <option key={item} value={item}>
                  {mobilityValue("fr", item)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Titre
          <input
            name="title"
            required
            maxLength={100}
            defaultValue={incident?.title}
          />
        </label>
        <label>
          Explication
          <textarea
            name="description"
            maxLength={800}
            rows={3}
            defaultValue={incident?.description}
          />
        </label>
        <label>
          Fin de simulation prévue (facultative)
          <input
            name="expiresAt"
            type="datetime-local"
            defaultValue={localExpiry}
          />
        </label>
        <label className="mob-check">
          <input
            name="published"
            type="checkbox"
            defaultChecked={incident?.published ?? true}
          />
          Publier le message voyageur
        </label>
        <div className="mob-inline">
          <button className="mob-button mob-primary" disabled={busy}>
            {incident ? "Enregistrer" : "Créer l’incident simulé"}
          </button>
          {incident && (
            <button type="button" className="mob-button" onClick={cancel}>
              Annuler
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function ModForm({
  report,
  incidents,
  write,
  busy,
}: {
  report: Report;
  incidents: Incident[];
  write: (path: string, method: string, data: unknown) => Promise<boolean>;
  busy: boolean;
}) {
  const station = stationById.get(report.station)!;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void write(`reports/${report.id}`, "PATCH", {
      status: data.get("status"),
      revision: report.revision,
      incidentId: Number(data.get("incident")) || null,
    });
  }
  return (
    <form className="mob-form" onSubmit={submit}>
      <div className="mob-form-grid">
        <label>
          Modération
          <select name="status" defaultValue={report.status}>
            {reportStatuses.map((status) => (
              <option key={status} value={status}>
                {mobilityValue("fr", status)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Associer à un incident
          <select name="incident" defaultValue={report.incidentId ?? ""}>
            <option value="">Aucun</option>
            {incidents
              .filter((incident) => incident.line === station.line)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  #{item.id} · {item.title}
                </option>
              ))}
          </select>
        </label>
      </div>
      <button className="mob-button" disabled={busy}>
        Enregistrer la modération
      </button>
    </form>
  );
}

export function ControlTower() {
  const [overview, setOverview] = useState<TowerOverview>();
  const [editing, setEditing] = useState<Incident>();
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setOverview(
      await mobilityRequest<TowerOverview>("tower", "GET", undefined, signal)
    );
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const check = () => {
      void refresh(controller.signal).catch(() => {
        if (!controller.signal.aborted)
          setFeedback({
            error: true,
            text: "La supervision est momentanément indisponible.",
          });
      });
    };
    check();
    const timer = setInterval(check, 6000);
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
      setFeedback({ error: false, text: "Modifications enregistrées." });
      return true;
    } catch (error) {
      const status = error instanceof MobilityRequestError ? error.status : 0;
      setFeedback({
        error: true,
        text:
          status === 409
            ? "Le dossier a changé ou l’association est invalide. Vérifiez les données à jour."
            : status === 400
              ? "Vérifiez la ligne, les stations et la date de fin."
              : "Impossible d’enregistrer les modifications.",
      });
      if (status === 409) void refresh().catch(() => {});
      return false;
    } finally {
      setBusy(false);
    }
  }
  const active = overview?.incidents.filter((item) => item.active) ?? [];
  return (
    <main className="mob-site mob-tower">
      <header className="mob-tower-header">
        <div>
          <Link href="/admin">← Console agents</Link>
          <h1>Mobility Control Tower</h1>
        </div>
        <div>
          <span className="mob-tag">Simulation CasaMove</span>
          <p>
            Les incidents simulés modifient les trajets dans cette instance.
          </p>
        </div>
      </header>
      {feedback && (
        <p
          role={feedback.error ? "alert" : "status"}
          className={feedback.error ? "mob-error" : "mob-tower-success"}
        >
          {feedback.text}
        </p>
      )}
      {!overview && !feedback && (
        <p role="status">Chargement des données opérationnelles…</p>
      )}
      {overview && (
        <>
          <div className="mob-tower-kpis">
            {[
              ["Lignes", lines.length],
              ["Stations", stations.length],
              ["Incidents actifs", overview.counts.active],
              ["Incidents résolus", overview.counts.resolved],
              ["Signalements", overview.counts.reports],
              ["À modérer", overview.counts.pending],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <section className="mob-tower-network">
            <h2>Supervision du réseau</h2>
            <div className="mob-tower-line-status">
              {lines.map((line) => {
                const affected = active.filter((item) => item.line === line.id);
                return (
                  <div key={line.id}>
                    <LineBadge id={line.id} />{" "}
                    {affected.length
                      ? `${affected.length} incident(s)`
                      : "Aucun incident simulé"}
                  </div>
                );
              })}
            </div>
            <NetworkMap locale="fr" impacts={active} />
          </section>
          <div className="mob-tower-grid">
            <IncidentForm
              key={editing ? `${editing.id}-${editing.revision}` : "new"}
              incident={editing}
              write={write}
              cancel={() => setEditing(undefined)}
              busy={busy}
            />
            <section className="mob-card">
              <h2>Incidents</h2>
              {!overview.incidents.length && <p>Aucun incident enregistré.</p>}
              <ul className="mob-tower-list">
                {overview.incidents.map((item) => (
                  <li key={item.id}>
                    <div className="mob-inline">
                      <LineBadge id={item.line} />
                      <strong>
                        #{item.id} · {item.title}
                      </strong>
                    </div>
                    <p>
                      {mobilityValue("fr", item.effect)} ·{" "}
                      {mobilityValue("fr", item.severity)}
                      {item.station && ` · ${stationName(item.station, "fr")}`}
                      {item.endStation &&
                        ` ↔ ${stationName(item.endStation, "fr")}`}
                    </p>
                    {item.description && <p>{item.description}</p>}
                    <small>
                      {item.active
                        ? "Actif"
                        : item.resolvedAt
                          ? "Résolu"
                          : "Expiré"}{" "}
                      · {formatTime(item.updatedAt, "fr")}
                      {item.expiresAt &&
                        ` · Fin prévue ${formatTime(item.expiresAt, "fr")}`}
                    </small>
                    {!item.resolvedAt && (
                      <div className="mob-inline">
                        <button
                          className="mob-button"
                          onClick={() => setEditing(item)}
                        >
                          Modifier
                        </button>
                        <button
                          className="mob-button"
                          disabled={busy}
                          onClick={async () => {
                            const ok = await write(
                              `disruptions/${item.id}`,
                              "PATCH",
                              { action: "resolve", revision: item.revision }
                            );
                            if (ok && editing?.id === item.id)
                              setEditing(undefined);
                          }}
                        >
                          Résoudre
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            <section className="mob-card">
              <h2>Signalements voyageurs</h2>
              {!overview.reports.length && <p>Aucun signalement reçu.</p>}
              <ul className="mob-tower-list">
                {overview.reports.map((report) => (
                  <li key={report.id}>
                    <div className="mob-inline">
                      <LineBadge id={stationById.get(report.station)!.line} />
                      <strong>
                        #{report.id} · {stationName(report.station, "fr")}
                        {report.endStation &&
                          ` ↔ ${stationName(report.endStation, "fr")}`}
                      </strong>
                    </div>
                    <p>
                      {mobilityValue("fr", report.category)} ·{" "}
                      {mobilityValue("fr", report.status)} ·{" "}
                      {formatTime(report.createdAt, "fr")}
                    </p>
                    {report.description && <p>{report.description}</p>}
                    {!!report.grouped && report.grouped > 1 && (
                      <small>
                        {report.grouped} observations liées dans la même fenêtre
                        de 4 heures
                      </small>
                    )}
                    <ModForm
                      key={report.revision}
                      report={report}
                      incidents={overview.incidents}
                      write={write}
                      busy={busy}
                    />
                  </li>
                ))}
              </ul>
            </section>
            <div className="mob-tower-subgrid">
              <section className="mob-card">
                <h2>Activité opérationnelle</h2>
                {!overview.history.length && (
                  <p>Aucune opération enregistrée.</p>
                )}
                <ul className="mob-tower-list">
                  {overview.history.map((item, index) => (
                    <li key={index}>
                      <strong>
                        {actionName[item.action]} · #{item.incidentId} ·{" "}
                        {item.title}
                      </strong>
                      <time>{formatTime(item.createdAt, "fr")}</time>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="mob-card">
                <h2>Réclamations par ligne</h2>
                {!overview.complaints.length && (
                  <p>Aucune réclamation enregistrée.</p>
                )}
                <ul className="mob-tower-list">
                  {overview.complaints.map((item) => (
                    <li key={item.line ?? "unknown"}>
                      <div className="mob-inline">
                        {item.line ?? "Sans ligne"}{" "}
                        <strong>{item.count}</strong>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
