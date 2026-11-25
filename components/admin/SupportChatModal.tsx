import type { RefObject } from "react";

import type { Ticket, TicketMessage } from "@/lib/agent/types";
import { STATUS_LABELS, formatDate } from "./admin-format";

export function SupportChatModal({
  open,
  ticket,
  messages,
  bodyRef,
  reply,
  onReplyChange,
  sending,
  resolving,
  onSend,
  onAskConfirmation,
  onResolve,
  onClose,
}: {
  open: boolean;
  ticket: Ticket | null;
  messages: TicketMessage[];
  bodyRef: RefObject<HTMLDivElement | null>;
  reply: string;
  onReplyChange: (value: string) => void;
  sending: boolean;
  resolving: boolean;
  onSend: (body: string) => void;
  onAskConfirmation: () => void;
  onResolve: () => void;
  onClose: () => void;
}) {
  if (!open || !ticket) return null;

  return (
    <div
      className="adm-chat-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Conversation ${ticket.number}`}
    >
      <div className="adm-chat-modal__panel">
        <header className="adm-chat-modal__head">
          <div>
            <h2>Conversation</h2>
            <p>
              {ticket.number} · {ticket.theme} · {STATUS_LABELS[ticket.status]}
            </p>
          </div>
          <div className="adm-chat-modal__actions">
            {ticket.lastMessageRole === "user" ? (
              <span className="adm-unread-pill">Nouveau message usager</span>
            ) : null}
            <button
              type="button"
              className="adm-btn adm-btn--ghost"
              onClick={onClose}
            >
              Fermer
            </button>
          </div>
        </header>

        <div className="adm-chat-modal__body" ref={bodyRef}>
          {messages.length === 0 ? (
            <p className="adm-hint">Aucun message pour ce dossier.</p>
          ) : (
            messages.map((message) => (
              <div
                className={`adm-chat__msg adm-chat__msg--${message.role}`}
                key={message.id}
              >
                <div>
                  <b>
                    {message.role === "user"
                      ? "Usager"
                      : message.role === "agent"
                        ? "Agent"
                        : "Système"}
                  </b>
                  {message.authorEmail ? (
                    <span>{message.authorEmail}</span>
                  ) : null}
                  <time>{formatDate(message.createdAt)}</time>
                </div>
                <p>{message.body}</p>
              </div>
            ))
          )}
        </div>

        {ticket.status === "in_progress" ? (
          <div className="adm-chat-modal__compose">
            <textarea
              className="adm-comment adm-chat__input"
              rows={3}
              value={reply}
              onChange={(event) => onReplyChange(event.target.value)}
              placeholder="Répondre à l'usager…"
            />
            <div className="adm-actions">
              <button
                type="button"
                className="adm-btn adm-btn--ghost"
                disabled={sending || !reply.trim()}
                onClick={() => onSend(reply)}
              >
                Répondre
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--ghost"
                disabled={sending}
                onClick={onAskConfirmation}
              >
                Demander confirmation
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--primary"
                disabled={resolving}
                onClick={onResolve}
              >
                Clôturer le dossier
              </button>
            </div>
          </div>
        ) : ticket.status === "resolved" ? (
          <p className="adm-chat-modal__status">
            Dossier clôturé. Satisfaction :{" "}
            {ticket.csatScore !== null
              ? `${ticket.csatScore}/5`
              : "en attente de l'usager"}
            .
          </p>
        ) : ticket.status === "pending" ? (
          <p className="adm-chat-modal__status">
            Publiez la première réponse depuis l&apos;onglet Dossier pour ouvrir
            la discussion.
          </p>
        ) : (
          <p className="adm-chat-modal__status">
            Dossier rejeté et escaladé au superviseur.
          </p>
        )}
      </div>
    </div>
  );
}
