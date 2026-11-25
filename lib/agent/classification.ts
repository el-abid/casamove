import type { Priority, TicketSentiment } from "./types";

export const THEMES = [
  "ponctualité",
  "information",
  "propreté",
  "sécurité",
  "accessibilité",
  "abonnement",
] as const;

export const PRIORITIES = ["P1", "P2", "P3"] as const;

export const SENTIMENTS = ["negative", "neutral", "positive"] as const;

export type TicketTheme = (typeof THEMES)[number];

export type Classification = {
  theme: TicketTheme;
  priority: Priority;
  sentiment: TicketSentiment;
};

export const CLASSIFICATION_RULES = `Thèmes autorisés : ponctualité, information, propreté, sécurité, accessibilité, abonnement.
Priorités :
- P1 : agression physique, violence, danger immédiat, urgence sécurité.
- P2 : insulte, comportement d'un agent, menace, litige, remboursement, abonnement, carte perdue ou volée, fraude.
- P3 : information, retard isolé, propreté, suggestion, accessibilité.
Sentiments : negative, neutral, positive.
Une insulte ou un comportement inacceptable est toujours negative et relève de sécurité, priorité P2.`;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function themeOfQuery(query: string): TicketTheme {
  const q = normalize(query);

  if (
    /(agress|insult|impoli|menace|harcel|securit|danger|violence|comportement)/.test(
      q
    )
  ) {
    return "sécurité";
  }
  if (
    /(fauteuil|pmr|handicap|accessib|enfant|gratuit|priorit|enceinte|personne agee)/.test(
      q
    )
  ) {
    return "accessibilité";
  }
  if (/(propre|sale|hygien|odeur|ordure|poussiere)/.test(q)) {
    return "propreté";
  }
  if (/(retard|panne|perturb|supprim|annul|attente|horaire)/.test(q)) {
    return "ponctualité";
  }
  if (/(abonnement|renouvel|expire|carte|etudiant|scolarite)/.test(q)) {
    return "abonnement";
  }

  return "information";
}

function priorityOfQuery(query: string): Priority {
  const q = normalize(query);

  if (/(agress|violence|danger|securit|urgence|menace|harcel)/.test(q)) {
    return "P1";
  }
  if (
    /(insult|impoli|comportement|rembours|litige|argent|abonnement|etudiant|carte|vol|perdu|fraude)/.test(
      q
    )
  ) {
    return "P2";
  }

  return "P3";
}

function sentimentOfQuery(query: string): TicketSentiment {
  const q = normalize(query);

  if (
    /(insult|impoli|menace|agress|retard|sale|panne|rembours|plainte|probleme|mauvais|decu|colere|scandale|honte|inacceptable|furieux|enerve|jamais|aucun|non renouvel|perdu|vole|fraude|attente|supprim|annul)/.test(
      q
    )
  ) {
    return "negative";
  }
  if (
    /(merci|bravo|satisfait|rapide|propre|agreable|excellent|parfait|aide)/.test(
      q
    )
  ) {
    return "positive";
  }

  return "neutral";
}

export function lexicalClassification(query: string): Classification {
  return {
    theme: themeOfQuery(query),
    priority: priorityOfQuery(query),
    sentiment: sentimentOfQuery(query),
  };
}

export function normalizeClassification(
  input: {
    theme?: string | null;
    priority?: string | null;
    sentiment?: string | null;
  },
  query: string
): Classification {
  const fallback = lexicalClassification(query);

  return {
    theme: THEMES.includes(input.theme as TicketTheme)
      ? (input.theme as TicketTheme)
      : fallback.theme,
    priority: PRIORITIES.includes(input.priority as Priority)
      ? (input.priority as Priority)
      : fallback.priority,
    sentiment: SENTIMENTS.includes(input.sentiment as TicketSentiment)
      ? (input.sentiment as TicketSentiment)
      : fallback.sentiment,
  };
}

export function lineOfQuery(query: string): string | null {
  const q = normalize(query);

  const busway = q.match(/(?:^|\s)busway\s*([12])(?=\s|$)/);
  if (busway) return `ligne BW${busway[1]}`;

  const match =
    q.match(
      /(?:^|\s)(?:ligne|line|الخط)\s*(bw\s*[12]|t\s*[1-4]|[1-4])(?=\s|$)/
    ) ?? q.match(/(?:^|\s)(bw\s*[12]|t[1-4])(?=\s|$)/);

  if (!match) return null;

  const raw = match[1].replace(/\s+/g, "").toUpperCase();

  if (raw.startsWith("BW")) return `ligne ${raw}`;

  const number = raw.replace(/^T/, "");
  return /^[1-4]$/.test(number) ? `ligne ${number}` : null;
}
