import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { denseRanking, retrieveHybrid } from "@/lib/agent/retrieval";
import { cosineSimilarity, normalizeVector } from "@/lib/agent/embeddings";

type EmbeddingFile = {
  vectors: Record<string, number[]>;
};

function hoursVector() {
  const file = path.join(process.cwd(), "lib", "agent", "embeddings.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as EmbeddingFile;
  return data.vectors["hours:fr"];
}

describe("retrieval dense et hybride", () => {
  it("normalise un vecteur", () => {
    const vector = normalizeVector([3, 4]);
    expect(vector[0]).toBeCloseTo(0.6);
    expect(vector[1]).toBeCloseTo(0.8);
  });

  it("calcule le cosinus de deux vecteurs normalisés", () => {
    expect(
      cosineSimilarity(normalizeVector([1, 0]), normalizeVector([1, 0]))
    ).toBeCloseTo(1);
    expect(
      cosineSimilarity(normalizeVector([1, 0]), normalizeVector([0, 1]))
    ).toBeCloseTo(0);
  });

  it("retrouve la fiche horaires par le vecteur dense", () => {
    const ranked = denseRanking(hoursVector(), "fr");
    expect(ranked[0].doc.id).toBe("hours");
    expect(ranked[0].score).toBeCloseTo(1, 4);
  });

  it("utilise le dense quand le lexical ne trouve rien", async () => {
    const result = await retrieveHybrid("xyzabc", "fr", {
      queryVector: hoursVector(),
    });

    expect(result.hits[0]?.doc.id).toBe("hours");
    expect(result.confident).toBe(false);
    expect(result.needsReview).toBe(true);
    expect(result.mode).toBe("dense");
  });

  it("garde le lexical confiant sur une reformulation", async () => {
    const result = await retrieveHybrid("C'est combien un trajet ?", "fr");

    expect(result.hits[0]?.doc.id).toBe("fares");
    expect(result.confident).toBe(true);
    expect(result.needsReview).toBe(false);
  });

  it("refuse une question hors corpus sans dense", async () => {
    const result = await retrieveHybrid(
      "Quelle est la couleur du tram ?",
      "fr"
    );

    expect(result.confident).toBe(false);
    expect(result.hits.every((hit) => hit.denseScore === 0)).toBe(true);
  });
});
