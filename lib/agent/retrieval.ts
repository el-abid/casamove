import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { Locale } from "@/content/dictionary";
import { chatJSON } from "./llm";
import {
  cosineSimilarity,
  embedQuery,
  EMBED_DIMS,
  EMBED_MODEL,
  embeddingsEnabled,
} from "./embeddings";
import { corpus, lexicalRanking, normalize, type KnowledgeDoc } from "./corpus";

type EmbeddingFile = {
  model: string;
  dimensions: number;
  corpusHash: string;
  vectors: Record<string, number[]>;
};

export type RetrievalHit = {
  doc: KnowledgeDoc;
  lexicalScore: number;
  denseScore: number;
  score: number;
};

export type RetrievalResult = {
  hits: RetrievalHit[];
  confident: boolean;
  mode: "lexical" | "hybrid" | "dense";
  needsReview: boolean;
};

export type DocumentRouting =
  | { status: "selected"; docs: KnowledgeDoc[] }
  | { status: "none" }
  | { status: "failed" };

const routingCache = new Map<string, DocumentRouting>();
const ROUTING_CACHE_LIMIT = 100;

function rememberRouting(
  key: string,
  routing: DocumentRouting
): DocumentRouting {
  if (routing.status === "failed") return routing;

  if (routingCache.size >= ROUTING_CACHE_LIMIT) {
    const oldest = routingCache.keys().next().value;
    if (oldest) routingCache.delete(oldest);
  }
  routingCache.set(key, routing);
  return routing;
}

let embeddingFile: EmbeddingFile | null | undefined;

function loadEmbeddingFile(): EmbeddingFile | null {
  if (embeddingFile !== undefined) return embeddingFile;

  try {
    const file = path.join(process.cwd(), "lib", "agent", "embeddings.json");
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as EmbeddingFile;

    if (parsed.model !== EMBED_MODEL || parsed.dimensions !== EMBED_DIMS) {
      console.warn(
        "[retrieval] embeddings ignorés: modèle ou dimensions différents"
      );
      embeddingFile = null;
      return null;
    }

    const hash = createHash("sha256")
      .update(JSON.stringify(corpus))
      .digest("hex");

    if (parsed.corpusHash !== hash) {
      console.warn(
        "[retrieval] embeddings obsolètes, relancer embeddings:build"
      );
      embeddingFile = null;
      return null;
    }

    embeddingFile = parsed;
    return parsed;
  } catch {
    console.warn("[retrieval] embeddings.json absent, repli lexical");
    embeddingFile = null;
    return null;
  }
}

export function embeddingsStatus() {
  const file = loadEmbeddingFile();

  return {
    enabled: embeddingsEnabled(),
    configured: Boolean(process.env.NVIDIA_API_KEY),
    model: EMBED_MODEL,
    dimensions: EMBED_DIMS,
    loaded: Boolean(file),
    vectors: file ? Object.keys(file.vectors).length : 0,
  };
}

export function denseRanking(
  queryVector: number[],
  locale: Locale
): { doc: KnowledgeDoc; score: number }[] {
  const file = loadEmbeddingFile();
  if (!file) return [];

  const hits: { doc: KnowledgeDoc; score: number }[] = [];

  for (const doc of corpus) {
    const vector = file.vectors[`${doc.id}:${locale}`];
    if (!vector) continue;
    hits.push({ doc, score: cosineSimilarity(queryVector, vector) });
  }

  return hits.sort((a, b) => b.score - a.score);
}

const LEXICAL_WEIGHT = 0.65;
const DENSE_WEIGHT = 0.35;
const DENSE_AGREEMENT = 0.24;

export async function retrieveHybrid(
  query: string,
  locale: Locale,
  options: { limit?: number; queryVector?: number[] } = {}
): Promise<RetrievalResult> {
  const limit = options.limit ?? 3;
  const lexical = lexicalRanking(query, locale);

  let queryVector = options.queryVector;
  if (!queryVector && embeddingsEnabled()) {
    queryVector = (await embedQuery(query)) ?? undefined;
  }

  const dense = queryVector ? denseRanking(queryVector, locale) : [];
  const denseById = new Map(dense.map((hit) => [hit.doc.id, hit.score]));
  const lexicalById = new Map(lexical.map((hit) => [hit.doc.id, hit.score]));

  const candidateIds = new Set<string>();
  lexical.slice(0, 8).forEach((hit) => candidateIds.add(hit.doc.id));
  dense.slice(0, 3).forEach((hit) => candidateIds.add(hit.doc.id));
  if (lexical.length === 0) {
    dense.slice(0, 8).forEach((hit) => candidateIds.add(hit.doc.id));
  }

  const byId = new Map(corpus.map((doc) => [doc.id, doc]));
  const hits: RetrievalHit[] = [];

  for (const id of candidateIds) {
    const doc = byId.get(id);
    if (!doc) continue;

    const lexicalScore = lexicalById.get(id) ?? 0;
    const denseScore = denseById.get(id) ?? 0;
    const lexicalPart = Math.min(1, lexicalScore / 6) * LEXICAL_WEIGHT;
    const densePart = denseScore * DENSE_WEIGHT;

    hits.push({
      doc,
      lexicalScore,
      denseScore,
      score: lexicalPart + densePart,
    });
  }

  hits.sort((a, b) => b.score - a.score);

  const lexicalTop = lexical[0];
  const denseTop = dense[0];
  const lexicalConfident = (lexicalTop?.score ?? 0) >= 3;
  const denseAgrees =
    Boolean(lexicalTop && denseTop) &&
    lexicalTop.doc.id === denseTop.doc.id &&
    denseTop.score >= DENSE_AGREEMENT;
  const nearLexical = (lexicalTop?.score ?? 0) >= 2;
  const confident = lexicalConfident || (nearLexical && denseAgrees);

  const mode: RetrievalResult["mode"] =
    dense.length > 0 && lexical.length > 0
      ? "hybrid"
      : dense.length > 0
        ? "dense"
        : "lexical";

  return {
    hits: hits.slice(0, limit),
    confident,
    mode,
    needsReview: !confident && hits.length > 0,
  };
}

function buildCatalog(locale: Locale): string {
  return corpus
    .map((doc) => {
      const keywords = Array.from(new Set(doc.keywords))
        .slice(0, 14)
        .join(", ");
      return `- id=${doc.id} | ${doc.title[locale]} | mots-clés: ${keywords}\n  ${doc.body[locale]}`;
    })
    .join("\n");
}

function normalizeEvidence(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function routeDocuments(
  query: string,
  locale: Locale
): Promise<DocumentRouting> {
  const cacheKey = `${locale}:${normalize(query)}`;
  const cached = routingCache.get(cacheKey);
  if (cached) return cached;

  const result = await chatJSON<{
    answerable?: boolean;
    docIds?: string[];
    evidence?: Record<string, string>;
    reason?: string;
  }>(
    [
      {
        role: "system",
        content: `Tu es le routeur documentaire du service client CasaMove.
On te donne une question et la liste complète des 17 fiches du corpus.
Sélectionne uniquement les fiches qui contiennent explicitement la réponse.
Ne sélectionne pas une fiche sur le même thème si elle ne répond pas.
La phrase citée doit répondre à la question, pas seulement contenir un mot de la question.
Pour chaque fiche sélectionnée, copie la phrase exacte du corps qui répond. Si tu ne peux pas citer une phrase qui répond, ne sélectionne pas la fiche.
Si la question est hors sujet (météo, politique, culture, autre réseau) ou si aucune fiche ne répond, answerable vaut false.
Un qualificatif temporel comme "aujourd'hui", "actuel" ou "en vigueur" ne rend pas une fiche non pertinente si elle présente les tarifs ou horaires en cours.
Exemple : "Où est l'agence la plus proche ?" relève de la fiche agencies, pas de lost-payment.
Exemple : "Quels sont les moyens de paiement ?" ne relève pas de lost-payment, qui traite un paiement débité, et n'a pas de réponse : answerable vaut false.
Réponds uniquement par un JSON valide :
{"answerable":true|false,"docIds":["id1"],"evidence":{"id1":"phrase exacte"},"reason":"..."}
Maximum 3 fiches.`,
      },
      {
        role: "user",
        content: `Question : ${query}\n\nFiches :\n${buildCatalog(locale)}`,
      },
    ],
    { maxTokens: 320, temperature: 0, timeoutMs: 8_000 }
  );

  if (!result) return { status: "failed" };
  if (result.answerable === false) {
    return rememberRouting(cacheKey, { status: "none" });
  }

  const ids = Array.isArray(result.docIds)
    ? result.docIds.filter((id) => corpus.some((doc) => doc.id === id))
    : [];

  if (ids.length === 0) {
    return rememberRouting(cacheKey, { status: "none" });
  }

  const evidence = result.evidence ?? {};
  const docs = ids
    .slice(0, 3)
    .map((id) => corpus.find((doc) => doc.id === id))
    .filter((doc): doc is KnowledgeDoc => Boolean(doc))
    .filter((doc) => {
      const quote = evidence[doc.id];
      if (typeof quote !== "string" || quote.trim().length < 8) return false;
      return normalizeEvidence(doc.body[locale]).includes(
        normalizeEvidence(quote)
      );
    });

  return rememberRouting(
    cacheKey,
    docs.length > 0 ? { status: "selected", docs } : { status: "none" }
  );
}
