const BASE_URL =
  process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";

export const EMBED_MODEL =
  process.env.NVIDIA_EMBED_MODEL ?? "nvidia/nemotron-3.5-embed-1b";

export const EMBED_DIMS = 1024;

export type EmbeddingInputType = "query" | "passage";

export function embeddingsEnabled(): boolean {
  return (
    Boolean(process.env.NVIDIA_API_KEY) &&
    process.env.EMBEDDINGS_ENABLED !== "false"
  );
}

type EmbeddingResponse = {
  data?: { index: number; embedding: number[] }[];
  error?: { message?: string };
};

export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
  }
  return dot;
}

export async function embedTexts(
  texts: string[],
  inputType: EmbeddingInputType,
  options: { timeoutMs?: number } = {}
): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  if (!embeddingsEnabled()) return null;

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 2_000
  );

  try {
    const response = await fetch(`${BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: texts,
        input_type: inputType,
        dimensions: EMBED_DIMS,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn(`[embed] ${response.status} ${body.slice(0, 160)}`);
      return null;
    }

    const data = (await response.json()) as EmbeddingResponse;
    if (!Array.isArray(data.data) || data.data.length !== texts.length) {
      console.warn("[embed] réponse incomplète");
      return null;
    }

    return data.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((item) => {
        const vector = item.embedding.slice(0, EMBED_DIMS);
        return normalizeVector(vector);
      });
  } catch (error) {
    console.warn(
      `[embed] ${error instanceof Error ? error.name : "error"} sur ${EMBED_MODEL}`
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const queryCache = new Map<string, number[]>();
const QUERY_CACHE_LIMIT = 200;

export async function embedQuery(text: string): Promise<number[] | null> {
  const key = text.trim().toLowerCase();
  const cached = queryCache.get(key);
  if (cached) return cached;

  const vectors = await embedTexts([text], "query", { timeoutMs: 1_800 });
  const vector = vectors?.[0];
  if (!vector) return null;

  if (queryCache.size >= QUERY_CACHE_LIMIT) {
    const oldest = queryCache.keys().next().value;
    if (oldest) queryCache.delete(oldest);
  }
  queryCache.set(key, vector);

  return vector;
}
