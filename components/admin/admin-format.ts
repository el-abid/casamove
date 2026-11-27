import type { Ticket } from "@/lib/agent/types";

export const PAGE_SIZE = 8;

export const STATUS_LABELS: Record<Ticket["status"], string> = {
  pending: "En attente",
  in_progress: "En cours",
  resolved: "Clôturé",
  rejected: "Rejeté",
};

export const PROVIDER_LABELS: Record<Ticket["provider"], string> = {
  tram: "CasaMove",
  bus: "Casabus",
  train: "ONCF",
  air: "Aéroports",
  port: "Ports",
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
  // Heure du Maroc (UTC+1) calculée sans Intl pour éviter les écarts SSR/client.
  const morocco = new Date(new Date(iso).getTime() + 3_600_000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(morocco.getUTCDate())}/${pad(
    morocco.getUTCMonth() + 1
  )} ${pad(morocco.getUTCHours())}:${pad(morocco.getUTCMinutes())}`;
}

export function remaining(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "Dépassé";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")}`;
  return `${minutes} min`;
}
