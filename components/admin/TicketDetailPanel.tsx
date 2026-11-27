import type {
  CustomerInfo,
  Ticket,
  TicketEvent,
  TicketMessage,
} from "@/lib/agent/types";
import {
  EVENT_LABELS,
  PROVIDER_LABELS,
  STATUS_LABELS,
  formatDate,
  remaining,
} from "./admin-format";
import type { Agent } from "./admin-types";

export function TicketDetailPanel({
  ticket,
  customer,
  messages,
  draft,
  onDraftChange,
  agents,
  assigneeId,
  onAssigneeChange,
  onAssign,
  busy,
  comment,
  onCommentChange,
  onDecide,
  journal,
  notice,
  mounted,
  now,
  onOpenChat,
}: {
  ticket: Ticket | null;
  customer: CustomerInfo | null;
  messages: TicketMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  agents: Agent[];
  assigneeId: string;
  onAssigneeChange: (value: string) => void;
  onAssign: () => void;
  busy: boolean;
  comment: string;
  onCommentChange: (value: string) => void;
  onDecide: (action: "approve" | "reject") => void;
  journal: TicketEvent[];
  notice: string;
  mounted: boolean;
  now: number;
  onOpenChat: () => void;
}) {
  const assignedName = ticket?.assignedTo
    ? (agents.find((agent) => agent.id === ticket.assignedTo)?.fullName ??
      `Agent #${ticket.assignedTo}`)
    : "Non assigné";
  const lastMessage = messages[messages.length - 1];

  return (
    <section className="adm-panel adm-detail">
      {ticket ? (
        <>
          <div className="adm-detail__scroll">
            <header className="adm-detail__head">
              <div>
                <h2>{ticket.number}</h2>
                <p>
                  <span
                    className={`adm-provider adm-provider--${ticket.provider}`}
                  >
                    {PROVIDER_LABELS[ticket.provider]}
                  </span>{" "}
                  {ticket.theme} · canal chat · {ticket.locale.toUpperCase()}
                </p>
              </div>
              <div className="adm-detail__badges">
                <span
                  className={`adm-badge adm-badge--${ticket.priority.toLowerCase()}`}
                >
                  {ticket.priority}
                </span>
                <span className={`adm-status adm-status--${ticket.status}`}>
                  {STATUS_LABELS[ticket.status]}
                </span>
              </div>
            </header>

            <div className="adm-meta">
              <div>
                <span>Créé le</span>
                <b>{formatDate(ticket.createdAt)}</b>
              </div>
              <div>
                <span>Échéance SLA</span>
                <b>{formatDate(ticket.slaDeadline)}</b>
              </div>
              <div>
                <span>Reste</span>
                <b
                  className={
                    ticket.status === "pending" ? "is-risk" : undefined
                  }
                >
                  {mounted ? remaining(ticket.slaDeadline, now) : "—"}
                </b>
              </div>
              <div>
                <span>Session</span>
                <b className="adm-mono">{ticket.threadId.slice(0, 8)}…</b>
              </div>
            </div>

            <div className="adm-assign">
              <div className="adm-assign__current">
                <span className="adm-label">Assignation</span>
                <b>{assignedName}</b>
              </div>
              <select
                className="adm-filter"
                value={assigneeId}
                onChange={(event) => onAssigneeChange(event.target.value)}
                aria-label="Assigner à un agent"
              >
                <option value="">Non assigné</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.fullName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="adm-btn"
                disabled={
                  busy || assigneeId === (ticket.assignedTo?.toString() ?? "")
                }
                onClick={onAssign}
              >
                Assigner
              </button>
            </div>

            <div className="adm-section">
              <span className="adm-label">Demande de l&apos;usager</span>
              <blockquote className="adm-quote">{ticket.query}</blockquote>
            </div>

            <div className="adm-section">
              <span className="adm-label">Usager</span>
              {customer ? (
                <>
                  <div className="adm-customer">
                    <div>
                      <span>Nom</span>
                      <b>{customer.fullName}</b>
                    </div>
                    <div>
                      <span>Email</span>
                      <b>{customer.email}</b>
                    </div>
                    <div>
                      <span>Téléphone</span>
                      <b>{customer.phone ?? "—"}</b>
                    </div>
                    <div>
                      <span>Abonnement</span>
                      <b>
                        {customer.subscription
                          ? `${customer.subscription.planLabel} · ${customer.subscription.statusLabel} · ${customer.subscription.daysLeft} j`
                          : "Aucun"}
                      </b>
                    </div>
                    <div>
                      <span>Dossiers</span>
                      <b>{customer.ticketCount}</b>
                    </div>
                  </div>
                  {customer.recentTickets.length > 0 ? (
                    <div className="adm-customer__history">
                      {customer.recentTickets.map((item) => (
                        <span key={item.number}>
                          {item.number} · {item.theme} ·{" "}
                          {STATUS_LABELS[item.status]}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="adm-hint">Aucun compte rattaché à ce dossier.</p>
              )}
            </div>

            <div className="adm-section">
              <span className="adm-label">Conversation</span>
              <div className="adm-chat-preview">
                {lastMessage
                  ? `${lastMessage.role === "user" ? "Usager" : lastMessage.role === "agent" ? "Agent" : "Système"} : ${lastMessage.body}`
                  : "Aucun message pour ce dossier."}
              </div>
              <div className="adm-chat-actions">
                <button type="button" className="adm-btn" onClick={onOpenChat}>
                  Ouvrir la conversation ({messages.length})
                </button>
                {ticket.status === "resolved" ? (
                  <span className="adm-hint">
                    Satisfaction :{" "}
                    {ticket.csatScore !== null
                      ? `${ticket.csatScore}/5`
                      : "en attente"}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="adm-section adm-section--grow">
              <span className="adm-label">Brouillon de réponse</span>
              <textarea
                className="adm-draft"
                value={draft}
                readOnly={ticket.status !== "pending"}
                onChange={(event) => onDraftChange(event.target.value)}
                rows={7}
              />
              <p className="adm-hint">
                Le brouillon est généré par l&apos;agent Réclamation. La
                décision humaine est journalisée avant publication.
              </p>
            </div>

            {journal.length > 0 ? (
              <div className="adm-section">
                <span className="adm-label">Journal des actions</span>
                <div className="adm-journal">
                  {journal
                    .slice()
                    .reverse()
                    .map((item) => (
                      <div className="adm-journal__row" key={item.id}>
                        <b>{EVENT_LABELS[item.event] ?? item.event}</b>
                        <span>{item.actorEmail || "système"}</span>
                        <time>{formatDate(item.createdAt)}</time>
                        {item.detail ? <p>{item.detail}</p> : null}
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="adm-detail__footer">
            {ticket.status === "pending" ? (
              <div className="adm-decision">
                <input
                  className="adm-comment"
                  value={comment}
                  onChange={(event) => onCommentChange(event.target.value)}
                  placeholder="Commentaire interne, obligatoire en cas de rejet"
                />
                <div className="adm-actions">
                  <button
                    type="button"
                    className="adm-btn adm-btn--primary"
                    disabled={busy}
                    onClick={() => onDecide("approve")}
                  >
                    Publier la réponse
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--danger"
                    disabled={busy}
                    onClick={() => onDecide("reject")}
                  >
                    Rejeter et escalader
                  </button>
                </div>
              </div>
            ) : (
              <p className="adm-decided">
                {ticket.status === "in_progress"
                  ? "Dossier en cours. La conversation est ouverte avec l'usager."
                  : ticket.status === "resolved"
                    ? "Dossier clôturé avec l'accord de l'usager."
                    : ticket.status === "rejected"
                      ? "Dossier rejeté et escaladé au superviseur."
                      : "Aucune action supplémentaire."}
              </p>
            )}

            {notice ? (
              <p className="adm-notice" role="status">
                {notice}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div className="adm-empty adm-empty--detail">
          <b>Console prête.</b>
          <p>
            Déposez une réclamation dans le chat du site. Elle apparaîtra ici
            avec sa priorité, son échéance et son brouillon.
          </p>
          <a className="adm-btn" href="/fr">
            Ouvrir le site
          </a>
        </div>
      )}
    </section>
  );
}
