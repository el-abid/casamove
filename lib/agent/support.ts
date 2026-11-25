import type { Locale } from "@/content/dictionary";
import { chatJSON, llmEnabled } from "./llm";
import { formatDeadline, getTicket, listTicketsByUser } from "./tickets";
import { listSignals } from "./signals";
import { describeSubscription, getSubscription } from "./subscriptions";
import type { Ticket, TicketStatus } from "./types";

export type SupportTool =
  | "ticket_status"
  | "my_tickets"
  | "line_status"
  | "subscription_status"
  | "none";

export type SupportPlan = {
  tool: SupportTool;
  args: { number?: string; line?: string };
};

export type SupportOutcome = {
  data: unknown;
  fallback: string;
  ticket?: Ticket | null;
  needsLogin?: boolean;
};

const STATUS_LABEL: Record<Locale, Record<TicketStatus, string>> = {
  fr: {
    pending: "en attente",
    in_progress: "en cours",
    resolved: "clôturé",
    rejected: "rejeté",
  },
  ar: {
    pending: "قيد الانتظار",
    in_progress: "قيد المعالجة",
    resolved: "مغلق",
    rejected: "مرفوض",
  },
  en: {
    pending: "pending",
    in_progress: "in progress",
    resolved: "resolved",
    rejected: "rejected",
  },
};

const TEXTS = {
  needLogin: {
    fr: "Connectez-vous pour consulter vos dossiers. Le bouton Mon compte est en haut du site.",
    ar: "سجّل الدخول للاطلاع على ملفاتك. زر حسابي في أعلى الموقع.",
    en: "Sign in to view your cases. The My account button is at the top of the site.",
  },
  noTicket: {
    fr: "Je ne trouve pas ce dossier. Vérifiez le numéro, il commence par CM-2026-.",
    ar: "لم أجد هذا الملف. تحقق من الرقم، يبدأ بـ CM-2026-.",
    en: "I cannot find that case. Check the number, it starts with CM-2026-.",
  },
  noTickets: {
    fr: "Vous n'avez aucun dossier pour le moment.",
    ar: "ليس لديك أي ملف حالياً.",
    en: "You have no cases yet.",
  },
  needLoginSubscription: {
    fr: "Connectez-vous pour consulter votre abonnement. Le bouton Mon compte est en haut du site.",
    ar: "سجّل الدخول للاطلاع على اشتراكك. زر حسابي في أعلى الموقع.",
    en: "Sign in to view your subscription. The My account button is at the top of the site.",
  },
  noSubscription: {
    fr: "Aucun abonnement actif sur ce compte. Les tarifs sont de 60 DH par semaine, 150 DH par mois pour l'étudiant et 230 DH par mois.",
    ar: "لا يوجد اشتراك نشط في هذا الحساب. الأثمنة: 60 درهماً أسبوعياً، 150 درهماً شهرياً للطلبة، و230 درهماً شهرياً.",
    en: "No active subscription on this account. Fares are 60 MAD per week, 150 MAD per month for students and 230 MAD per month.",
  },
  none: {
    fr: "Je peux consulter un dossier, lister vos dossiers ou vérifier une perturbation de ligne. Précisez votre demande.",
    ar: "أستطيع الاطلاع على ملف، أو عرض ملفاتك، أو التحقق من اضطراب على خط. حدّد طلبك.",
    en: "I can look up a case, list your cases or check a line disruption. Please specify.",
  },
} as const;

function noDisruption(locale: Locale, line: string): string {
  if (locale === "ar") return `لا يوجد اضطراب نشط على ${line}.`;
  if (locale === "en") return `No active disruption is reported on ${line}.`;
  return `Aucune perturbation active n'est signalée sur ${line}.`;
}

function detectLine(query: string): string {
  const match = query.match(/(?:ligne|line|الخط)\s*(bw\s*[12]|t?\s*[1-4])/i);
  if (!match) return "ligne 1";
  const raw = match[1].replace(/\s+/g, "").toUpperCase();
  if (raw.startsWith("BW")) return `ligne ${raw}`;
  return `ligne ${raw.replace(/^T/, "")}`;
}

function formatDate(iso: string, locale: Locale): string {
  const tag = locale === "ar" ? "ar-MA" : locale === "en" ? "en-GB" : "fr-FR";
  return new Intl.DateTimeFormat(tag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Casablanca",
  }).format(new Date(iso));
}

function isSubscriptionQuestion(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /(mon abonnement|abonnement actif|mon pass|my subscription|my pass|اشتراكي)/.test(
      q
    ) ||
    (/(renouvel|expire|expiring|renew|تجديد|ينتهي)/.test(q) &&
      /(abonnement|اشتراك|pass|subscription)/.test(q))
  );
}

export async function planSupport(
  query: string,
  hasUser: boolean
): Promise<SupportPlan> {
  const number = query.toUpperCase().match(/CM-\d{4}-\d{6}/)?.[0];

  const rules: SupportPlan = number
    ? { tool: "ticket_status", args: { number } }
    : isSubscriptionQuestion(query)
      ? { tool: "subscription_status", args: {} }
      : /(mes dossiers|mon dossier|my cases|my tickets|ملفاتي|ملفي|حالة الملف|statut|status|suivi|suivre|où en est|ou en est|avancement|ma réclamation)/i.test(
            query
          )
        ? { tool: "my_tickets", args: {} }
        : /(perturb|trafic|disruption|traffic|اضطراب)/i.test(query)
          ? { tool: "line_status", args: { line: detectLine(query) } }
          : { tool: "none", args: {} };

  if (!llmEnabled()) return rules;

  const result = await chatJSON<{
    tool?: string;
    args?: { number?: string; line?: string };
  }>(
    [
      {
        role: "system",
        content: `Tu es l'agent Support d'un service client de transport à Casablanca.
Choisis un outil pour répondre à la demande.
Outils disponibles :
- ticket_status : statut d'un dossier précis. args {"number":"CM-2026-000123"}
- my_tickets : dossiers de l'usager connecté. args {}
- line_status : perturbation active sur une ligne. args {"line":"ligne 1"}
- subscription_status : abonnement de l'usager connecté. args {}
- none : aucune action possible
Réponds uniquement par un JSON valide, sans texte autour :
{"tool":"ticket_status|my_tickets|line_status|subscription_status|none","args":{}}
${hasUser ? "L'usager est connecté." : "L'usager n'est pas connecté."}`,
      },
      { role: "user", content: query },
    ],
    { maxTokens: 120, temperature: 0.1, timeoutMs: 8_000 }
  );

  const tool = result?.tool;
  if (
    tool !== "ticket_status" &&
    tool !== "my_tickets" &&
    tool !== "line_status" &&
    tool !== "subscription_status" &&
    tool !== "none"
  ) {
    return rules;
  }

  if (tool === "none" && rules.tool !== "none") {
    return rules;
  }

  if (tool === "subscription_status") {
    return { tool, args: {} };
  }

  if (tool === "ticket_status") {
    const value =
      result?.args?.number?.toUpperCase().match(/CM-\d{4}-\d{6}/)?.[0] ??
      number;
    if (!value) return rules;
    return { tool, args: { number: value } };
  }

  if (tool === "line_status") {
    return {
      tool,
      args: { line: result?.args?.line || detectLine(query) },
    };
  }

  return { tool, args: {} };
}

export async function executeSupport(
  plan: SupportPlan,
  userId: number | null,
  locale: Locale
): Promise<SupportOutcome> {
  if (plan.tool === "ticket_status" && plan.args.number) {
    const ticket = await getTicket(plan.args.number);
    if (!ticket || (ticket.userId !== null && ticket.userId !== userId)) {
      return {
        data: { found: false, number: plan.args.number },
        fallback: TEXTS.noTicket[locale],
      };
    }

    const deadline = formatDeadline(ticket.slaDeadline, locale);
    const response =
      ticket.status === "in_progress" || ticket.status === "resolved"
        ? ticket.draft
        : null;
    const summary =
      locale === "ar"
        ? `الملف ${ticket.number}: ${STATUS_LABEL[locale][ticket.status]}، الأولوية ${ticket.priority}، الأجل ${deadline}.`
        : locale === "en"
          ? `Case ${ticket.number}: ${STATUS_LABEL[locale][ticket.status]}, priority ${ticket.priority}, deadline ${deadline}.`
          : `Dossier ${ticket.number} : ${STATUS_LABEL[locale][ticket.status]}, priorité ${ticket.priority}, échéance ${deadline}.`;

    const published =
      response === null
        ? ""
        : locale === "ar"
          ? ` الرد المنشور: ${response}`
          : locale === "en"
            ? ` Published reply: ${response}`
            : ` Réponse publiée : ${response}`;

    return {
      data: {
        found: true,
        number: ticket.number,
        status: STATUS_LABEL[locale][ticket.status],
        priority: ticket.priority,
        theme: ticket.theme,
        deadline,
        response,
      },
      fallback: `${summary}${published}`,
      ticket,
    };
  }

  if (plan.tool === "subscription_status") {
    if (!userId) {
      return {
        data: { needsLogin: true },
        fallback: TEXTS.needLoginSubscription[locale],
        needsLogin: true,
      };
    }

    const subscription = await getSubscription(userId);
    if (!subscription) {
      return {
        data: { subscription: null },
        fallback: TEXTS.noSubscription[locale],
      };
    }

    const info = describeSubscription(subscription, locale);
    const endsAt = formatDate(info.endsAt, locale);

    return {
      data: {
        plan: info.planLabel,
        status: info.statusLabel,
        endsAt,
        daysLeft: info.daysLeft,
        renewalPrice: info.price,
        autoRenew: subscription.autoRenew,
      },
      fallback:
        locale === "ar"
          ? `الاشتراك ${info.planLabel} ${info.statusLabel}، ينتهي في ${endsAt}، ${info.daysLeft} يوم متبقٍ. التجديد ${info.price} درهم.`
          : locale === "en"
            ? `${info.planLabel} pass ${info.statusLabel}, ends on ${endsAt}, ${info.daysLeft} day(s) left. Renewal ${info.price} MAD.`
            : `Abonnement ${info.planLabel} ${info.statusLabel}, fin le ${endsAt}, ${info.daysLeft} jour(s) restant(s). Renouvellement ${info.price} DH.`,
    };
  }

  if (plan.tool === "my_tickets") {
    if (!userId) {
      return {
        data: { needsLogin: true },
        fallback: TEXTS.needLogin[locale],
        needsLogin: true,
      };
    }

    const tickets = (await listTicketsByUser(userId)).slice(0, 5);
    if (tickets.length === 0) {
      return { data: { count: 0 }, fallback: TEXTS.noTickets[locale] };
    }

    const data = tickets.map((ticket) => ({
      number: ticket.number,
      status: STATUS_LABEL[locale][ticket.status],
      priority: ticket.priority,
    }));

    return {
      data: { count: tickets.length, tickets: data },
      fallback:
        locale === "ar"
          ? `لديك ${tickets.length} ملف: ` +
            data.map((item) => `${item.number} (${item.status})`).join("، ")
          : locale === "en"
            ? `You have ${tickets.length} case(s): ` +
              data.map((item) => `${item.number} (${item.status})`).join(", ")
            : `Vous avez ${tickets.length} dossier(s) : ` +
              data.map((item) => `${item.number} (${item.status})`).join(", "),
    };
  }

  if (plan.tool === "line_status") {
    const line = plan.args.line ?? "ligne 1";
    const signals = await listSignals();
    const disruption = signals.find(
      (signal) =>
        signal.kind === "disruption" &&
        (!signal.line ||
          signal.line.toLowerCase().includes(line.replace("ligne ", "")))
    );

    if (!disruption) {
      return {
        data: { line, disruption: null },
        fallback: noDisruption(locale, line),
      };
    }

    const payload = disruption.payload[locale] ?? disruption.payload.fr;
    return {
      data: { line, disruption: payload },
      fallback: `${payload.title}. ${payload.body}`,
    };
  }

  return { data: { tool: "none" }, fallback: TEXTS.none[locale] };
}
