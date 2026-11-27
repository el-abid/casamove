import { randomUUID } from "node:crypto";
import { isGraphInterrupt } from "@langchain/langgraph";

import type { Locale } from "@/content/dictionary";
import type { ProviderId } from "@/content/providers";
import { planIntermodal, type IntermodalItinerary } from "@/lib/mobility/intermodal";
import { getGraph } from "./graph";
import type { Source, Ticket } from "./types";

export type GeneralReply = {
  reply: string;
  sources: Source[];
  ticket?: Ticket | null;
  requiresSignIn?: boolean;
  route?: IntermodalItinerary;
};

const SOURCE: Record<Locale, Source> = {
  fr: { id: "intermodal", title: "Graphe intermodal", source: "CasaMove · Casabus / ALSA · ONCF (tracé simplifié)" },
  ar: { id: "intermodal", title: "شبكة متعددة الوسائط", source: "كازاموف · كازابوس / ألسا · ONCF (مخطط مبسّط)" },
  en: { id: "intermodal", title: "Intermodal graph", source: "CasaMove · Casabus / ALSA · ONCF (simplified graph)" },
};

const MODE: Record<Locale, Record<string, string>> = {
  fr: { tram: "Tram", bus: "Bus", train: "Train", walk: "Correspondance" },
  ar: { tram: "طرامواي", bus: "حافلة", train: "قطار", walk: "تحويل" },
  en: { tram: "Tram", bus: "Bus", train: "Train", walk: "Transfer" },
};

function formatItinerary(itinerary: IntermodalItinerary, locale: Locale): string {
  const title =
    locale === "ar"
      ? `المسار ${itinerary.from} ← ${itinerary.to}`
      : locale === "en"
        ? `Route ${itinerary.from} → ${itinerary.to}`
        : `Itinéraire ${itinerary.from} → ${itinerary.to}`;

  const legs = itinerary.legs.map((leg, index) => {
    const mode = MODE[locale][leg.mode] ?? leg.mode;
    const line = leg.line ? ` ${leg.line}` : "";
    if (leg.mode === "walk") {
      return `${index + 1}. ${mode} · ${leg.from} · ${leg.minutes} min`;
    }
    return `${index + 1}. ${mode}${line} · ${leg.from} → ${leg.to} · ${leg.minutes} min`;
  });

  const total =
    locale === "ar"
      ? `الإجمالي: حوالي ${itinerary.minutes} دقيقة.`
      : locale === "en"
        ? `Total: about ${itinerary.minutes} min.`
        : `Total : environ ${itinerary.minutes} min.`;

  return [title, ...legs, total].join("\n");
}

export function extractRoute(message: string): { from: string; to: string } | null {
  const text = message.toLowerCase().trim();

  const patterns: { regex: RegExp; from: number; to: number }[] = [
    {
      regex: /comment\s+(?:aller|rejoindre|me rendre)\s+(?:à|a|au|aux)?\s*(.+?)\s+(?:depuis|de|en partant de)\s+(.+?)(?:[?.!]|$)/i,
      from: 2,
      to: 1,
    },
    {
      regex: /(?:de|depuis)\s+(.+?)\s+(?:à|a|vers|jusqu'à|jusqu'a)\s+(.+?)(?:[?.!]|$)/i,
      from: 1,
      to: 2,
    },
    {
      regex: /from\s+(.+?)\s+to\s+(.+?)(?:[?.!]|$)/i,
      from: 1,
      to: 2,
    },
    {
      regex: /(?:how do i get|how to get)\s+(?:to\s+)?(.+?)\s+from\s+(.+?)(?:[?.!]|$)/i,
      from: 2,
      to: 1,
    },
    {
      regex: /(?:من)\s+(.+?)\s+(?:إلى|الى)\s+(.+?)(?:[؟?.!]|$)/,
      from: 1,
      to: 2,
    },
    {
      regex: /(.+?)\s*(?:→|->)\s*(.+?)(?:[?.!]|$)/i,
      from: 1,
      to: 2,
    },
  ];

  for (const pattern of patterns) {
    const match = pattern.regex.exec(text);
    if (!match) continue;
    const from = match[pattern.from]?.trim();
    const to = match[pattern.to]?.trim();
    if (from && to && from.length > 2 && to.length > 2) return { from, to };
  }

  return null;
}

function detectProvider(message: string): ProviderId | null {
  const text = message.toLowerCase();
  if (/(tram|tramway|casamove|\bt[1-4]\b|bw[12])/.test(text)) return "tram";
  if (/(bus|casabus|alsa|aerobus|\bl\d{3}\b)/.test(text)) return "bus";
  if (/(train|oncf|gare|rabat|mohammedia|casa voyageurs)/.test(text)) return "train";
  if (/(avion|vol\b|aéroport|aeroport|royal air maroc|\bram\b|onda)/.test(text)) return "air";
  if (/(port\b|maritime|ferry|bateau|marsa)/.test(text)) return "port";
  if (/(sidi maarouf|hay hassani|moulay youssef)/.test(text)) return "bus";
  return null;
}

function help(locale: Locale): string {
  if (locale === "ar") {
    return "أنا المساعد العام للتنقل. أستطيع حساب مسار بين الطرامواي والحافلة والقطار، أو توجيهك إلى مساعد المشغّل المناسب. جرّب: «كيف أذهب من ميناء الدار البيضاء إلى مطار محمد الخامس؟» أو «من Casa Voyageurs إلى الرباط».";
  }
  if (locale === "en") {
    return "I am the general mobility assistant. I can plan a route across tram, bus and train, or hand you to the right operator assistant. Try: \"How do I get from Casa Port to Mohammed V airport?\" or \"From Casa Voyageurs to Rabat\".";
  }
  return "Je suis l’assistant général de mobilité. Je peux calculer un trajet entre tram, bus et train, ou vous passer à l’assistant de l’opérateur concerné. Essayez : « Comment aller de Casa Port à l’aéroport Mohammed V ? » ou « De Casa Voyageurs à Rabat ».";
}

export async function providerReply(
  provider: ProviderId,
  message: string,
  locale: Locale,
  userId: number | null,
  sessionId: string
): Promise<GeneralReply> {
  const threadId = `general:${sessionId}:${randomUUID()}`;
  const config = { configurable: { thread_id: threadId } };
  const graph = await getGraph();

  let values: {
    reply?: string;
    sources?: Source[];
    ticket?: Ticket | null;
    requiresSignIn?: boolean;
  };

  try {
    values = (await graph.invoke(
      {
        query: message,
        locale,
        provider,
        sessionId: threadId,
        userId,
        intentHint: null,
      },
      config
    )) as typeof values;
  } catch (error) {
    if (!isGraphInterrupt(error)) throw error;
    const interrupted = (await graph.getState(config)) as {
      values: typeof values;
    };
    values = interrupted.values;
  }

  return {
    reply: values.reply ?? help(locale),
    sources: values.sources ?? [],
    ticket: values.ticket ?? null,
    requiresSignIn: Boolean(values.requiresSignIn),
  };
}

export async function generalReply(input: {
  message: string;
  locale: Locale;
  userId: number | null;
  sessionId: string;
}): Promise<GeneralReply> {
  const { message, locale, userId, sessionId } = input;
  const route = extractRoute(message);

  if (route) {
    const itinerary = planIntermodal(route.from, route.to);
    if (itinerary) {
      return {
        reply: formatItinerary(itinerary, locale),
        sources: [SOURCE[locale]],
        route: itinerary,
      };
    }

    return {
      reply:
        locale === "ar"
          ? "لم أجد هاتين المحطتين في الشبكة. جرّب أسماء مثل Casa Port، Sidi Moumen، Casa Voyageurs، Aéroport Mohammed V أو Rabat."
          : locale === "en"
            ? "I could not find these two stops in the network. Try Casa Port, Sidi Moumen, Casa Voyageurs, Mohammed V airport or Rabat."
            : "Je n’ai pas trouvé ces deux arrêts dans le réseau. Essayez Casa Port, Sidi Moumen, Casa Voyageurs, Aéroport Mohammed V ou Rabat.",
      sources: [],
    };
  }

  const provider = detectProvider(message);
  if (provider) {
    return providerReply(provider, message, locale, userId, sessionId);
  }

  return { reply: help(locale), sources: [] };
}

export const AGENT_CARDS: Record<
  ProviderId,
  { name: string; operator: string; capabilities: string[] }
> = {
  tram: { name: "CasaMove", operator: "Tramway de Casablanca", capabilities: ["information", "complaint", "support"] },
  bus: { name: "Casabus", operator: "ALSA Al Baida", capabilities: ["information", "complaint", "support"] },
  train: { name: "ONCF", operator: "Office National des Chemins de Fer", capabilities: ["information"] },
  air: { name: "Aéroports du Maroc", operator: "ONDA · Royal Air Maroc", capabilities: ["information"] },
  port: { name: "Ports du Maroc", operator: "ANP · Marsa Maroc", capabilities: ["information"] },
};
