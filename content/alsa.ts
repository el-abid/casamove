import type { Locale } from "./dictionary";

const index = { fr: 0, ar: 1, en: 2 } as const;

const texts = {
  kicker: ["Bus urbain · ALSA Al Baida", "حافلات حضرية · ألسا البضاء", "Urban bus · ALSA Al Baida"],
  title: [
    "Le réseau de bus de Casablanca et Mohammedia.",
    "شبكة حافلات الدار البيضاء والمحمدية.",
    "The bus network of Casablanca and Mohammedia.",
  ],
  text: [
    "57 lignes, 1 056 arrêts et les fréquences officielles, dans un seul sous-site.",
    "57 خطًا و1056 محطة والترددات الرسمية في موقع فرعي واحد.",
    "57 lines, 1,056 stops and official frequencies, in one subsite.",
  ],
  search: [
    "Rechercher une ligne, un arrêt, un terminus",
    "ابحث عن خط أو محطة أو نقطة نهاية",
    "Search a line, a stop, a terminus",
  ],
  searchHint: [
    "Exemples : Aéroport, Casa Port, Lissasfa",
    "أمثلة: المطار، ميناء الدار البيضاء، ليساسفة",
    "Try: Airport, Casa Port, Lissasfa",
  ],
  noResult: [
    "Aucune ligne ne correspond à cette recherche.",
    "لا يوجد خط يطابق هذا البحث.",
    "No line matches this search.",
  ],
  lines: ["lignes", "خطوط", "lines"],
  stops: ["arrêts", "محطات", "stops"],
  select: [
    "Sélectionnez une ligne pour afficher ses arrêts.",
    "اختر خطًا لعرض محطاته.",
    "Select a line to show its stops.",
  ],
  frequency: ["Fréquence", "التردد", "Frequency"],
  duration: ["Durée", "المدة", "Duration"],
  first: ["Premier départ", "أول انطلاقة", "First departure"],
  last: ["Dernier départ", "آخر انطلاقة", "Last departure"],
  minutes: ["min", "د", "min"],
  line: ["Ligne", "الخط", "Line"],
  data: [
    "Données Casabus / ALSA collectées le",
    "بيانات كازابوس / ألسا جُمعت في",
    "Casabus / ALSA data collected on",
  ],
  source: ["Source", "المصدر", "Source"],
  about: [
    "Ce sous-site présente le réseau Casabus opéré par ALSA. Les données proviennent de l’API publique du réseau.",
    "يعرض هذا الموقع الفرعي شبكة كازابوس التي تديرها ألسا. البيانات من واجهة برمجة التطبيقات العمومية للشبكة.",
    "This subsite presents the Casabus network operated by ALSA. Data comes from the network’s public API.",
  ],
  terminus: ["Terminus", "نقطة النهاية", "Terminus"],
  allStops: ["Arrêts de la ligne", "محطات الخط", "Line stops"],
  results: ["lignes trouvées", "خطوط", "lines found"],
  cities: ["villes", "مدينتان", "cities"],
  chatGreeting: [
    "Bonjour, je suis l’assistant Casabus. Lignes, arrêts, aéroport ou réclamation ?",
    "مرحبًا، أنا مساعد كازابوس. خطوط، محطات، مطار أم شكاية؟",
    "Hello, I am the Casabus assistant. Lines, stops, airport or complaint?",
  ],
  chatLines: ["Lignes", "الخطوط", "Lines"],
  chatAirport: ["Aéroport", "المطار", "Airport"],
  chatComplaint: ["Réclamation", "شكاية", "Complaint"],
  chatTitle: ["Assistant Casabus", "مساعد كازابوس", "Casabus assistant"],
} satisfies Record<string, [string, string, string]>;

export type AlsaLabel = keyof typeof texts;

export function alsaText(locale: Locale, label: AlsaLabel): string {
  return texts[label][index[locale]];
}
