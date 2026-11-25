import type { Dict, Locale } from "@/content/dictionary";
import type { ChatMessageItem } from "./chat-types";

const dateTags: Record<Locale, string> = {
  fr: "fr-FR",
  ar: "ar-MA",
  en: "en-GB",
};

function formatDeadline(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(dateTags[locale], {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ChatMessage({
  message,
  dict,
  locale,
  onSubmitCsat,
  onDismissAlert,
}: {
  message: ChatMessageItem;
  dict: Dict;
  locale: Locale;
  onSubmitCsat: (
    messageId: number,
    ticketNumber: string,
    score: number
  ) => void;
  onDismissAlert: (messageId: number, signalId: number) => void;
}) {
  return (
    <div
      className={`msg msg--${message.role} ${
        message.alert
          ? "msg--alert"
          : message.feedback
            ? "msg--feedback"
            : message.system
              ? "msg--system"
              : ""
      }`}
    >
      {message.feedback ? (
        <div className="msg__feedback">
          <span className="msg__alertLabel">{dict.chat.feedbackLabel}</span>
          {message.feedback.score ? (
            <p className="msg__alertBody">
              {dict.chat.feedbackThanks} {message.feedback.score}/5
            </p>
          ) : (
            <>
              <b className="msg__alertTitle">{dict.chat.feedbackTitle}</b>
              <p className="msg__alertBody">{dict.chat.feedbackQuestion}</p>
              <div className="msg__stars">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() =>
                      onSubmitCsat(
                        message.id,
                        message.feedback!.ticketNumber,
                        score
                      )
                    }
                    aria-label={`${score} / 5`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : message.alert ? (
        <>
          <span className="msg__alertLabel">{dict.chat.alertLabel}</span>
          <b className="msg__alertTitle">{message.alert.title}</b>
          <p className="msg__alertBody">{message.alert.body}</p>
          {message.alert.signalId ? (
            <button
              type="button"
              className="msg__alertDismiss"
              onClick={() =>
                onDismissAlert(message.id, message.alert!.signalId!)
              }
            >
              {dict.chat.dismissAlert}
            </button>
          ) : null}
        </>
      ) : (
        message.text
      )}

      {message.ticket ? (
        <div className="msg__ticket">
          <span className="msg__ticketLabel">{dict.chat.caseLabel}</span>
          <b>{message.ticket.number}</b>
          <span>
            {message.ticket.priority} ·{" "}
            {formatDeadline(message.ticket.slaDeadline, locale)}
          </span>
        </div>
      ) : null}

      {message.source ? (
        <div className="msg__source">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
          </svg>
          {message.source}
        </div>
      ) : null}
    </div>
  );
}
