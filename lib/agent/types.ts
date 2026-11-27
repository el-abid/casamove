import type { Locale } from "@/content/dictionary";
import type { ProviderId } from "@/content/providers";

export type Intent =
  "info" | "complaint" | "support" | "conversation" | "unknown";

export type Priority = "P1" | "P2" | "P3";

export type TicketStatus = "pending" | "in_progress" | "resolved" | "rejected";

export type TicketSentiment = "negative" | "neutral" | "positive";

export type Source = {
  id: string;
  title: string;
  source: string;
};

export type Ticket = {
  number: string;
  status: TicketStatus;
  priority: Priority;
  theme: string;
  sentiment: TicketSentiment;
  provider: ProviderId;
  line: string | null;
  locale: Locale;
  threadId: string;
  userId: number | null;
  assignedTo: number | null;
  query: string;
  draft: string;
  createdAt: string;
  slaDeadline: string;
  resolvedAt: string | null;
  csatScore: number | null;
  lastMessageRole: "user" | "agent" | "system" | null;
  lastMessageAt: string | null;
};

export type TicketMessage = {
  id: number;
  ticketNumber: string;
  role: "user" | "agent" | "system";
  body: string;
  authorEmail: string;
  createdAt: string;
};

export type HitlDecision = {
  action: "approve" | "reject";
  comment?: string;
};

export type HitlPayload = {
  ticket: Ticket;
  draft: string;
};

export type TicketDecision = {
  id: number;
  ticketNumber: string;
  action: "approve" | "reject";
  comment: string;
  adminId: number | null;
  adminEmail: string;
  createdAt: string;
};

export type TicketEvent = {
  id: number;
  ticketNumber: string;
  event: string;
  actorId: number | null;
  actorEmail: string;
  detail: string;
  createdAt: string;
};

export type CustomerInfo = {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  subscription: {
    planLabel: string;
    statusLabel: string;
    endsAt: string;
    daysLeft: number;
    price: number;
  } | null;
  ticketCount: number;
  recentTickets: {
    number: string;
    status: TicketStatus;
    theme: string;
    createdAt: string;
  }[];
};
