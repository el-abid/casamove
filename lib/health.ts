import { embeddingsStatus } from "@/lib/agent/retrieval";
import { LLM_MODEL, llmEnabled } from "@/lib/agent/llm";
import { pool } from "@/lib/db";

export type HealthStatus = {
  db: { ok: boolean; latencyMs: number; error?: string };
  llm: {
    enabled: boolean;
    configured: boolean;
    model: string;
  };
  embeddings: {
    enabled: boolean;
    configured: boolean;
    loaded: boolean;
    model: string;
    dimensions: number;
    vectors: number;
  };
  checkedAt: string;
};

export async function getHealthStatus(): Promise<HealthStatus> {
  const started = Date.now();
  let db: HealthStatus["db"];

  try {
    await pool.query("SELECT 1");
    db = { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    db = {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "db_error",
    };
  }

  return {
    db,
    llm: {
      enabled: llmEnabled(),
      configured: Boolean(process.env.NVIDIA_API_KEY),
      model: LLM_MODEL,
    },
    embeddings: embeddingsStatus(),
    checkedAt: new Date().toISOString(),
  };
}
