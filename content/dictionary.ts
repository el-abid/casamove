export const locales = ["fr", "ar", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

export const dirs: Record<Locale, "ltr" | "rtl"> = {
  fr: "ltr",
  ar: "rtl",
  en: "ltr",
};

export const localeNames: Record<Locale, string> = {
  fr: "FR",
  ar: "AR",
  en: "EN",
};

export type NavKey = "explore" | "lines" | "tickets" | "news" | "contact";
export type TileKey = "lines" | "map" | "shops" | "contact";
export type ChatQuickKey = "itinerary" | "fares" | "complaint";

export type NewsItem = {
  tag: string;
  title: string;
  excerpt: string;
  date: string;
};

export type Dict = {
  meta: { title: string; description: string };
  utility: { network: string; service: string; hours: string };
  nav: Record<NavKey, string>;
  header: { recharge: string; search: string; account: string };
  account: {
    title: string;
    subtitle: string;
    email: string;
    phone: string;
    tickets: string;
    empty: string;
    logout: string;
    subscription: string;
    noSubscription: string;
    ends: string;
    daysLeft: string;
    status: {
      pending: string;
      in_progress: string;
      resolved: string;
      rejected: string;
    };
    responses: string;
  };
  hero: {
    kicker: string;
    title: string;
    sub: string;
    from: string;
    to: string;
    fromValue: string;
    toValue: string;
    cta: string;
    mapTitle: string;
    legend1: string;
    legend2: string;
    legend3: string;
    stats: string;
  };
  tiles: Record<TileKey, { title: string; desc: string }>;
  news: { heading: string; all: string; read: string; items: NewsItem[] };
  app: {
    kicker: string;
    title: string;
    sub: string;
    features: string[];
    apple: string;
    google: string;
  };
  newsletter: {
    title: string;
    sub: string;
    placeholder: string;
    button: string;
    consent: string;
    success: string;
  };
  footer: {
    contactTitle: string;
    phoneLabel: string;
    hours: string;
    emailLabel: string;
    linksTitle: string;
    links: string[];
    rights: string;
  };
  chat: {
    open: string;
    close: string;
    launcher: string;
    title: string;
    status: string;
    greeting: string;
    placeholder: string;
    send: string;
    source: string;
    foot: string;
    error: string;
    caseLabel: string;
    complaintPrompt: string;
    approved: string;
    rejected: string;
    alertLabel: string;
    dismissAlert: string;
    feedbackLabel: string;
    feedbackTitle: string;
    feedbackQuestion: string;
    feedbackThanks: string;
    agentNotification: string;
    quick: Record<ChatQuickKey, string>;
    answers: Record<ChatQuickKey | "fallback", string>;
  };
  a11y: { menu: string; language: string };
};

const fr: Dict = {
  meta: {
    title: "CasaMove · Se déplacer à Casablanca",
    description:
      "Horaires, itinéraires, abonnements et réclamations. L'assistant CasaMove répond en français, en arabe et en anglais.",
  },
  utility: {
    network: "Réseau tram et busway de Casablanca",
    service: "Service client",
    hours: "Lun au sam, 8 h à 20 h",
  },
  nav: {
    explore: "Se déplacer",
    lines: "Lignes et horaires",
    tickets: "Tarifs et abonnements",
    news: "Actualités",
    contact: "Contact",
  },
  header: {
    recharge: "Rechargez",
    search: "Rechercher une station",
    account: "Mon compte",
  },
  account: {
    title: "Mon compte",
    subtitle: "Vos informations et vos dossiers.",
    email: "Email",
    phone: "Téléphone",
    tickets: "Mes dossiers",
    empty:
      "Aucun dossier pour le moment. Déposez une réclamation depuis le chat.",
    logout: "Se déconnecter",
    subscription: "Mon abonnement",
    noSubscription: "Aucun abonnement actif sur ce compte.",
    ends: "Fin",
    daysLeft: "Jours restants",
    status: {
      pending: "En attente",
      in_progress: "En cours",
      resolved: "Clôturé",
      rejected: "Rejeté",
    },
    responses: "Réponses publiées",
  },
  hero: {
    kicker: "Le réseau en un clin d'œil",
    title: "Se déplacer à Casablanca n'a jamais été aussi simple.",
    sub: "Horaires, itinéraires, abonnements et réclamations. L'assistant CasaMove répond sur cette page, en français, en arabe et en anglais.",
    from: "Départ",
    to: "Arrivée",
    fromValue: "Casa Port",
    toValue: "Sidi Mohamed Ben Abdellah",
    cta: "Rechercher",
    mapTitle: "Carte du réseau",
    legend1: "Ligne 1",
    legend2: "Ligne 2",
    legend3: "Busway",
    stats: "151 stations · un tram toutes les 8 min",
  },
  tiles: {
    lines: {
      title: "Lignes et horaires",
      desc: "Les 4 lignes, station par station",
    },
    map: { title: "Carte réseau", desc: "151 stations, un seul ticket" },
    shops: { title: "Points de vente", desc: "Rechargez près de chez vous" },
    contact: {
      title: "Nous contacter",
      desc: "Réclamation, suivi, assistance",
    },
  },
  news: {
    heading: "Actualités",
    all: "Tout voir",
    read: "Lire",
    items: [
      {
        tag: "Infos réseau",
        title: "Horaires d'hiver du service",
        excerpt: "Tramway et busway, du 1er novembre au 31 mars.",
        date: "12/11/2026",
      },
      {
        tag: "Perturbation",
        title: "Travaux sur la ligne 1",
        excerpt: "Service interrompu entre deux stations, samedi matin.",
        date: "08/11/2026",
      },
      {
        tag: "Événement",
        title: "Marathon de Casablanca",
        excerpt: "Service adapté le 25 novembre, dès 6 h.",
        date: "30/10/2026",
      },
    ],
  },
  app: {
    kicker: "Application mobile",
    title: "Tout Casa dans votre poche.",
    sub: "Horaires, info trafic et e-boutique, sur iOS et Android.",
    features: [
      "Planification de trajet",
      "Horaires en temps réel",
      "Info trafic",
    ],
    apple: "App Store",
    google: "Google Play",
  },
  newsletter: {
    title: "Rejoignez notre communauté",
    sub: "Recevez les infos trafic et les nouveautés du réseau.",
    placeholder: "Votre e-mail",
    button: "S'abonner",
    consent:
      "En vous abonnant, vous acceptez notre politique de confidentialité.",
    success: "Merci, votre inscription est enregistrée.",
  },
  footer: {
    contactTitle: "Une question ?",
    phoneLabel: "Par téléphone",
    hours: "Du lundi au samedi, 8 h à 20 h",
    emailLabel: "Par e-mail",
    linksTitle: "Informations",
    links: [
      "Conditions d'utilisation",
      "Politique de confidentialité",
      "Accessibilité",
    ],
    rights: "© 2026 CasaMove. Démonstration.",
  },
  chat: {
    open: "Ouvrir l'assistant",
    close: "Fermer l'assistant",
    launcher: "Une question ?",
    title: "Assistant CasaMove",
    status: "En ligne · répond en 3 langues",
    greeting:
      "Bonjour, je suis l'assistant CasaMove. Horaires, itinéraires, abonnements ou réclamation ?",
    placeholder: "Écrivez votre message…",
    send: "Envoyer",
    source: "Horaires hiver 2026",
    foot: "Démo · orchestré par LangGraph",
    error: "Connexion interrompue. Réessayez dans un instant.",
    caseLabel: "Dossier",
    complaintPrompt:
      "Décrivez le problème, la ligne et la date. Je crée le dossier dès que j'ai ces éléments.",
    approved:
      "Votre dossier {number} a été validé. La réponse a été envoyée dans cette conversation.",
    rejected: "Votre dossier {number} a été escaladé au superviseur.",
    alertLabel: "Alerte proactive",
    dismissAlert: "Masquer",
    feedbackLabel: "Votre avis",
    feedbackTitle: "Votre dossier est clôturé.",
    feedbackQuestion: "Quelle est votre satisfaction ?",
    feedbackThanks: "Merci pour votre retour.",
    agentNotification: "Nouveau message de l'agent",
    quick: {
      itinerary: "Horaires",
      fares: "Tarif étudiant",
      complaint: "Réclamation",
    },
    answers: {
      itinerary:
        "Le service circule de 5h30 à 22h30. Aux heures de pointe, comptez un tram toutes les 5 à 7 minutes.",
      fares:
        "La grille tarifaire et l'abonnement étudiant sont détaillés sur la page Tarifs. Je peux vous y emmener.",
      complaint:
        "Je peux ouvrir un dossier. Décrivez le problème, la ligne et la date, et je vous donne un numéro de suivi.",
      fallback:
        "Je n'ai pas encore cette information. Je peux transmettre à un agent ou ouvrir une réclamation.",
    },
  },
  a11y: { menu: "Menu", language: "Langue" },
};

const ar: Dict = {
  meta: {
    title: "كازاموف · التنقل في الدار البيضاء",
    description:
      "المواعيد والمسارات والاشتراكات والشكايات. مساعد كازاموف يجيب بالعربية والفرنسية والإنجليزية.",
  },
  utility: {
    network: "شبكة الترامواي والباصواي بالدار البيضاء",
    service: "خدمة العملاء",
    hours: "من الاثنين إلى السبت، من 8 صباحاً إلى 8 مساءً",
  },
  nav: {
    explore: "التنقل",
    lines: "الخطوط والمواعيد",
    tickets: "التذاكر والاشتراكات",
    news: "الأخبار",
    contact: "اتصل بنا",
  },
  header: {
    recharge: "اشحن",
    search: "ابحث عن محطة",
    account: "حسابي",
  },
  account: {
    title: "حسابي",
    subtitle: "معلوماتك وملفاتك.",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    tickets: "ملفاتي",
    empty: "لا يوجد أي ملف حالياً. قدّم شكاية من المحادثة.",
    logout: "تسجيل الخروج",
    subscription: "اشتراكي",
    noSubscription: "لا يوجد اشتراك نشط في هذا الحساب.",
    ends: "ينتهي",
    daysLeft: "الأيام المتبقية",
    status: {
      pending: "قيد الانتظار",
      in_progress: "قيد المعالجة",
      resolved: "مغلق",
      rejected: "مرفوض",
    },
    responses: "الردود المنشورة",
  },
  hero: {
    kicker: "الشبكة في لمحة",
    title: "التنقل في الدار البيضاء لم يكن يوماً بهذه السهولة.",
    sub: "المواعيد والمسارات والاشتراكات والشكايات. مساعد كازاموف يجيبك في هذه الصفحة، بالعربية والفرنسية والإنجليزية.",
    from: "الانطلاق",
    to: "الوصول",
    fromValue: "كازا بور",
    toValue: "سيدي محمد بن عبد الله",
    cta: "ابحث",
    mapTitle: "خريطة الشبكة",
    legend1: "الخط 1",
    legend2: "الخط 2",
    legend3: "الباصواي",
    stats: "151 محطة · ترام كل 8 دقائق",
  },
  tiles: {
    lines: { title: "الخطوط والمواعيد", desc: "الخطوط الأربعة، محطة بمحطة" },
    map: { title: "خريطة الشبكة", desc: "151 محطة بتذكرة واحدة" },
    shops: { title: "نقاط البيع", desc: "اشحن قرب منزلك" },
    contact: { title: "اتصل بنا", desc: "شكاية، تتبع، مساعدة" },
  },
  news: {
    heading: "الأخبار",
    all: "عرض الكل",
    read: "اقرأ",
    items: [
      {
        tag: "أخبار الشبكة",
        title: "مواعيد الشتاء للخدمة",
        excerpt: "الترامواي والباصواي، من فاتح نونبر إلى 31 مارس.",
        date: "12/11/2026",
      },
      {
        tag: "اضطراب",
        title: "أشغال على الخط 1",
        excerpt: "توقف الخدمة بين محطتين، صباح السبت.",
        date: "08/11/2026",
      },
      {
        tag: "حدث",
        title: "ماراثون الدار البيضاء",
        excerpt: "خدمة معدلة يوم 25 نونبر، ابتداءً من السادسة صباحاً.",
        date: "30/10/2026",
      },
    ],
  },
  app: {
    kicker: "التطبيق المحمول",
    title: "كل الدار البيضاء في جيبك.",
    sub: "المواعيد، حركة السير والمتجر الإلكتروني، على iOS وAndroid.",
    features: ["تخطيط الرحلة", "المواعيد الفورية", "معلومات حركة السير"],
    apple: "App Store",
    google: "Google Play",
  },
  newsletter: {
    title: "انضم إلى مجتمعنا",
    sub: "توصّل بأخبار حركة السير والجديد في الشبكة.",
    placeholder: "بريدك الإلكتروني",
    button: "اشترك",
    consent: "بالاشتراك، فإنك توافق على سياسة الخصوصية.",
    success: "شكراً، تم تسجيل اشتراكك.",
  },
  footer: {
    contactTitle: "هل لديك سؤال؟",
    phoneLabel: "هاتفياً",
    hours: "من الاثنين إلى السبت، من 8 إلى 20",
    emailLabel: "بالبريد الإلكتروني",
    linksTitle: "معلومات",
    links: ["شروط الاستخدام", "سياسة الخصوصية", "إمكانية الوصول"],
    rights: "© 2026 كازاموف. نسخة تجريبية.",
  },
  chat: {
    open: "افتح المساعد",
    close: "أغلق المساعد",
    launcher: "هل لديك سؤال؟",
    title: "مساعد كازاموف",
    status: "متصل · يجيب بثلاث لغات",
    greeting: "مرحباً، أنا مساعد كازاموف. مواعيد، مسارات، اشتراكات أم شكاية؟",
    placeholder: "اكتب رسالتك…",
    send: "إرسال",
    source: "مواعيد الشتاء 2026",
    foot: "نسخة تجريبية · مدعوم بـ LangGraph",
    error: "انقطع الاتصال. أعد المحاولة بعد لحظات.",
    caseLabel: "الملف",
    complaintPrompt:
      "صف المشكلة والخط والتاريخ. سأفتح الملف بمجرد توفر هذه العناصر.",
    approved: "تمت المصادقة على ملفك {number}. أُرسل الرد في هذه المحادثة.",
    rejected: "تم رفع ملفك {number} إلى المشرف.",
    alertLabel: "تنبيه استباقي",
    dismissAlert: "إخفاء",
    feedbackLabel: "رأيك",
    feedbackTitle: "تم إغلاق ملفك.",
    feedbackQuestion: "ما مدى رضاك؟",
    feedbackThanks: "شكراً على ملاحظتك.",
    agentNotification: "رسالة جديدة من الموظف",
    quick: {
      itinerary: "المواعيد",
      fares: "ثمن التذكرة",
      complaint: "شكاية",
    },
    answers: {
      itinerary:
        "تعمل الشبكة من 5:30 إلى 22:30. في ساعات الذروة تمر العربة كل 5 إلى 7 دقائق.",
      fares:
        "تجد التذكرة الموحدة والاشتراك الطلابي في صفحة التذاكر. هل أفتح لك التفاصيل؟",
      complaint:
        "أستطيع فتح شكاية. صف لي المشكلة والخط والتاريخ، وسأعطيك رقم تتبع.",
      fallback:
        "لا أملك هذه المعلومة بعد. أستطيع تحويلك إلى موظف أو فتح شكاية.",
    },
  },
  a11y: { menu: "القائمة", language: "اللغة" },
};

const en: Dict = {
  meta: {
    title: "CasaMove · Getting around Casablanca",
    description:
      "Schedules, routes, passes and complaints. The CasaMove assistant answers in French, Arabic and English.",
  },
  utility: {
    network: "Casablanca tram and busway network",
    service: "Customer service",
    hours: "Mon to Sat, 8 am to 8 pm",
  },
  nav: {
    explore: "Travel",
    lines: "Lines and times",
    tickets: "Fares and passes",
    news: "News",
    contact: "Contact",
  },
  header: {
    recharge: "Top up",
    search: "Search a station",
    account: "My account",
  },
  account: {
    title: "My account",
    subtitle: "Your details and cases.",
    email: "Email",
    phone: "Phone",
    tickets: "My cases",
    empty: "No cases yet. File a complaint from the chat.",
    logout: "Sign out",
    subscription: "My subscription",
    noSubscription: "No active subscription on this account.",
    ends: "Ends",
    daysLeft: "Days left",
    status: {
      pending: "Pending",
      in_progress: "In progress",
      resolved: "Resolved",
      rejected: "Rejected",
    },
    responses: "Published replies",
  },
  hero: {
    kicker: "The network at a glance",
    title: "Getting around Casablanca has never been easier.",
    sub: "Schedules, routes, passes and complaints. The CasaMove assistant answers right here, in French, Arabic and English.",
    from: "From",
    to: "To",
    fromValue: "Casa Port",
    toValue: "Sidi Mohamed Ben Abdellah",
    cta: "Search",
    mapTitle: "Network map",
    legend1: "Line 1",
    legend2: "Line 2",
    legend3: "Busway",
    stats: "151 stations · a tram every 8 minutes",
  },
  tiles: {
    lines: {
      title: "Lines and times",
      desc: "All four lines, station by station",
    },
    map: { title: "Network map", desc: "151 stations, one ticket" },
    shops: { title: "Ticket points", desc: "Top up near you" },
    contact: { title: "Contact us", desc: "Complaint, tracking, support" },
  },
  news: {
    heading: "News",
    all: "See all",
    read: "Read",
    items: [
      {
        tag: "Network",
        title: "Winter service schedule",
        excerpt: "Tram and busway, from 1 November to 31 March.",
        date: "12/11/2026",
      },
      {
        tag: "Disruption",
        title: "Works on line 1",
        excerpt: "Service suspended between two stations, Saturday morning.",
        date: "08/11/2026",
      },
      {
        tag: "Event",
        title: "Casablanca Marathon",
        excerpt: "Adjusted service on 25 November, from 6 am.",
        date: "30/10/2026",
      },
    ],
  },
  app: {
    kicker: "Mobile app",
    title: "All of Casa in your pocket.",
    sub: "Schedules, traffic alerts and the online store, on iOS and Android.",
    features: ["Trip planning", "Real-time schedules", "Traffic alerts"],
    apple: "App Store",
    google: "Google Play",
  },
  newsletter: {
    title: "Join our community",
    sub: "Get traffic alerts and network news.",
    placeholder: "Your email",
    button: "Subscribe",
    consent: "By subscribing, you accept our privacy policy.",
    success: "Thank you, your subscription is registered.",
  },
  footer: {
    contactTitle: "A question?",
    phoneLabel: "By phone",
    hours: "Monday to Saturday, 8 am to 8 pm",
    emailLabel: "By email",
    linksTitle: "Information",
    links: ["Terms of use", "Privacy policy", "Accessibility"],
    rights: "© 2026 CasaMove. Demo.",
  },
  chat: {
    open: "Open the assistant",
    close: "Close the assistant",
    launcher: "A question?",
    title: "CasaMove assistant",
    status: "Online · answers in 3 languages",
    greeting:
      "Hello, I am the CasaMove assistant. Schedules, routes, passes or a complaint?",
    placeholder: "Write your message…",
    send: "Send",
    source: "Winter schedule 2026",
    foot: "Demo · powered by LangGraph",
    error: "Connection lost. Please try again.",
    caseLabel: "Case",
    complaintPrompt:
      "Describe the issue, the line and the date. I will open the case as soon as I have them.",
    approved:
      "Your case {number} has been approved. The reply was sent in this conversation.",
    rejected: "Your case {number} was escalated to the supervisor.",
    alertLabel: "Proactive alert",
    dismissAlert: "Dismiss",
    feedbackLabel: "Your feedback",
    feedbackTitle: "Your case is closed.",
    feedbackQuestion: "How satisfied are you?",
    feedbackThanks: "Thank you for your feedback.",
    agentNotification: "New message from the agent",
    quick: {
      itinerary: "Schedules",
      fares: "Student fare",
      complaint: "Complaint",
    },
    answers: {
      itinerary:
        "The network runs from 5:30 am to 10:30 pm. At peak times, expect a tram every 5 to 7 minutes.",
      fares:
        "The fare grid and student pass are detailed on the Fares page. I can take you there.",
      complaint:
        "I can open a case. Describe the issue, the line and the date, and I will give you a tracking number.",
      fallback:
        "I do not have that information yet. I can pass it to an agent or open a complaint.",
    },
  },
  a11y: { menu: "Menu", language: "Language" },
};

export const dictionary: Record<Locale, Dict> = { fr, ar, en };

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
