import type { ReactNode } from "react";
import Link from "next/link";

import type { HealthStatus } from "@/lib/health";

export function AdminShell({
  tab,
  onTabChange,
  pendingCount,
  awaitingAgent,
  health,
  onRefresh,
  children,
}: {
  tab: "queue" | "voc" | "success";
  onTabChange: (tab: "queue" | "voc" | "success") => void;
  pendingCount: number;
  awaitingAgent: number;
  health: HealthStatus | null;
  onRefresh: () => void;
  children: ReactNode;
}) {
  return (
    <div className="adm">
      <aside className="adm-rail">
        <div className="adm-rail__mark">CM</div>
        <nav className="adm-rail__nav" aria-label="Navigation console">
          <Link
            className="adm-rail__item"
            href="/admin/mobility"
            title="Mobility Control Tower"
            aria-label="Mobility Control Tower"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path d="M3 12h18M8 5l-5 7 5 7M16 5l5 7-5 7" />
            </svg>
          </Link>
          <button
            type="button"
            className={`adm-rail__item ${tab === "queue" ? "is-active" : ""}`}
            title="File d'attente"
            onClick={() => onTabChange("queue")}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
          </button>
          <button
            type="button"
            className={`adm-rail__item ${tab === "voc" ? "is-active" : ""}`}
            title="Voix du client"
            onClick={() => onTabChange("voc")}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </svg>
          </button>
          <button
            type="button"
            className={`adm-rail__item ${tab === "success" ? "is-active" : ""}`}
            title="Proactivité"
            onClick={() => onTabChange("success")}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
          </button>
          <span className="adm-rail__item" title="Corpus">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 19V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2Z" />
              <path d="M8 7h7M8 11h7" />
            </svg>
          </span>
        </nav>
        <div className="adm-rail__bottom">
          <div className="adm-rail__avatar">SA</div>
          <span>Superviseur</span>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-top">
          <div>
            <h1>Console agents</h1>
            <p>Service client CasaMove · supervision des dossiers</p>
          </div>
          <div className="adm-top__right">
            <div className="adm-health">
              <span
                className={`adm-health__item ${
                  health ? (health.db.ok ? "is-ok" : "is-off") : ""
                }`}
                title={health?.db.error ?? "PostgreSQL"}
              >
                DB {health ? `${health.db.latencyMs} ms` : "…"}
              </span>
              <span
                className={`adm-health__item ${
                  health ? (health.llm.enabled ? "is-ok" : "is-warn") : ""
                }`}
                title={health?.llm.model ?? "NVIDIA NIM"}
              >
                LLM {health ? (health.llm.enabled ? "prêt" : "off") : "…"}
              </span>
              <span
                className={`adm-health__item ${
                  health ? (health.embeddings.loaded ? "is-ok" : "is-warn") : ""
                }`}
                title={health?.embeddings.model ?? "Embeddings"}
              >
                Emb{" "}
                {health
                  ? health.embeddings.loaded
                    ? health.embeddings.vectors
                    : "repli"
                  : "…"}
              </span>
            </div>
            <span className="adm-live">
              <i />
              Actualisation 5 s
            </span>
            <span className="adm-demo">Données de test</span>
            <button
              type="button"
              className="adm-btn adm-btn--ghost"
              onClick={onRefresh}
            >
              Rafraîchir
            </button>
            <a className="adm-btn" href="/fr">
              Voir le site
            </a>
          </div>
        </header>

        <nav className="adm-tabs" aria-label="Sections de la console">
          <button
            type="button"
            className={tab === "queue" ? "is-active" : ""}
            onClick={() => onTabChange("queue")}
          >
            File d&apos;attente
            <span>{pendingCount}</span>
            {awaitingAgent > 0 ? (
              <i
                className="adm-tab-dot"
                title={`${awaitingAgent} nouveau(x) message(s) usager`}
              />
            ) : null}
          </button>
          <button
            type="button"
            className={tab === "voc" ? "is-active" : ""}
            onClick={() => onTabChange("voc")}
          >
            Voix du client
          </button>
          <button
            type="button"
            className={tab === "success" ? "is-active" : ""}
            onClick={() => onTabChange("success")}
          >
            Proactivité
          </button>
        </nav>

        {children}
      </div>
    </div>
  );
}
