import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { corpus } from "../lib/agent/corpus.ts";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TARGET = path.join(ROOT, "lib", "agent", "embeddings.json");

const BASE_URL =
  process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const MODEL =
  process.env.NVIDIA_EMBED_MODEL ?? "nvidia/nemotron-3.5-embed-1b";
const DIMS = 1024;
const BATCH = 16;
const LOCALES = ["fr", "ar", "en"];

const apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) {
  console.error("NVIDIA_API_KEY absent. Impossible de générer les embeddings.");
  process.exit(1);
}

function normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

async function embedBatch(texts) {
  const response = await fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: texts,
      input_type: "passage",
      dimensions: DIMS,
      encoding_format: "float",
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `Embeddings ${response.status}: ${JSON.stringify(body).slice(0, 300)}`
    );
  }

  const data = body.data ?? [];
  if (data.length !== texts.length) {
    throw new Error(`Réponse incomplète: ${data.length}/${texts.length}`);
  }

  return data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((item) => normalize(item.embedding.slice(0, DIMS)));
}

const entries = [];
for (const doc of corpus) {
  for (const locale of LOCALES) {
    entries.push({
      key: `${doc.id}:${locale}`,
      text: `${doc.title[locale]}\n${doc.body[locale]}\n${doc.keywords.join(", ")}`,
    });
  }
}

console.log(`${entries.length} passages à encoder avec ${MODEL}`);

const vectors = {};
for (let start = 0; start < entries.length; start += BATCH) {
  const batch = entries.slice(start, start + BATCH);
  const embeddings = await embedBatch(batch.map((entry) => entry.text));

  batch.forEach((entry, index) => {
    vectors[entry.key] = embeddings[index].map((value) =>
      Number(value.toFixed(6))
    );
  });

  console.log(`  ${Math.min(start + BATCH, entries.length)}/${entries.length}`);
}

const corpusHash = createHash("sha256")
  .update(JSON.stringify(corpus))
  .digest("hex");

const payload = {
  model: MODEL,
  dimensions: DIMS,
  inputType: "passage",
  corpusHash,
  generatedAt: new Date().toISOString(),
  vectors,
};

fs.writeFileSync(TARGET, JSON.stringify(payload), "utf8");
const size = fs.statSync(TARGET).size;
console.log(`embeddings.json écrit: ${(size / 1024).toFixed(0)} Ko`);
