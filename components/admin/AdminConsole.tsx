"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CustomerInfo,
  Ticket,
  TicketDecision,
  TicketEvent,
  TicketMessage,
} from "@/lib/agent/types";
import type { HealthStatus } from "@/lib/health";
import { AdminKpis } from "./AdminKpis";
import { AdminQueuePanel } from "./AdminQueuePanel";
import { AdminShell } from "./AdminShell";
import { ProactivityPanel } from "./ProactivityPanel";
import { SupportChatModal } from "./SupportChatModal";
import { TicketDetailPanel } from "./TicketDetailPanel";
import { VocPanel } from "./VocPanel";
import { PAGE_SIZE } from "./admin-format";
import type { Agent, QueueFilters } from "./admin-types";

export function AdminConsole({ initialTickets }: { initialTickets: Ticket[] }) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(
    initialTickets[0]?.number ?? null
  );
  const [draft, setDraft] = useState(initialTickets[0]?.draft ?? "");
  const [decisions, setDecisions] = useState<TicketDecision[]>([]);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const lastUserMessageIdRef = useRef(0);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [localeFilter, setLocaleFilter] = useState("all");
  const [themeFilter, setThemeFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [periodFilter, setPeriodFilter] =
    useState<QueueFilters["period"]>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"queue" | "voc" | "success">("queue");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter)
        return false;
      if (priorityFilter !== "all" && ticket.priority !== priorityFilter) {
        return false;
      }
      if (providerFilter !== "all" && ticket.provider !== providerFilter) {
        return false;
      }
      if (localeFilter !== "all" && ticket.locale !== localeFilter) {
        return false;
      }
      if (themeFilter !== "all" && ticket.theme !== themeFilter) {
        return false;
      }
      if (
        lineFilter !== "all" &&
        (ticket.line ?? "non précisé") !== lineFilter
      ) {
        return false;
      }
      if (periodFilter !== "all") {
        const cutoff = Date.now() - Number(periodFilter) * 86_400_000;
        if (new Date(ticket.createdAt).getTime() < cutoff) return false;
      }
      if (!needle) return true;

      return (
        ticket.number.toLowerCase().includes(needle) ||
        ticket.theme.toLowerCase().includes(needle) ||
        ticket.query.toLowerCase().includes(needle)
      );
    });
  }, [
    tickets,
    statusFilter,
    priorityFilter,
    providerFilter,
    localeFilter,
    themeFilter,
    lineFilter,
    periodFilter,
    search,
  ]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const rank = (ticket: Ticket) => (ticket.status === "pending" ? 0 : 1);
      return rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt);
    });
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageTickets = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const selected =
    sorted.find((ticket) => ticket.number === selectedNumber) ??
    pageTickets[0] ??
    sorted[0] ??
    null;

  const journal: TicketEvent[] =
    events.length > 0
      ? events
      : decisions.map((decision) => ({
          id: decision.id,
          ticketNumber: decision.ticketNumber,
          event: decision.action,
          actorId: decision.adminId,
          actorEmail: decision.adminEmail,
          detail: decision.comment,
          createdAt: decision.createdAt,
        }));

  const pending = tickets.filter((ticket) => ticket.status === "pending");
  const awaitingAgent = tickets.filter(
    (ticket) =>
      (ticket.status === "pending" || ticket.status === "in_progress") &&
      ticket.lastMessageRole === "user"
  ).length;

  const filters: QueueFilters = {
    search,
    status: statusFilter,
    priority: priorityFilter,
    provider: providerFilter,
    locale: localeFilter,
    theme: themeFilter,
    line: lineFilter,
    period: periodFilter,
  };

  function handleFilterChange(patch: Partial<QueueFilters>) {
    if (patch.search !== undefined) setSearch(patch.search);
    if (patch.status !== undefined) setStatusFilter(patch.status);
    if (patch.priority !== undefined) setPriorityFilter(patch.priority);
    if (patch.provider !== undefined) setProviderFilter(patch.provider);
    if (patch.locale !== undefined) setLocaleFilter(patch.locale);
    if (patch.theme !== undefined) setThemeFilter(patch.theme);
    if (patch.line !== undefined) setLineFilter(patch.line);
    if (patch.period !== undefined) setPeriodFilter(patch.period);
  }

  function clearScope() {
    setThemeFilter("all");
    setLineFilter("all");
    setPeriodFilter("all");
  }

  function goToPage(next: number) {
    setPage(next);
    const first = sorted[(next - 1) * PAGE_SIZE];
    if (first) setSelectedNumber(first.number);
  }

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    statusFilter,
    priorityFilter,
    localeFilter,
    themeFilter,
    lineFilter,
    periodFilter,
    search,
  ]);

  async function refresh() {
    try {
      const response = await fetch("/api/tickets", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { tickets?: Ticket[] };
      if (Array.isArray(data.tickets)) setTickets(data.tickets);
    } catch {
      // silencieux : la console garde l'état précédent
    }
  }

  useEffect(() => {
    const poll = window.setInterval(refresh, 5_000);
    return () => window.clearInterval(poll);
  }, []);

  useEffect(() => {
    fetch("/api/admin/agents", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { agents?: Agent[] } | null) => {
        if (Array.isArray(data?.agents)) setAgents(data.agents);
      })
      .catch(() => {
        // la console reste utilisable sans la liste des agents
      });

    const loadHealth = () => {
      fetch("/api/health/status", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: HealthStatus | null) => {
          if (data) setHealth(data);
        })
        .catch(() => {
          // indicateur conservé à son dernier état
        });
    };

    loadHealth();
    const timer = window.setInterval(loadHealth, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selected) return;

    setDraft(selected.draft);
    setDecisions([]);
    setEvents([]);
    setMessages([]);
    setCustomer(null);
    setChatOpen(false);
    lastUserMessageIdRef.current = 0;
    setAssigneeId(selected.assignedTo?.toString() ?? "");

    let active = true;
    fetch(`/api/tickets/${encodeURIComponent(selected.number)}`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          data: {
            ticket?: Ticket;
            decisions?: TicketDecision[];
            events?: TicketEvent[];
            messages?: TicketMessage[];
            customer?: CustomerInfo | null;
          } | null
        ) => {
          if (!active || !data) return;
          if (Array.isArray(data.decisions)) setDecisions(data.decisions);
          if (Array.isArray(data.events)) setEvents(data.events);
          if (Array.isArray(data.messages)) setMessages(data.messages);
          if (data.customer !== undefined) setCustomer(data.customer);
          if (data.ticket) {
            setDraft(data.ticket.draft);
            setAssigneeId(data.ticket.assignedTo?.toString() ?? "");
          }
        }
      )
      .catch(() => {
        // la file reste utilisable sans l'historique
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.number]);

  useEffect(() => {
    setAssigneeId(selected?.assignedTo?.toString() ?? "");
  }, [selected?.assignedTo]);

  useEffect(() => {
    if (!selected?.number) return;
    const ticketNumber = selected.number;
    let active = true;

    async function loadMessages() {
      try {
        const response = await fetch(
          `/api/tickets/${encodeURIComponent(ticketNumber)}/messages`,
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          ticket?: Ticket;
          messages?: TicketMessage[];
        };
        if (!active) return;
        const latestUserMessageId = Math.max(
          0,
          ...(data.messages ?? [])
            .filter((message) => message.role === "user")
            .map((message) => message.id)
        );
        if (lastUserMessageIdRef.current === 0) {
          lastUserMessageIdRef.current = latestUserMessageId;
        } else if (latestUserMessageId > lastUserMessageIdRef.current) {
          lastUserMessageIdRef.current = latestUserMessageId;
          setNotice("Nouveau message de l'usager.");
        }
        if (Array.isArray(data.messages)) setMessages(data.messages);
        if (data.ticket) {
          setTickets((list) =>
            list.map((ticket) =>
              ticket.number === data.ticket?.number ? data.ticket : ticket
            )
          );
        }
      } catch {
        // le prochain cycle réessaie
      }
    }

    loadMessages();
    const timer = window.setInterval(loadMessages, 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selected?.number]);

  useEffect(() => {
    if (!chatOpen) return;
    const node = chatBodyRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, chatOpen]);

  async function decide(action: "approve" | "reject") {
    if (!selected || busy) return;

    if (action === "reject" && !comment.trim()) {
      setNotice("Un commentaire est obligatoire pour rejeter un dossier.");
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const response = await fetch(
        `/api/tickets/${encodeURIComponent(selected.number)}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, comment: comment.trim(), draft }),
        }
      );

      const data = (await response.json()) as {
        ticket?: Ticket;
        decisions?: TicketDecision[];
        events?: TicketEvent[];
        messages?: TicketMessage[];
        error?: string;
      };

      if (!response.ok || !data.ticket) {
        throw new Error(data.error ?? "decision_failed");
      }

      setTickets((list) =>
        list.map((ticket) =>
          ticket.number === data.ticket?.number ? data.ticket : ticket
        )
      );
      if (data.decisions) setDecisions(data.decisions);
      if (data.events) setEvents(data.events);
      if (data.messages) setMessages(data.messages);
      setComment("");
      setNotice(
        action === "approve"
          ? `Dossier ${selected.number} publié. La discussion reste ouverte.`
          : `Dossier ${selected.number} escaladé au superviseur.`
      );
      await refresh();
    } catch {
      setNotice("Action impossible. Le dossier a peut-être déjà été traité.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(body: string) {
    if (!selected || sending || !body.trim()) return;

    setSending(true);
    setNotice("");

    try {
      const response = await fetch(
        `/api/tickets/${encodeURIComponent(selected.number)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: body.trim() }),
        }
      );

      const data = (await response.json()) as {
        ticket?: Ticket;
        messages?: TicketMessage[];
        error?: string;
      };

      if (!response.ok) throw new Error(data.error ?? "message_failed");

      if (data.messages) setMessages(data.messages);
      if (data.ticket) {
        setTickets((list) =>
          list.map((ticket) =>
            ticket.number === data.ticket?.number ? data.ticket : ticket
          )
        );
      }
      setReply("");
      setNotice("Message envoyé à l'usager.");
      await refresh();
    } catch {
      setNotice("Envoi impossible. Vérifiez le dossier.");
    } finally {
      setSending(false);
    }
  }

  async function askConfirmation() {
    await sendMessage("Est-ce que je peux vous aider avec autre chose ?");
  }

  async function resolve() {
    if (!selected || resolving) return;

    setResolving(true);
    setNotice("");

    try {
      const response = await fetch(
        `/api/tickets/${encodeURIComponent(selected.number)}/resolve`,
        { method: "POST" }
      );

      const data = (await response.json()) as {
        ticket?: Ticket;
        messages?: TicketMessage[];
        error?: string;
      };

      if (!response.ok || !data.ticket) {
        throw new Error(data.error ?? "resolve_failed");
      }

      setTickets((list) =>
        list.map((ticket) =>
          ticket.number === data.ticket?.number ? data.ticket : ticket
        )
      );
      if (data.messages) setMessages(data.messages);
      setNotice(`Dossier ${selected.number} clôturé.`);
      await refresh();
    } catch {
      setNotice("Clôture impossible. Vérifiez le statut du dossier.");
    } finally {
      setResolving(false);
    }
  }

  async function assign() {
    if (!selected || busy) return;

    setBusy(true);
    setNotice("");

    try {
      const response = await fetch(
        `/api/tickets/${encodeURIComponent(selected.number)}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assigneeId: assigneeId ? Number(assigneeId) : null,
          }),
        }
      );

      const data = (await response.json()) as {
        ticket?: Ticket;
        events?: TicketEvent[];
        error?: string;
      };

      if (!response.ok || !data.ticket) {
        throw new Error(data.error ?? "assign_failed");
      }

      setTickets((list) =>
        list.map((ticket) =>
          ticket.number === data.ticket?.number ? data.ticket : ticket
        )
      );
      if (data.events) setEvents(data.events);
      setNotice(
        data.ticket.assignedTo
          ? `Dossier ${selected.number} assigné.`
          : `Dossier ${selected.number} désassigné.`
      );
      await refresh();
    } catch {
      setNotice("Assignation impossible. Vérifiez l'agent choisi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      tab={tab}
      onTabChange={setTab}
      pendingCount={pending.length}
      awaitingAgent={awaitingAgent}
      health={health}
      onRefresh={refresh}
    >
      {tab === "voc" ? (
        <VocPanel
          onThemeClick={(theme, period) => {
            setThemeFilter(theme);
            setLineFilter("all");
            setPeriodFilter(period);
            setStatusFilter("all");
            setPriorityFilter("all");
            setProviderFilter("all");
            setLocaleFilter("all");
            setSearch("");
            setTab("queue");
            setPage(1);
          }}
          onLineClick={(line, period) => {
            setLineFilter(line);
            setThemeFilter("all");
            setPeriodFilter(period);
            setStatusFilter("all");
            setPriorityFilter("all");
            setProviderFilter("all");
            setLocaleFilter("all");
            setSearch("");
            setTab("queue");
            setPage(1);
          }}
        />
      ) : tab === "success" ? (
        <ProactivityPanel />
      ) : (
        <>
          <AdminKpis tickets={tickets} now={now} />

          <div className="adm-grid">
            <AdminQueuePanel
              tickets={tickets}
              sorted={sorted}
              pageTickets={pageTickets}
              selectedNumber={selectedNumber}
              onSelect={setSelectedNumber}
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearScope={clearScope}
              awaitingAgent={awaitingAgent}
              agents={agents}
              mounted={mounted}
              now={now}
              page={page}
              pageCount={pageCount}
              onPageChange={goToPage}
            />

            <TicketDetailPanel
              ticket={selected}
              customer={customer}
              messages={messages}
              draft={draft}
              onDraftChange={setDraft}
              agents={agents}
              assigneeId={assigneeId}
              onAssigneeChange={setAssigneeId}
              onAssign={assign}
              busy={busy}
              comment={comment}
              onCommentChange={setComment}
              onDecide={decide}
              journal={journal}
              notice={notice}
              mounted={mounted}
              now={now}
              onOpenChat={() => setChatOpen(true)}
            />
          </div>
        </>
      )}

      <SupportChatModal
        open={chatOpen}
        ticket={selected}
        messages={messages}
        bodyRef={chatBodyRef}
        reply={reply}
        onReplyChange={setReply}
        sending={sending}
        resolving={resolving}
        onSend={sendMessage}
        onAskConfirmation={askConfirmation}
        onResolve={resolve}
        onClose={() => setChatOpen(false)}
      />
    </AdminShell>
  );
}
