import type { Locale } from "./dictionary";

export type ProviderId = "tram" | "bus" | "train" | "air" | "port";

export type ProviderStatus = "live" | "soon";

export type Provider = {
  id: ProviderId;
  status: ProviderStatus;
  /** Nom affiché du sous-site. */
  name: string;
  /** Opérateur ou autorité responsable. */
  operator: string;
  mode: Record<Locale, string>;
  tagline: Record<Locale, string>;
  description: Record<Locale, string>;
  accent: string;
  accentSoft: string;
  ink: string;
  sources: string[];
};

export const providers: Provider[] = [
  {
    id: "tram",
    status: "live",
    name: "CasaMove",
    operator: "Tramway de Casablanca",
    mode: { fr: "Tramway & Busway", ar: "الطرامواي والباصواي", en: "Tram & Busway" },
    tagline: {
      fr: "Le réseau qui vous rapproche.",
      ar: "شبكة تقرّبك أكثر.",
      en: "The network that brings you closer.",
    },
    description: {
      fr: "Horaires, itinéraires, trafic, abonnements et réclamations du réseau tram et busway de Casablanca.",
      ar: "مواعيد، مسارات، حالة السير، اشتراكات وشكايات شبكة الطرامواي والباصواي بالدار البيضاء.",
      en: "Schedules, journeys, service alerts, passes and complaints for the Casablanca tram and busway network.",
    },
    accent: "#e8a13a",
    accentSoft: "#fbf1de",
    ink: "#0b1728",
    sources: ["CasaMove"],
  },
  {
    id: "bus",
    status: "live",
    name: "Casabus",
    operator: "ALSA Al Baida",
    mode: { fr: "Bus urbain", ar: "الحافلة الحضرية", en: "Urban bus" },
    tagline: {
      fr: "Le bus qui couvre la ville.",
      ar: "حافلات تغطي المدينة.",
      en: "The bus that covers the city.",
    },
    description: {
      fr: "57 lignes Casabus pour Casablanca et Mohammedia, avec arrêts, fréquences et info trafic.",
      ar: "57 خطًا من كازابوس للدار البيضاء والمحمدية، مع المحطات والترددات وحالة السير.",
      en: "57 Casabus lines across Casablanca and Mohammedia, with stops, frequencies and service alerts.",
    },
    accent: "#c0392b",
    accentSoft: "#fbece8",
    ink: "#2a0f0b",
    sources: ["Casabus / ALSA", "api.alsaalbaida.ma"],
  },
  {
    id: "train",
    status: "soon",
    name: "ONCF",
    operator: "Office National des Chemins de Fer",
    mode: { fr: "Train", ar: "القطار", en: "Train" },
    tagline: {
      fr: "Le Maroc à grande vitesse.",
      ar: "المغرب بسرعة عالية.",
      en: "Morocco at high speed.",
    },
    description: {
      fr: "Lignes, horaires et correspondances du réseau ferroviaire national.",
      ar: "خطوط ومواعيد وتحويلات الشبكة الوطنية للسكك الحديدية.",
      en: "Lines, timetables and connections on the national rail network.",
    },
    accent: "#1b5fa6",
    accentSoft: "#e8f1fb",
    ink: "#0a1f3a",
    sources: ["ONCF"],
  },
  {
    id: "air",
    status: "soon",
    name: "Aéroports du Maroc",
    operator: "ONDA · Royal Air Maroc",
    mode: { fr: "Aérien", ar: "الجوي", en: "Air" },
    tagline: {
      fr: "Vos vols, vos aéroports.",
      ar: "رحلاتك ومطاراتك.",
      en: "Your flights, your airports.",
    },
    description: {
      fr: "Aéroports, vols et liaisons vers les villes du Royaume.",
      ar: "المطارات والرحلات والربط بين مدن المملكة.",
      en: "Airports, flights and connections across the Kingdom.",
    },
    accent: "#b01e2e",
    accentSoft: "#fbeaec",
    ink: "#2b0910",
    sources: ["ONDA", "Royal Air Maroc"],
  },
  {
    id: "port",
    status: "soon",
    name: "Ports du Maroc",
    operator: "ANP · Marsa Maroc",
    mode: { fr: "Maritime", ar: "البحري", en: "Sea" },
    tagline: {
      fr: "Le littoral en connexion.",
      ar: "الساحل في اتصال.",
      en: "The coast, connected.",
    },
    description: {
      fr: "Ports, traversées et accès voyageurs sur le littoral marocain.",
      ar: "الموانئ والرحلات البحرية ومداخل المسافرين على الساحل المغربي.",
      en: "Ports, crossings and passenger access along the Moroccan coast.",
    },
    accent: "#0e5a6b",
    accentSoft: "#e6f3f5",
    ink: "#062630",
    sources: ["ANP", "Marsa Maroc"],
  },
];

export function isProviderId(value: string): value is ProviderId {
  return providers.some((provider) => provider.id === value);
}

export function getProvider(value: string): Provider | undefined {
  return providers.find((provider) => provider.id === value);
}
