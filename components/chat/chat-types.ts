import type { ChatQuickKey } from "@/content/dictionary";

export type TicketInfo = {
  number: string;
  priority: string;
  slaDeadline: string;
  status?: string;
  csatScore?: number | null;
};

export type ChatMessageItem = {
  id: number;
  role: "bot" | "user";
  text: string;
  source?: string;
  ticket?: TicketInfo;
  alert?: { title: string; body: string; signalId?: number; severity?: string };
  feedback?: { ticketNumber: string; score?: number };
  system?: boolean;
};

export type TicketMessageItem = {
  id: number;
  role: "user" | "agent" | "system";
  body: string;
};

export type SignalItem = {
  id: number;
  kind: string;
  line: string | null;
  severity?: string;
  payload: Record<string, { title: string; body: string } | undefined>;
  createdAt: string;
};

export type InfoQuickKey = Exclude<ChatQuickKey, "complaint">;
