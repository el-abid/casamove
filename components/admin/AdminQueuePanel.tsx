import type { Ticket } from "@/lib/agent/types";
import { STATUS_LABELS, remaining } from "./admin-format";
import type { Agent, QueueFilters } from "./admin-types";

export function AdminQueuePanel({
  tickets,
  sorted,
  pageTickets,
  selectedNumber,
  onSelect,
  filters,
  onFilterChange,
  onClearScope,
  awaitingAgent,
  agents,
  mounted,
  now,
  page,
  pageCount,
  onPageChange,
}: {
  tickets: Ticket[];
  sorted: Ticket[];
  pageTickets: Ticket[];
  selectedNumber: string | null;
  onSelect: (number: string) => void;
  filters: QueueFilters;
  onFilterChange: (patch: Partial<QueueFilters>) => void;
  onClearScope: () => void;
  awaitingAgent: number;
  agents: Agent[];
  mounted: boolean;
  now: number;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const currentPage = Math.min(page, pageCount);

  return (
    <section className="adm-panel adm-queue">
      <header className="adm-panel__head">
        <b>File d&apos;attente</b>
        <span>
          {sorted.length} / {tickets.length} dossier(s)
        </span>
      </header>

      {awaitingAgent > 0 ? (
        <div className="adm-unread-banner">
          {awaitingAgent} dossier(s) avec un nouveau message usager.
        </div>
      ) : null}

      <div className="adm-filters">
        <input
          className="adm-filter-search"
          type="search"
          placeholder="Numéro, thème, demande…"
          value={filters.search}
          onChange={(event) => onFilterChange({ search: event.target.value })}
        />
        <select
          className="adm-filter"
          value={filters.status}
          onChange={(event) => onFilterChange({ status: event.target.value })}
          aria-label="Filtrer par statut"
        >
          <option value="all">Tous statuts</option>
          <option value="pending">En attente</option>
          <option value="in_progress">En cours</option>
          <option value="resolved">Clôturé</option>
          <option value="rejected">Rejeté</option>
        </select>
        <select
          className="adm-filter"
          value={filters.priority}
          onChange={(event) => onFilterChange({ priority: event.target.value })}
          aria-label="Filtrer par priorité"
        >
          <option value="all">Toutes priorités</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
        </select>
        <select
          className="adm-filter"
          value={filters.locale}
          onChange={(event) => onFilterChange({ locale: event.target.value })}
          aria-label="Filtrer par langue"
        >
          <option value="all">Toutes langues</option>
          <option value="fr">FR</option>
          <option value="ar">AR</option>
          <option value="en">EN</option>
        </select>
      </div>

      {filters.theme !== "all" || filters.line !== "all" ? (
        <div className="adm-theme-chip">
          <span>
            {filters.theme !== "all" ? `Thème : ${filters.theme}` : ""}
            {filters.theme !== "all" && filters.line !== "all" ? " · " : ""}
            {filters.line !== "all" ? `Ligne : ${filters.line}` : ""}
            {filters.period !== "all"
              ? ` · ${filters.period === "7" ? "7 jours" : "30 jours"}`
              : ""}
          </span>
          <button type="button" onClick={onClearScope}>
            Effacer
          </button>
        </div>
      ) : null}

      <div className="adm-queue__list">
        {pageTickets.length === 0 ? (
          <p className="adm-empty">
            {tickets.length === 0
              ? "Aucun dossier. Ouvrez le chat du site et déposez une réclamation pour alimenter la file."
              : "Aucun dossier ne correspond à ces filtres."}
          </p>
        ) : (
          pageTickets.map((ticket) => (
            <button
              key={ticket.number}
              type="button"
              className={`adm-qitem ${
                selectedNumber === ticket.number ? "is-active" : ""
              }`}
              onClick={() => onSelect(ticket.number)}
            >
              <div className="adm-qitem__top">
                <span className="adm-id">{ticket.number}</span>
                <span
                  className={`adm-badge adm-badge--${ticket.priority.toLowerCase()}`}
                >
                  {ticket.priority}
                </span>
                <span className={`adm-status adm-status--${ticket.status}`}>
                  {STATUS_LABELS[ticket.status]}
                </span>
                {ticket.lastMessageRole === "user" ? (
                  <i
                    className="adm-unread-dot"
                    title="Nouveau message usager"
                  />
                ) : null}
              </div>
              <b>{ticket.theme}</b>
              <div className="adm-qitem__meta">
                <span>{ticket.locale.toUpperCase()}</span>
                <span>·</span>
                <span>
                  {mounted ? remaining(ticket.slaDeadline, now) : "—"}
                </span>
                {ticket.assignedTo ? (
                  <>
                    <span>·</span>
                    <span>
                      {agents.find((agent) => agent.id === ticket.assignedTo)
                        ?.fullName ?? `Agent #${ticket.assignedTo}`}
                    </span>
                  </>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>

      <div className="adm-pagination">
        <button
          type="button"
          className="adm-btn adm-btn--ghost"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Précédent
        </button>
        <span>
          Page {currentPage} / {pageCount}
        </span>
        <button
          type="button"
          className="adm-btn adm-btn--ghost"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Suivant
        </button>
      </div>
    </section>
  );
}
