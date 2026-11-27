import type { Locale } from "./dictionary";

const index = { fr: 0, ar: 1, en: 2 } as const;

const texts = {
  brand: ["Mobility Maroc", "موبيليتي المغرب", "Mobility Morocco"],
  kicker: ["Plateforme nationale", "منصة وطنية", "National platform"],
  title: [
    "Tous vos transports, un seul point d’entrée.",
    "كل وسائل نقلكم من نقطة واحدة.",
    "All your transport, one entry point.",
  ],
  subtitle: [
    "Tramway, bus, train, aérien et maritime. Choisissez un mode, l’assistant s’occupe du reste.",
    "الطرامواي، الحافلة، القطار، الجوي والبحري. اختر وسيلتك ودع المساعد يتكفل بالباقي.",
    "Tram, bus, train, air and sea. Pick a mode and let the assistant handle the rest.",
  ],
  open: ["Ouvrir", "افتح", "Open"],
  live: ["Disponible", "متاح", "Available"],
  soon: ["Bientôt", "قريبًا", "Soon"],
  back: ["Retour au portail", "العودة إلى المنصة", "Back to the portal"],
  portal: ["Tous les transports", "كل وسائل النقل", "All transport"],
  login: ["Se connecter", "تسجيل الدخول", "Sign in"],
  register: ["Créer un compte", "إنشاء حساب", "Create account"],
  account: ["Mon compte", "حسابي", "My account"],
  comingTitle: [
    "Ce mode arrive bientôt.",
    "هذه الوسيلة قادمة قريبًا.",
    "This mode is coming soon.",
  ],
  comingText: [
    "Le sous-site est en préparation. Les données publiques sont en cours de vérification avant publication.",
    "الموقع الفرعي قيد الإعداد. يتم التحقق من البيانات العمومية قبل نشرها.",
    "The subsite is in preparation. Public data is being verified before publication.",
  ],
  source: ["Sources", "المصادر", "Sources"],
  footer: [
    "Projet de fin d’études · données publiques collectées et datées.",
    "مشروع نهاية الدراسة · بيانات عمومية مجمّعة ومؤرخة.",
    "Graduation project · public data collected and dated.",
  ],
} satisfies Record<string, [string, string, string]>;

export type PortalLabel = keyof typeof texts;

export function portalText(locale: Locale, label: PortalLabel): string {
  return texts[label][index[locale]];
}
