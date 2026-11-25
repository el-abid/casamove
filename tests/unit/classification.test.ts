import { describe, expect, it } from "vitest";
import {
  lexicalClassification,
  lineOfQuery,
  normalizeClassification,
} from "@/lib/agent/classification";

describe("classification des tickets", () => {
  it("classe une insulte en sécurité, P2, négatif", () => {
    const result = lexicalClassification(
      "Un agent m'a insulté à la station Abdelmoumen"
    );

    expect(result.theme).toBe("sécurité");
    expect(result.priority).toBe("P2");
    expect(result.sentiment).toBe("negative");
  });

  it("garde l'agression en P1", () => {
    const result = lexicalClassification("Une agression sur la ligne 1");
    expect(result.priority).toBe("P1");
    expect(result.theme).toBe("sécurité");
  });

  it("classe un retard en ponctualité", () => {
    const result = lexicalClassification("Le tram avait 20 minutes de retard");
    expect(result.theme).toBe("ponctualité");
    expect(result.priority).toBe("P3");
    expect(result.sentiment).toBe("negative");
  });

  it("reconnaît l'accessibilité", () => {
    const result = lexicalClassification(
      "Est-ce que le tram est accessible en fauteuil roulant ?"
    );
    expect(result.theme).toBe("accessibilité");
  });

  it("reconnaît un remerciement positif", () => {
    const result = lexicalClassification("Merci, le service était rapide");
    expect(result.sentiment).toBe("positive");
  });

  it("valide la sortie du modèle et complète les champs manquants", () => {
    const result = normalizeClassification(
      { theme: "sécurité", sentiment: "negative" },
      "retard sur la ligne 1"
    );

    expect(result.theme).toBe("sécurité");
    expect(result.priority).toBe("P3");
    expect(result.sentiment).toBe("negative");
  });

  it("rejette un thème inconnu", () => {
    const result = normalizeClassification(
      { theme: "inconnu", priority: "P9", sentiment: "furieux" },
      "Le tram avait du retard"
    );

    expect(result.theme).toBe("ponctualité");
    expect(result.priority).toBe("P3");
    expect(result.sentiment).toBe("negative");
  });

  it("extrait la ligne d'une réclamation", () => {
    expect(lineOfQuery("Un retard sur la ligne 4 ce matin")).toBe("ligne 4");
    expect(lineOfQuery("Incident sur T2 hier")).toBe("ligne 2");
    expect(lineOfQuery("Panne sur BW1")).toBe("ligne BW1");
    expect(lineOfQuery("Rame sale sur busway 2")).toBe("ligne BW2");
    expect(lineOfQuery("Le tram était sale")).toBeNull();
  });
});
