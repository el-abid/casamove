"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatQuickKey, Dict, Locale } from "@/content/dictionary";
import { ChatLauncher } from "./ChatLauncher";
import { ChatMessage } from "./ChatMessage";
import type {
  ChatMessageItem as Message,
  InfoQuickKey,
  SignalItem,
  TicketInfo,
  TicketMessageItem,
} from "./chat-types";

const quickKeys: ChatQuickKey[] = ["itinerary", "fares", "complaint"];

const quickQueries: Record<Locale, Record<InfoQuickKey, string>> = {
  fr: {
    itinerary: "Quels sont les horaires du service ?",
    fares: "Quel est le tarif du ticket et de l'abonnement étudiant ?",
  },
  ar: {
    itinerary: "ما هي مواعيد الخدمة؟",
    fares: "ما هو ثمن التذكرة والاشتراك الطلابي؟",
  },
  en: {
    itinerary: "What are the service hours?",
    fares: "What is the ticket and student pass fare?",
  },
};

export function ChatWidget({ dict, locale }: { dict: Dict; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complaintMode, setComplaintMode] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(1);
  const botIdRef = useRef<number | null>(null);
  const sessionRef = useRef("");
  const sinceRef = useRef("");
  const seenRef = useRef<Set<number>>(new Set());
  const readRef = useRef<Set<number>>(new Set());
  const seenMessageIdsRef = useRef<Set<number>>(new Set());
  const feedbackShownRef = useRef<Set<string>>(new Set());
  const [activeTicket, setActiveTicket] = useState<{
    number: string;
    status: string;
  } | null>(null);

  useEffect(() => {
    let id = window.sessionStorage.getItem("casamove-session");
    if (!id) {
      id = crypto.randomUUID();
      window.sessionStorage.setItem("casamove-session", id);
    }
    sessionRef.current = id;
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const node = bodyRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, typing, open]);

  useEffect(() => {
    let active = true;

    async function checkSignals() {
      try {
        const params = new URLSearchParams({
          sessionId: sessionRef.current,
        });
        if (sinceRef.current) params.set("since", sinceRef.current);

        const response = await fetch(`/api/signals?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = (await response.json()) as { signals?: SignalItem[] };
        const signals = data.signals ?? [];
        if (!active) return;

        for (const signal of signals) {
          if (seenRef.current.has(signal.id)) continue;
          seenRef.current.add(signal.id);

          const content = signal.payload[locale] ?? signal.payload.fr;
          if (!content) continue;

          setMessages((list) => [
            ...list,
            {
              id: idRef.current++,
              role: "bot",
              text: "",
              alert: {
                title: content.title,
                body: content.body,
                signalId: signal.id,
                severity: signal.severity,
              },
            },
          ]);
        }

        if (signals.length > 0) {
          sinceRef.current = signals[0].createdAt;
        }
      } catch {
        // le prochain cycle réessaie
      }
    }

    checkSignals();
    const timer = window.setInterval(checkSignals, 12_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [locale]);

  useEffect(() => {
    if (!open) return;

    for (const message of messages) {
      const signalId = message.alert?.signalId;
      if (!signalId || readRef.current.has(signalId)) continue;
      readRef.current.add(signalId);

      fetch(`/api/signals/${signalId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionRef.current }),
      }).catch(() => {
        // la lecture sera retentée au prochain rendu si nécessaire
      });
    }
  }, [open, messages]);

  function showFeedback(ticketNumber: string) {
    if (feedbackShownRef.current.has(ticketNumber)) return;
    feedbackShownRef.current.add(ticketNumber);
    setMessages((list) => [
      ...list,
      {
        id: idRef.current++,
        role: "bot",
        text: "",
        feedback: { ticketNumber },
      },
    ]);
  }

  useEffect(() => {
    if (
      !activeTicket ||
      (activeTicket.status !== "pending" &&
        activeTicket.status !== "in_progress")
    ) {
      return;
    }

    let active = true;
    const ticketNumber = activeTicket.number;

    async function pollMessages() {
      try {
        const params = new URLSearchParams({
          sessionId: sessionRef.current,
        });
        const response = await fetch(
          `/api/tickets/${ticketNumber}/messages?${params.toString()}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;

        const data = (await response.json()) as {
          ticket?: TicketInfo;
          messages?: TicketMessageItem[];
        };
        if (!active) return;

        for (const message of data.messages ?? []) {
          if (message.role !== "agent" && message.role !== "system") continue;
          if (message.body.startsWith("Réclamation enregistrée")) continue;
          if (seenMessageIdsRef.current.has(message.id)) continue;
          seenMessageIdsRef.current.add(message.id);
          if (message.role === "agent") {
            setMessages((list) => [
              ...list,
              {
                id: idRef.current++,
                role: "bot",
                text: dict.chat.agentNotification,
                system: true,
              },
            ]);
          }
          setMessages((list) => [
            ...list,
            {
              id: idRef.current++,
              role: "bot",
              text: message.body,
              system: message.role === "system",
            },
          ]);
        }

        if (data.ticket?.status === "resolved") {
          setActiveTicket(null);
          if (
            data.ticket.csatScore === null ||
            data.ticket.csatScore === undefined
          ) {
            showFeedback(ticketNumber);
          }
        } else if (data.ticket?.status) {
          setActiveTicket((current) =>
            current ? { ...current, status: data.ticket!.status! } : current
          );
        }
      } catch {
        // le prochain cycle réessaie
      }
    }

    pollMessages();
    const timer = window.setInterval(pollMessages, 4_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTicket?.number, activeTicket?.status]);

  async function submitCsat(
    messageId: number,
    ticketNumber: string,
    score: number
  ) {
    try {
      const response = await fetch(`/api/tickets/${ticketNumber}/csat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, sessionId: sessionRef.current }),
      });
      if (!response.ok) return;
      setMessages((list) =>
        list.map((message) =>
          message.id === messageId
            ? { ...message, feedback: { ticketNumber, score } }
            : message
        )
      );
    } catch {
      // le client peut réessayer
    }
  }

  async function dismissAlert(messageId: number, signalId: number) {
    try {
      await fetch(`/api/signals/${signalId}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionRef.current }),
      });
    } catch {
      // on masque quand même localement
    } finally {
      setMessages((list) => list.filter((message) => message.id !== messageId));
    }
  }

  function openChat() {
    setOpen(true);
    if (!messages.some((message) => message.text.trim().length > 0)) {
      setMessages((list) => [
        { id: idRef.current++, role: "bot", text: dict.chat.greeting },
        ...list,
      ]);
    }
  }

  async function send(
    display: string,
    payload?: string,
    intentHint?: "complaint"
  ) {
    const label = display.trim();
    const query = (payload ?? display).trim();
    if (!label || !query || busy) return;

    setBusy(true);
    setTyping(true);
    setInput("");
    botIdRef.current = null;

    setMessages((list) => [
      ...list,
      { id: idRef.current++, role: "user", text: label },
    ]);

    function ensureBot(text: string) {
      if (botIdRef.current === null) {
        const id = idRef.current++;
        botIdRef.current = id;
        setMessages((list) => [...list, { id, role: "bot", text }]);
        setTyping(false);
      } else {
        const id = botIdRef.current;
        setMessages((list) =>
          list.map((message) =>
            message.id === id
              ? { ...message, text: message.text + text }
              : message
          )
        );
      }
    }

    function handleEvent(event: string, data: Record<string, unknown>) {
      if (event === "token") {
        ensureBot(String(data.text ?? ""));
        return;
      }

      if (event === "sources") {
        const sources = data.sources as
          { title?: string; source?: string }[] | undefined;
        const items = sources ?? [];
        const titles = Array.from(
          new Set(items.map((item) => item.title).filter(Boolean))
        ) as string[];
        const refs = Array.from(
          new Set(items.map((item) => item.source).filter(Boolean))
        ) as string[];
        const label = [...titles, ...refs].join(" · ");
        if (!label) return;
        if (botIdRef.current === null) ensureBot("");
        const id = botIdRef.current;
        setMessages((list) =>
          list.map((message) =>
            message.id === id ? { ...message, source: label } : message
          )
        );
        return;
      }

      if (event === "ticket") {
        const ticket = data.ticket as TicketInfo | null;
        if (!ticket) return;
        if (botIdRef.current === null) ensureBot("");
        const id = botIdRef.current;
        setMessages((list) =>
          list.map((message) =>
            message.id === id
              ? {
                  ...message,
                  ticket: {
                    number: ticket.number,
                    priority: ticket.priority,
                    slaDeadline: ticket.slaDeadline,
                    status: ticket.status,
                    csatScore: ticket.csatScore,
                  },
                }
              : message
          )
        );
        if (ticket.status === "pending" || ticket.status === "in_progress") {
          setActiveTicket({ number: ticket.number, status: ticket.status });
        } else if (ticket.status === "resolved") {
          setActiveTicket(null);
          if (ticket.csatScore === null || ticket.csatScore === undefined) {
            showFeedback(ticket.number);
          }
        }
        return;
      }

      if (event === "error") {
        throw new Error("agent_error");
      }
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          locale,
          sessionId: sessionRef.current || "anonymous-session",
          ticketNumber: activeTicket?.number,
          intentHint,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const eventLine = block
            .split("\n")
            .find((line) => line.startsWith("event:"));
          const dataLine = block
            .split("\n")
            .find((line) => line.startsWith("data:"));

          if (!eventLine || !dataLine) continue;

          try {
            handleEvent(
              eventLine.slice(6).trim(),
              JSON.parse(dataLine.slice(5).trim())
            );
          } catch (error) {
            if (error instanceof Error && error.message === "agent_error") {
              throw error;
            }
          }
        }
      }

      if (botIdRef.current === null) {
        ensureBot(dict.chat.answers.fallback);
      }
    } catch {
      if (botIdRef.current === null) {
        ensureBot(dict.chat.error);
      } else {
        const id = botIdRef.current;
        setMessages((list) =>
          list.map((message) =>
            message.id === id ? { ...message, text: dict.chat.error } : message
          )
        );
      }
    } finally {
      setBusy(false);
      setTyping(false);
    }
  }

  function handleQuick(key: ChatQuickKey) {
    if (busy) return;

    if (key === "complaint") {
      setComplaintMode(true);
      setMessages((list) => [
        ...list,
        { id: idRef.current++, role: "bot", text: dict.chat.complaintPrompt },
      ]);
      return;
    }

    send(dict.chat.quick[key], quickQueries[locale][key]);
  }

  if (!open) {
    return <ChatLauncher dict={dict} onOpen={openChat} />;
  }

  return (
    <section className="chat" aria-label={dict.chat.title}>
      <header className="chat__head">
        <div className="chat__avatar" aria-hidden>
          CM
        </div>
        <div>
          <div className="chat__title">{dict.chat.title}</div>
          <div className="chat__status">
            <span className="dot" aria-hidden />
            {dict.chat.status}
          </div>
        </div>
        <button
          type="button"
          className="chat__close"
          onClick={() => setOpen(false)}
          aria-label={dict.chat.close}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div className="chat__body" ref={bodyRef} role="log" aria-live="polite">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            dict={dict}
            locale={locale}
            onSubmitCsat={submitCsat}
            onDismissAlert={dismissAlert}
          />
        ))}

        {typing ? (
          <div className="msg msg--bot typing" aria-label={dict.chat.status}>
            <span />
            <span />
            <span />
          </div>
        ) : null}

        <div className="quick">
          {quickKeys.map((key) => (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => handleQuick(key)}
            >
              {dict.chat.quick[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="chat__foot">{dict.chat.foot}</div>

      <form
        className="chat__input"
        onSubmit={(event) => {
          event.preventDefault();
          if (!input.trim() || busy) return;
          const value = input;
          const hint = complaintMode ? ("complaint" as const) : undefined;
          setComplaintMode(false);
          send(value, value, hint);
        }}
      >
        <label className="sr-only" htmlFor="chat-message">
          {dict.chat.placeholder}
        </label>
        <input
          id="chat-message"
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={dict.chat.placeholder}
          autoComplete="off"
        />
        <button
          className="send"
          type="submit"
          aria-label={dict.chat.send}
          disabled={busy}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
          </svg>
        </button>
      </form>
    </section>
  );
}
