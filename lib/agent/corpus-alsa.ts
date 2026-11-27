import network from "@/content/providers/alsa/network.json";
import type { Locale } from "@/content/dictionary";
import type { KnowledgeDoc } from "./corpus";

type BusRoute = {
  id: string;
  shortName: string;
  from: string | null;
  to: string | null;
  frequencyMinutes: number | null;
  durationMinutes: number | null;
  firstTime: string | null;
  stops: { id: string; name: string }[];
};

type BusNetwork = {
  fetchedAt: string;
  routes: BusRoute[];
};

const data = network as BusNetwork;

const clean = (value: string | null) =>
  (value ?? "")
    .replace(/^_+/, "")
    .replace(/A EROPORT/g, "AÉROPORT")
    .replace(/\s+/g, " ")
    .trim();

const fetchedOn = data.fetchedAt.slice(0, 10);

const SOURCE: Record<Locale, string> = {
  fr: `Casabus / ALSA · API publique, ${fetchedOn}`,
  ar: `كازابوس / ألسا · واجهة عمومية، ${fetchedOn}`,
  en: `Casabus / ALSA · public API, ${fetchedOn}`,
};

const uniqueStops = new Set(
  data.routes.flatMap((route) => route.stops.map((stop) => stop.id))
).size;

const lineList = data.routes
  .map(
    (route) =>
      `${route.shortName} : ${clean(route.from)} → ${clean(route.to)}${
        route.frequencyMinutes ? ` · ${route.frequencyMinutes} min` : ""
      }`
  )
  .join("\n");

const keyStops = [
  ["Casa Port", ["L001", "L005", "L900"]],
  ["Casa Voyageurs", ["L090"]],
  ["Ain Diab", ["L005", "L052"]],
  ["Sidi Maarouf", ["L006", "L007", "L300", "L308", "L310", "L600", "L604"]],
  ["Place Nations Unies", ["L001", "L006", "L007", "L019", "L022", "L054"]],
  ["Hay Hassani", ["L019", "L020", "L052", "L084"]],
  [
    "Moulay Youssef",
    ["L011", "L043", "L055", "L056", "L062", "L067", "L139"],
  ],
] as const;

const keyStopList = keyStops
  .map(([name, lines]) => `${name} : ${lines.join(", ")}`)
  .join("\n");

const airport = data.routes.find((route) => route.id === "1");

export const alsaCorpus: KnowledgeDoc[] = [
  {
    id: "alsa-overview",
    keywords: [
      "casabus",
      "alsa",
      "bus",
      "réseau",
      "reseau",
      "lignes",
      "arrêts",
      "arrets",
      "casablanca",
      "mohammedia",
    ],
    title: {
      fr: "Réseau Casabus",
      ar: "شبكة كازابوس",
      en: "Casabus network",
    },
    body: {
      fr: `Casabus est le réseau de bus de l'agglomération de Casablanca, exploité par ALSA Al Baida. Il compte ${data.routes.length} lignes et ${uniqueStops} arrêts répartis sur Casablanca et Mohammedia. Les lignes desservent notamment Casa Port, Casa Voyageurs, Ain Diab, Sidi Maarouf, la place Nations Unies et Hay Hassani. Les données de ce sous-site proviennent de l'API publique du réseau, collectées le ${fetchedOn}.`,
      ar: `كازابوس هي شبكة حافلات الدار البيضاء الكبرى، تديرها شركة ألسا البضاء. تضم ${data.routes.length} خطًا و${uniqueStops} محطة موزعة على الدار البيضاء والمحمدية. تخدم الخطوط خاصة ميناء الدار البيضاء، محطة Casa Voyageurs، عين الذياب، سيدي معروف، ساحة الأمم المتحدة وحي الحسني. البيانات مصدرها واجهة الشبكة العمومية، جُمعت في ${fetchedOn}.`,
      en: `Casabus is the bus network of Greater Casablanca, operated by ALSA Al Baida. It has ${data.routes.length} lines and ${uniqueStops} stops across Casablanca and Mohammedia. The lines serve Casa Port, Casa Voyageurs, Ain Diab, Sidi Maarouf, Place Nations Unies and Hay Hassani. Data comes from the network's public API, collected on ${fetchedOn}.`,
    },
    source: SOURCE,
  },
  {
    id: "alsa-airport",
    keywords: [
      "aéroport",
      "aeroport",
      "airport",
      "mohammed v",
      "mohamed v",
      "casa port",
      "l001",
      "aerobus",
    ],
    title: {
      fr: "Ligne de l'aéroport Mohammed V",
      ar: "خط مطار محمد الخامس",
      en: "Mohammed V airport line",
    },
    body: {
      fr: `La ligne ${airport?.shortName ?? "L001"} relie le terminus Casa Port au terminus Aéroport Mohammed V. Elle compte ${airport?.stops.length ?? 16} arrêts, avec une fréquence d'environ ${airport?.frequencyMinutes ?? 30} minutes et un temps de trajet d'environ ${airport?.durationMinutes ?? 24} minutes. Le premier départ depuis Casa Port est à ${airport?.firstTime?.slice(0, 5) ?? "04:40"}.`,
      ar: `الخط ${airport?.shortName ?? "L001"} يربط محطة ميناء الدار البيضاء بمحطة مطار محمد الخامس. يضم ${airport?.stops.length ?? 16} محطة، بتردد حوالي ${airport?.frequencyMinutes ?? 30} دقيقة ومدة رحلة حوالي ${airport?.durationMinutes ?? 24} دقيقة. أول انطلاقة من ميناء الدار البيضاء على الساعة ${airport?.firstTime?.slice(0, 5) ?? "04:40"}.`,
      en: `Line ${airport?.shortName ?? "L001"} links Casa Port terminus to Mohammed V Airport terminus. It has ${airport?.stops.length ?? 16} stops, a frequency of about ${airport?.frequencyMinutes ?? 30} minutes and a journey time of about ${airport?.durationMinutes ?? 24} minutes. The first departure from Casa Port is at ${airport?.firstTime?.slice(0, 5) ?? "04:40"}.`,
    },
    source: SOURCE,
  },
  {
    id: "alsa-lines",
    keywords: [
      "ligne",
      "lignes",
      "fréquence",
      "frequence",
      "horaire",
      "horaires",
      "terminus",
      "liste",
    ],
    title: {
      fr: "Lignes et fréquences Casabus",
      ar: "خطوط وترددات كازابوس",
      en: "Casabus lines and frequencies",
    },
    body: {
      fr: `Liste des lignes Casabus avec leur terminus et leur fréquence :\n${lineList}`,
      ar: `قائمة خطوط كازابوس مع نقطتي النهاية والتردد:\n${lineList}`,
      en: `Casabus lines with termini and frequency:\n${lineList}`,
    },
    source: SOURCE,
  },
  {
    id: "alsa-key-stops",
    keywords: [
      "correspondance",
      "arrêt",
      "arret",
      "station",
      "casa port",
      "casa voyageurs",
      "ain diab",
      "sidi maarouf",
      "nations unies",
      "hay hassani",
      "moulay youssef",
    ],
    title: {
      fr: "Correspondances aux principaux arrêts",
      ar: "التحويلات في المحطات الرئيسية",
      en: "Connections at key stops",
    },
    body: {
      fr: `Lignes desservant les principaux arrêts Casabus :\n${keyStopList}`,
      ar: `الخطوط التي تخدم المحطات الرئيسية لكازابوس:\n${keyStopList}`,
      en: `Lines serving key Casabus stops:\n${keyStopList}`,
    },
    source: SOURCE,
  },
  {
    id: "alsa-contact",
    keywords: [
      "contact",
      "téléphone",
      "telephone",
      "email",
      "agence",
      "service client",
      "réclamation",
      "reclamation",
    ],
    title: {
      fr: "Contact et agences Casabus",
      ar: "الاتصال والوكالات",
      en: "Casabus contact and agencies",
    },
    body: {
      fr: "Le service client Casabus / ALSA est joignable au 0520552055 et par email à client.alsaalbaida@alsa.ma. Les agences commerciales se trouvent à Maârif, Hay Hassani, Place Nations Unies et Mohammedia, ouvertes de 09:00 à 17:00. La page « Réclamations, suggestions et demandes d'information » du site Casabus permet aussi de déposer une demande.",
      ar: "يمكن الاتصال بخدمة عملاء كازابوس / ألسا على الرقم 0520552055 أو عبر البريد client.alsaalbaida@alsa.ma. توجد الوكالات التجارية في المعاريف، حي الحسني، ساحة الأمم المتحدة والمحمدية، مفتوحة من 09:00 إلى 17:00. كما تتيح صفحة الشكايات والاقتراحات على موقع كازابوس تقديم طلب.",
      en: "Casabus / ALSA customer service is reachable at 0520552055 and client.alsaalbaida@alsa.ma. Commercial agencies are in Maârif, Hay Hassani, Place Nations Unies and Mohammedia, open 09:00 to 17:00. The Casabus complaints and information page also accepts requests.",
    },
    source: SOURCE,
  },
  {
    id: "alsa-lost-item",
    keywords: [
      "objet perdu",
      "perdu",
      "trouvé",
      "trouve",
      "lost",
      "oublie",
      "oublié",
    ],
    title: {
      fr: "Objet perdu ou trouvé",
      ar: "غرض مفقود أو موجود",
      en: "Lost or found item",
    },
    body: {
      fr: "Pour un objet perdu ou trouvé dans un bus Casabus, contactez le service client au 0520552055 ou client.alsaalbaida@alsa.ma en précisant la ligne, la date, l'heure et une description de l'objet. La page « Signaler un incident ou un objet perdu / trouvé » du site Casabus permet aussi de déposer la demande.",
      ar: "للغرض المفقود أو الموجود في حافلة كازابوس، اتصل بخدمة العملاء على 0520552055 أو client.alsaalbaida@alsa.ma مع تحديد الخط والتاريخ والساعة ووصف الغرض. كما تتيح صفحة الإبلاغ عن حادث أو غرض مفقود/موجود على موقع كازابوس تقديم الطلب.",
      en: "For an item lost or found on a Casabus bus, contact customer service at 0520552055 or client.alsaalbaida@alsa.ma with the line, date, time and a description. The Casabus report an incident or lost/found item page also accepts requests.",
    },
    source: SOURCE,
  },
];

export const alsaSource = SOURCE;
