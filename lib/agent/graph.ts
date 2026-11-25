import {
  Annotation,
  END,
  START,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

import type { Locale } from "@/content/dictionary";
import { connectionString } from "@/lib/db";
import { chatCompletion, chatJSON, llmEnabled } from "./llm";
import { executeSupport, planSupport } from "./support";
import { normalize, type KnowledgeDoc } from "./corpus";
import { retrieveHybrid, routeDocuments } from "./retrieval";
import {
  createTicket,
  formatDeadline,
  setTicketDraft,
  setTicketStatus,
} from "./tickets";
import type {
  HitlDecision,
  HitlPayload,
  Intent,
  Priority,
  Source,
  Ticket,
  TicketSentiment,
} from "./types";
import {
  CLASSIFICATION_RULES,
  lexicalClassification,
  normalizeClassification,
} from "./classification";

const AgentState = Annotation.Root({
  query: Annotation<string>(),
  locale: Annotation<Locale>(),
  sessionId: Annotation<string>(),
  userId: Annotation<number | null>({
    reducer: (_current, next) => next,
    default: () => null,
  }),
  intentHint: Annotation<"complaint" | null>({
    reducer: (_current, next) => next,
    default: () => null,
  }),
  intent: Annotation<Intent>(),
  confidence: Annotation<number>(),
  theme: Annotation<string>({
    reducer: (_current, next) => next,
    default: () => "information",
  }),
  priority: Annotation<Priority>({
    reducer: (_current, next) => next,
    default: () => "P3",
  }),
  sentiment: Annotation<TicketSentiment>({
    reducer: (_current, next) => next,
    default: () => "neutral",
  }),
  reply: Annotation<string>(),
  sources: Annotation<Source[]>({
    reducer: (_current, next) => next,
    default: () => [],
  }),
  ticket: Annotation<Ticket | null>({
    reducer: (_current, next) => next,
    default: () => null,
  }),
  decision: Annotation<HitlDecision | null>({
    reducer: (_current, next) => next,
    default: () => null,
  }),
});

type AgentStateType = typeof AgentState.State;

const texts = {
  fallback: {
    fr: "Je n'ai pas cette information dans ma base. Je peux ouvrir une réclamation ou transmettre à un agent.",
    ar: "لا أملك هذه المعلومة في قاعدتي. أستطيع فتح شكاية أو تحويلك إلى موظف.",
    en: "I do not have that information in my knowledge base. I can open a complaint or pass it to an agent.",
  },
  greeting: {
    fr: "Bonjour. Je peux vous aider sur les horaires, les tarifs, les correspondances, ou ouvrir une réclamation.",
    ar: "مرحباً. يمكنني مساعدتك في المواعيد والأثمنة والتحويلات، أو فتح شكاية.",
    en: "Hello. I can help with schedules, fares, transfers, or open a complaint.",
  },
  intake: {
    fr: "Décrivez le problème, la ligne et la date. Je crée le dossier dès que j'ai ces éléments.",
    ar: "صف المشكلة والخط والتاريخ. سأفتح الملف بمجرد توفر هذه العناصر.",
    en: "Describe the issue, the line and the date. I will open the case as soon as I have them.",
  },
  draft: {
    fr: (query: string, number: string) =>
      `Bonjour, nous avons bien reçu votre signalement concernant « ${query} ». Nos équipes l'examinent et reviennent vers vous avant l'échéance indiquée. Dossier ${number}.`,
    ar: (query: string, number: string) =>
      `مرحباً، تلقّينا إشعارك بخصوص « ${query} ». فرقنا تدرسه وستعود إليك قبل الأجل المحدد. الملف ${number}.`,
    en: (query: string, number: string) =>
      `Hello, we have received your report about "${query}". Our teams are reviewing it and will get back to you before the stated deadline. Case ${number}.`,
  },
  ack: {
    fr: (number: string, priority: string, deadline: string) =>
      `Votre réclamation est enregistrée sous le numéro ${number}. Priorité ${priority}, réponse attendue avant le ${deadline}. Un agent valide le brouillon avant publication.`,
    ar: (number: string, priority: string, deadline: string) =>
      `تم تسجيل شكايتك تحت الرقم ${number}. الأولوية ${priority}، والرد متوقع قبل ${deadline}. يتحقق موظف من المسودة قبل النشر.`,
    en: (number: string, priority: string, deadline: string) =>
      `Your complaint is registered under ${number}. Priority ${priority}, response expected before ${deadline}. An agent validates the draft before publication.`,
  },
  approved: {
    fr: (number: string) =>
      `Le dossier ${number} est en cours. La réponse est publiée dans votre dossier.`,
    ar: (number: string) =>
      `الملف ${number} قيد المعالجة. تم نشر الرد في ملفك.`,
    en: (number: string) =>
      `Case ${number} is in progress. The reply is published in your case.`,
  },
  rejected: {
    fr: (number: string) =>
      `Le dossier ${number} a été escaladé au superviseur.`,
    ar: (number: string) => `تم رفع الملف ${number} إلى المشرف.`,
    en: (number: string) => `Case ${number} was escalated to the supervisor.`,
  },
  pending: {
    fr: (number: string) =>
      `Votre dossier ${number} est en attente de validation par un agent. Vous recevrez la réponse dès qu'elle est approuvée.`,
    ar: (number: string) =>
      `ملفك ${number} في انتظار مصادقة موظف. ستتوصل بالرد بعد الموافقة عليه.`,
    en: (number: string) =>
      `Your case ${number} is waiting for an agent's approval. You will receive the reply once it is approved.`,
  },
} as const;

function classify(query: string): { intent: Intent; confidence: number } {
  const q = normalize(query);

  const short = q.split(" ").length <= 6;
  const smallTalk =
    /(bonjour|bonsoir|salut|hello|hi|hey|merci|au revoir|bye|qui es-tu|tu es qui|t'es qui|que peux-tu|comment vas-tu|مرحبا|أهلا|شكرا|من أنت)/.test(
      q
    );
  const status =
    /(cm-\d{4}-\d{6}|statut|mon dossier|mes dossiers|my case|my cases|my tickets|ملفي|ملفاتي|حالة الملف|où en est|ou en est|avancement|suivi)/.test(
      q
    );
  const howTo =
    /(comment|how).*(reclam|réclam|شكا)/.test(q) ||
    /(je veux|i want|أريد).*(déposer|deposer|poser|faire|file|submit).*(réclamation|reclamation|شكاية)/.test(
      q
    );
  const subscription =
    /(mon abonnement|abonnement actif|mon pass|my subscription|my pass|اشتراكي)/.test(
      q
    ) ||
    (/(renouvel|expire|expiring|renew|تجديد|ينتهي)/.test(q) &&
      /(abonnement|اشتراك|pass|subscription)/.test(q));
  const complaint =
    /(reclam|plainte|signaler|retard|agress|incident|panne|rembours|refund|شكا|تأخر|اعتداء|عطل|استرجاع|complaint|report|delay|broken)/.test(
      q
    );
  const traffic = /(perturb|disruption|trafic|traffic|اضطراب)/.test(q);
  const info =
    /(horaire|tarif|prix|abonnement|etudiant|ligne|tram|bus|itineraire|acces|ascenseur|مواعيد|ثمن|اشتراك|طالب|خط|ترام|مسار|schedule|fare|price|pass|line|route|access)/.test(
      q
    );

  if (smallTalk && short) return { intent: "conversation", confidence: 0.9 };
  if (howTo) return { intent: "info", confidence: 0.85 };
  if (status) return { intent: "support", confidence: 0.9 };
  if (subscription) return { intent: "support", confidence: 0.9 };
  if (complaint) return { intent: "complaint", confidence: 0.9 };
  if (traffic) return { intent: "support", confidence: 0.85 };
  if (info) return { intent: "info", confidence: 0.85 };
  return { intent: "unknown", confidence: 0.4 };
}

async function supervisor(state: AgentStateType) {
  const rules = classify(state.query);
  const lexical = lexicalClassification(state.query);
  const reset = {
    reply: "",
    sources: [] as Source[],
    ticket: null,
    decision: null,
  };

  if (state.intentHint === "complaint") {
    return {
      intent: "complaint" as const,
      confidence: 1,
      ...lexical,
      ...reset,
    };
  }

  if (!llmEnabled()) {
    return { ...rules, ...lexical, ...reset };
  }

  const result = await chatJSON<{
    intent?: string;
    confidence?: number;
    theme?: string;
    priority?: string;
    sentiment?: string;
  }>(
    [
      {
        role: "system",
        content: `Tu es le superviseur d'un service client de transport à Casablanca.
Classe le message dans une intention : information, reclamation, support, conversation ou inconnu.
Une réclamation décrit un problème vécu et imputable au réseau : retard, agression, insulte, propreté, remboursement, panne.
Une information couvre les horaires, tarifs, trajets, correspondances, agences, accessibilité, objets perdus, procédures et documents à fournir. Une demande du type "comment faire" est une information.
Une demande support est transactionnelle : statut d'un dossier avec un numéro CM-..., liste de mes dossiers, perturbation active sur une ligne.
Une conversation couvre les salutations, l'identité de l'assistant, ses capacités, les remerciements et le small talk.
Exemples : "Bonjour" = conversation. "Tu es qui ?" = conversation. "Que peux-tu faire ?" = conversation. "J'ai perdu mon objet" = information. "Comment déposer une réclamation ?" = information. "Le tram avait 20 minutes de retard" = reclamation. "Où est mon dossier CM-2026-000157 ?" = support. "La ligne 1 est-elle perturbée ?" = support.

${CLASSIFICATION_RULES}

Réponds uniquement par un JSON valide, sans texte autour :
{"intent":"information|reclamation|support|conversation|inconnu","confidence":0.0,"theme":"ponctualité|information|propreté|sécurité|accessibilité|abonnement","priority":"P1|P2|P3","sentiment":"negative|neutral|positive"}`,
      },
      { role: "user", content: state.query },
    ],
    { maxTokens: 180, temperature: 0.1, timeoutMs: 8_000 }
  );

  const intent =
    result?.intent === "reclamation"
      ? "complaint"
      : result?.intent === "information"
        ? "info"
        : result?.intent === "support"
          ? "support"
          : result?.intent === "conversation"
            ? "conversation"
            : null;

  if (!intent) {
    return { ...rules, ...lexical, ...reset };
  }

  const procedural =
    /(objet perdu|perdu (mon|ma|mes)|carte perdue|مفقود|ضياع|lost (my|item|property)|comment (déposer|faire|créer)|كيف)/i.test(
      state.query
    );

  if (procedural && intent === "complaint") {
    return { ...rules, intent: "info", ...lexical, ...reset };
  }

  const raw = Number(result?.confidence);
  const confidence = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.9;

  const classification = normalizeClassification(result ?? {}, state.query);

  return { intent, confidence, ...classification, ...reset };
}

async function answerFromDocs(state: AgentStateType, docs: KnowledgeDoc[]) {
  const context = docs
    .map(
      (doc, index) =>
        `Document ${index + 1} : ${doc.title[state.locale]}\n${doc.body[state.locale]}`
    )
    .join("\n\n");

  let reply = docs[0].body[state.locale];

  if (llmEnabled()) {
    const generated = await chatCompletion(
      [
        {
          role: "system",
          content: `Tu es l'agent Knowledge d'un service client de transport à Casablanca.
Réponds uniquement à partir des documents fournis, en trois phrases maximum, dans la langue de la question.
Si la question demande une liste, tous les tarifs, tous les horaires ou toutes les lignes, reprends tous les éléments présents dans le document.
N'utilise que les faits explicitement présents dans les documents.
Si aucun document ne contient la réponse, réponds exactement : "Je n'ai pas cette information dans ma base."
Ne cite pas la source, elle est affichée séparément.`,
        },
        {
          role: "user",
          content: `Question : ${state.query}\n\n${context}`,
        },
      ],
      { maxTokens: 320, temperature: 0.1, timeoutMs: 12_000 }
    );

    if (generated && generated.length >= 10 && generated.length <= 1_000) {
      reply = generated;
    }
  }

  const noAnswer =
    /Je n'ai pas cette information|Je ne dispose pas de cette information|ne mentionne pas|ne liste pas|ne précise pas|ne donne pas|does not (mention|list|specify)|I (do not|don't) have (that|this) information|لا أملك هذه المعلومة/i.test(
      reply
    );

  return {
    reply,
    sources: noAnswer
      ? []
      : docs.map((doc) => ({
          id: doc.id,
          title: doc.title[state.locale],
          source: doc.source[state.locale],
        })),
  };
}

function isYesNoQuestion(query: string): boolean {
  const q = normalize(query);
  return (
    /(^| )(est ce que|est-ce que|puis je|peut on|dois je|doit on|faut il|y a t il|is it|can i|do i|are there)/.test(
      q
    ) || /(valable|autoris|obligatoire|gratuit|possible|interdit)/.test(q)
  );
}

async function knowledge(state: AgentStateType) {
  if (llmEnabled()) {
    const routing = await routeDocuments(state.query, state.locale);

    if (routing.status === "selected") {
      return answerFromDocs(state, routing.docs);
    }

    if (routing.status === "none") {
      const retrieval = await retrieveHybrid(state.query, state.locale);
      const strongLexical = (retrieval.hits[0]?.lexicalScore ?? 0) >= 4;

      if (strongLexical && isYesNoQuestion(state.query)) {
        return answerFromDocs(state, [retrieval.hits[0].doc]);
      }

      return { reply: texts.fallback[state.locale], sources: [] };
    }
  }

  const retrieval = await retrieveHybrid(state.query, state.locale);

  if (retrieval.hits.length === 0) {
    let reply: string = texts.fallback[state.locale];

    if (llmEnabled()) {
      const generated = await chatCompletion(
        [
          {
            role: "system",
            content: `Tu es l'assistant CasaMove, service client du réseau de tramway et busway de Casablanca.
Tu n'as pas cette information dans ta base documentaire.
Réponds en deux phrases maximum, dans la langue de la question : dis-le naturellement, puis propose un agent humain ou l'ouverture d'une réclamation.
N'invente aucun fait sur le réseau, les horaires ou les tarifs.`,
          },
          { role: "user", content: state.query },
        ],
        { maxTokens: 160, temperature: 0.4, timeoutMs: 10_000 }
      );

      if (generated && generated.length >= 5 && generated.length <= 600) {
        reply = generated;
      }
    }

    return { reply, sources: [] };
  }

  if (retrieval.needsReview) {
    return { reply: texts.fallback[state.locale], sources: [] };
  }

  const primary = retrieval.hits[0];
  const contextDocs = retrieval.hits
    .filter((hit) => hit.score >= primary.score * 0.72)
    .slice(0, 3)
    .map((hit) => hit.doc);

  return answerFromDocs(state, contextDocs);
}

async function conversation(state: AgentStateType) {
  let reply: string = texts.greeting[state.locale];

  if (llmEnabled()) {
    const generated = await chatCompletion(
      [
        {
          role: "system",
          content: `Tu es l'assistant CasaMove, le service client du réseau de tramway et busway de Casablanca.
Tu réponds dans la langue de l'usager : français, arabe ou anglais.
Tu peux aider sur les horaires, les tarifs, les correspondances, les abonnements, les réclamations et le suivi de dossier.
Tu ne dois jamais inventer un fait sur le réseau. Pour une question factuelle, dis que tu peux vérifier dans le guide ou proposer une réclamation.
Tu n'es pas un humain. Réponds en deux ou trois phrases, avec un ton naturel et chaleureux.`,
        },
        { role: "user", content: state.query },
      ],
      { maxTokens: 200, temperature: 0.6, timeoutMs: 10_000 }
    );

    if (generated && generated.length >= 5 && generated.length <= 700) {
      reply = generated;
    }
  }

  return { reply, sources: [] };
}

function hasComplaintDetails(query: string): boolean {
  const q = normalize(query);
  const marks =
    /(ligne|station|arret|hier|aujourd|matin|soir|\d{1,2}\s*h|\d{1,2}\/\d{1,2}|الخط|محطة|أمس|اليوم|صباح|مساء|خط)/.test(
      q
    );
  return marks || q.split(" ").length >= 12;
}

async function complaint(state: AgentStateType) {
  if (!hasComplaintDetails(state.query)) {
    return { reply: texts.intake[state.locale], sources: [] };
  }

  const priority = state.priority;
  const theme = state.theme;
  const sentiment = state.sentiment;
  const provisionalNumber = "en cours";

  const draft = texts.draft[state.locale](state.query, provisionalNumber);

  const ticket = await createTicket({
    priority,
    theme,
    sentiment,
    locale: state.locale,
    threadId: state.sessionId,
    query: state.query,
    draft: draft.replace(provisionalNumber, "à confirmer"),
    userId: state.userId ?? null,
  });

  const deadline = formatDeadline(ticket.slaDeadline, state.locale);
  let draftText = texts.draft[state.locale](state.query, ticket.number);
  let ackText = texts.ack[state.locale](ticket.number, priority, deadline);

  if (llmEnabled()) {
    const generated = await chatJSON<{ ack?: string; draft?: string }>(
      [
        {
          role: "system",
          content: `Tu es l'agent Réclamation d'un service client de transport à Casablanca.
Réponds uniquement par un JSON valide, sans texte autour :
{"ack":"...","draft":"..."}
ack : confirmation courte dans le chat, deux phrases, dans la langue de l'usager, avec le numéro, la priorité, l'échéance et la validation humaine avant envoi.
draft : réponse proposée à l'usager, trois phrases, ton empathique, sans promesse de remboursement, avec le numéro.
Ne signe pas.`,
        },
        {
          role: "user",
          content: `Dossier : ${ticket.number}\nPriorité : ${priority}\nÉchéance : ${deadline}\nMessage de l'usager : ${state.query}`,
        },
      ],
      { maxTokens: 500, temperature: 0.3, timeoutMs: 12_000 }
    );

    const draft = generated?.draft?.trim();
    const ack = generated?.ack?.trim();

    if (draft && draft.length >= 20 && draft.length <= 1_200) {
      draftText = draft;
    }
    if (ack && ack.length >= 20 && ack.length <= 700) {
      ackText = ack;
    }
  }

  const updated = await setTicketDraft(ticket.number, draftText);
  const stored = updated ?? { ...ticket, draft: draftText };

  return { ticket: stored, reply: ackText };
}

async function hitl(state: AgentStateType) {
  const ticket = state.ticket;
  if (!ticket) {
    return {};
  }

  const decision = interrupt<HitlPayload, HitlDecision>({
    ticket,
    draft: ticket.draft,
  });

  if (decision.action === "approve") {
    await setTicketStatus(ticket.number, "in_progress");
    return {
      decision,
      reply: texts.approved[state.locale](ticket.number),
    };
  }

  await setTicketStatus(ticket.number, "rejected");
  return {
    decision,
    reply: texts.rejected[state.locale](ticket.number),
  };
}

async function support(state: AgentStateType) {
  const plan = await planSupport(state.query, Boolean(state.userId));
  const outcome = await executeSupport(
    plan,
    state.userId ?? null,
    state.locale
  );

  let reply = outcome.fallback;
  const published = Boolean(
    (outcome.data as { response?: string | null } | null)?.response
  );

  if (llmEnabled() && !outcome.needsLogin && !published) {
    const generated = await chatCompletion(
      [
        {
          role: "system",
          content: `Tu es l'agent Support d'un service client de transport à Casablanca.
Réponds en deux phrases maximum, dans la langue de la question, uniquement à partir du résultat d'outil fourni.
Ne promets rien qui n'est pas dans le résultat. Ne cite pas de source.`,
        },
        {
          role: "user",
          content: `Question : ${state.query}\nRésultat de l'outil : ${JSON.stringify(
            outcome.data
          )}`,
        },
      ],
      { maxTokens: 200, temperature: 0.2, timeoutMs: 12_000 }
    );

    if (generated && generated.length >= 5 && generated.length <= 700) {
      reply = generated;
    }
  }

  return {
    reply,
    sources: [],
    ticket: outcome.ticket ?? null,
  };
}

function route(
  state: AgentStateType
): "knowledge" | "complaint" | "support" | "conversation" {
  if (state.intent === "complaint") return "complaint";
  if (state.intent === "support") return "support";
  if (state.intent === "conversation") return "conversation";
  return "knowledge";
}

async function buildGraph() {
  const checkpointer = PostgresSaver.fromConnString(connectionString);
  await checkpointer.setup();

  return new StateGraph(AgentState)
    .addNode("supervisor", supervisor)
    .addNode("knowledge", knowledge)
    .addNode("complaint", complaint)
    .addNode("hitl", hitl)
    .addNode("support", support)
    .addNode("conversation", conversation)
    .addEdge(START, "supervisor")
    .addConditionalEdges("supervisor", route, {
      knowledge: "knowledge",
      complaint: "complaint",
      support: "support",
      conversation: "conversation",
    })
    .addEdge("knowledge", END)
    .addEdge("support", END)
    .addEdge("conversation", END)
    .addEdge("complaint", "hitl")
    .addEdge("hitl", END)
    .compile({ checkpointer });
}

type CompiledAgent = Awaited<ReturnType<typeof buildGraph>>;

const globalAgent = globalThis as unknown as {
  __casamoveGraph?: Promise<CompiledAgent>;
};

export function getGraph(): Promise<CompiledAgent> {
  if (!globalAgent.__casamoveGraph) {
    globalAgent.__casamoveGraph = buildGraph();
  }
  return globalAgent.__casamoveGraph;
}

export { texts as agentTexts };
