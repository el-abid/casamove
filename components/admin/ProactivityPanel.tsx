"use client";

import { useEffect, useState } from "react";

type Signal = {
  id: number;
  kind: string;
  line: string | null;
  userId: number | null;
  userEmail: string | null;
  severity: string;
  createdByEmail: string;
  payload: Record<string, { title: string; body: string }>;
  createdAt: string;
  expiresAt: string;
  deliveredCount: number;
  readCount: number;
  dismissedCount: number;
};

type CustomForm = {
  kind: "disruption" | "info";
  line: string;
  severity: "info" | "warning" | "critical";
  frTitle: string;
  frBody: string;
  arTitle: string;
  arBody: string;
  enTitle: string;
  enBody: string;
};

const LINES = [
  "ligne 1",
  "ligne 2",
  "ligne 3",
  "ligne 4",
  "ligne BW1",
  "ligne BW2",
];

const SEVERITY_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Avertissement",
  critical: "Critique",
};

const KIND_LABELS: Record<string, string> = {
  disruption: "Perturbation",
  renewal: "Renouvellement",
  info: "Information",
};

const EMPTY_FORM: CustomForm = {
  kind: "disruption",
  line: "ligne 1",
  severity: "warning",
  frTitle: "",
  frBody: "",
  arTitle: "",
  arBody: "",
  enTitle: "",
  enBody: "",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Casablanca",
  }).format(new Date(iso));
}

export function ProactivityPanel() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [line, setLine] = useState("ligne 1");
  const [form, setForm] = useState<CustomForm>(EMPTY_FORM);
  const lastRenewal = signals.find((signal) => signal.kind === "renewal");

  async function load() {
    try {
      const response = await fetch("/api/signals?scope=all", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { signals?: Signal[] };
      setSignals(data.signals ?? []);
    } catch {
      // le prochain cycle réessaie
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  async function triggerDisruption() {
    setBusy("disruption");
    setNotice("");

    try {
      const response = await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "disruption",
          line,
          severity: "warning",
        }),
      });

      if (!response.ok) throw new Error("failed");

      setNotice(
        `Perturbation publiée sur ${line}. Le chat ouvert la reçoit sous 12 secondes.`
      );
      await load();
    } catch {
      setNotice("Publication impossible. Vérifiez que Postgres est démarré.");
    } finally {
      setBusy(null);
    }
  }

  async function publishCustom() {
    const payload = {
      fr: { title: form.frTitle.trim(), body: form.frBody.trim() },
      ar: { title: form.arTitle.trim(), body: form.arBody.trim() },
      en: { title: form.enTitle.trim(), body: form.enBody.trim() },
    };

    if (
      Object.values(payload).some(
        (item) => item.title.length < 3 || item.body.length < 5
      )
    ) {
      setNotice("Renseignez un titre et un message dans les trois langues.");
      return;
    }

    setBusy("custom");
    setNotice("");

    try {
      const response = await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: form.kind,
          line: form.line,
          severity: form.severity,
          payload,
        }),
      });

      if (!response.ok) throw new Error("failed");

      setNotice(
        `Message ${form.kind === "info" ? "d'information" : "de perturbation"} publié.`
      );
      setForm(EMPTY_FORM);
      await load();
    } catch {
      setNotice("Publication impossible. Vérifiez les champs et Postgres.");
    } finally {
      setBusy(null);
    }
  }

  function field(
    key: keyof Omit<CustomForm, "kind" | "line" | "severity">,
    value: string
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="pro">
      <div className="pro-grid">
        <section className="adm-panel pro-card">
          <header className="adm-panel__head">
            <b>Perturbation réseau</b>
            <span>agent Succès client</span>
          </header>
          <p>
            Publie une alerte sur la ligne choisie. Le chat l&apos;affiche sans
            que l&apos;usager ait écrit.
          </p>
          <select
            className="adm-filter pro-line-select"
            value={line}
            onChange={(event) => setLine(event.target.value)}
            aria-label="Ligne de la perturbation"
          >
            {LINES.map((item) => (
              <option key={item} value={item}>
                {item.replace("ligne ", "")}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            disabled={busy !== null}
            onClick={triggerDisruption}
          >
            {busy === "disruption" ? "Publication…" : "Publier la perturbation"}
          </button>
        </section>

        <section className="adm-panel pro-card">
          <header className="adm-panel__head">
            <b>Renouvellement d&apos;abonnement</b>
            <span>automatique</span>
          </header>
          <p>
            Relance publiée sans intervention pour chaque abonnement à sept
            jours de l&apos;échéance : au démarrage du serveur, puis toutes les
            24 h. Un usager reçoit au plus une relance par jour.
          </p>
          <p className="pro-auto">
            {lastRenewal
              ? `Dernière relance : ${formatDate(lastRenewal.createdAt)}`
              : "Aucune relance sur les dernières 24 h."}
          </p>
        </section>
      </div>

      <details className="adm-panel pro-compose">
        <summary>Composer un message personnalisé</summary>
        <div className="pro-form">
          <div className="pro-form__row">
            <select
              className="adm-filter"
              value={form.kind}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  kind: event.target.value as CustomForm["kind"],
                }))
              }
              aria-label="Type de message"
            >
              <option value="disruption">Perturbation</option>
              <option value="info">Information</option>
            </select>
            <select
              className="adm-filter"
              value={form.line}
              onChange={(event) =>
                setForm((current) => ({ ...current, line: event.target.value }))
              }
              aria-label="Ligne du message"
            >
              {LINES.map((item) => (
                <option key={item} value={item}>
                  {item.replace("ligne ", "")}
                </option>
              ))}
            </select>
            <select
              className="adm-filter"
              value={form.severity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  severity: event.target.value as CustomForm["severity"],
                }))
              }
              aria-label="Sévérité"
            >
              <option value="info">Info</option>
              <option value="warning">Avertissement</option>
              <option value="critical">Critique</option>
            </select>
          </div>

          {[
            { key: "fr", label: "Français" },
            { key: "ar", label: "العربية" },
            { key: "en", label: "English" },
          ].map((locale) => (
            <div className="pro-form__locale" key={locale.key}>
              <b>{locale.label}</b>
              <input
                className="adm-filter"
                placeholder="Titre"
                value={form[`${locale.key}Title` as keyof CustomForm] as string}
                onChange={(event) =>
                  field(
                    `${locale.key}Title` as keyof Omit<
                      CustomForm,
                      "kind" | "line" | "severity"
                    >,
                    event.target.value
                  )
                }
              />
              <textarea
                className="adm-comment pro-form__body"
                placeholder="Message"
                rows={3}
                value={form[`${locale.key}Body` as keyof CustomForm] as string}
                onChange={(event) =>
                  field(
                    `${locale.key}Body` as keyof Omit<
                      CustomForm,
                      "kind" | "line" | "severity"
                    >,
                    event.target.value
                  )
                }
              />
            </div>
          ))}

          <button
            type="button"
            className="adm-btn adm-btn--primary"
            disabled={busy !== null}
            onClick={publishCustom}
          >
            {busy === "custom" ? "Publication…" : "Publier le message"}
          </button>
        </div>
      </details>

      {notice ? (
        <p className="adm-notice" role="status">
          {notice}
        </p>
      ) : null}

      <section className="adm-panel pro-recent">
        <header className="adm-panel__head">
          <b>Alertes récentes</b>
          <span>ciblées et globales</span>
        </header>

        {signals.length === 0 ? (
          <p className="adm-empty">
            Aucune alerte active. Publiez-en une pour la voir apparaître dans le
            chat.
          </p>
        ) : (
          <div className="pro-list">
            {signals.map((signal) => (
              <div className="pro-row" key={signal.id}>
                <div className="pro-kind-cell">
                  <span className={`pro-kind pro-kind--${signal.kind}`}>
                    {KIND_LABELS[signal.kind] ?? signal.kind}
                  </span>
                  <span className={`pro-sev pro-sev--${signal.severity}`}>
                    {SEVERITY_LABELS[signal.severity] ?? signal.severity}
                  </span>
                </div>
                <div>
                  <span className="pro-title">
                    {signal.payload.fr?.title ?? "Alerte"}
                  </span>
                  {signal.createdByEmail ? (
                    <small className="pro-author">
                      par {signal.createdByEmail}
                    </small>
                  ) : null}
                </div>
                <span className="pro-line">
                  {signal.kind === "renewal"
                    ? (signal.userEmail ??
                      (signal.userId
                        ? `usager #${signal.userId}`
                        : "tous usagers"))
                    : (signal.line ?? "tous usagers")}
                </span>
                <span className="pro-metrics">
                  <b>
                    {signal.deliveredCount
                      ? Math.round(
                          (signal.readCount / signal.deliveredCount) * 100
                        )
                      : 0}
                    % lus
                  </b>
                  <small>
                    {signal.deliveredCount} livrés · {signal.readCount} lus ·{" "}
                    {signal.dismissedCount} masqués
                  </small>
                </span>
                <span className="pro-date">
                  expire {formatDate(signal.expiresAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="pro-note">
        La relance de renouvellement est automatique et cible les abonnements
        qui expirent sous sept jours. La perturbation est limitée à la ligne
        choisie. Une alerte est livrée une fois par usager ou session et par
        jour.
      </p>
    </div>
  );
}
