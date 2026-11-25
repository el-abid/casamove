import type { Ticket } from "@/lib/agent/types";

export const PAGE_SIZE = 8;

export const STATUS_LABELS: Record<Ticket["status"], string> = {
  pending: "En attente",
  in_progress: "En cours",
  resolved: "Clôturé",
  rejected: "Rejeté",
};

export const EVENT_LABELS: Record<string, string> = {
  created: "Créé",
  assigned: "Assigné",
  unassigned: "Désassigné",
  approve: "Approuvé",
  reject: "Rejeté",
  draft_edited: "Brouillon modifié",
};

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Casablanca",
  }).format(new Date(iso));
}

export function remaining(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "Dépassé";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")}`;
  return `${minutes} min`;
}
