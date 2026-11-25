import { describe, expect, it } from "vitest";
import { routeDocuments } from "@/lib/agent/retrieval";

const hasKey = Boolean(process.env.NVIDIA_API_KEY);

describe.skipIf(!hasKey)("routeur documentaire réel", () => {
  it("route une question de tarifs mal formulée", async () => {
    const result = await routeDocuments(
      "que sont les tarif existantes aujourd'hui ?",
      "fr"
    );

    expect(result.status).toBe("selected");
    if (result.status === "selected") {
      expect(result.docs.map((doc) => doc.id)).toContain("fares");
    }
  });

  it("route une reformulation sur les horaires", async () => {
    const result = await routeDocuments(
      "Jusqu'à quand les rames circulent-elles ?",
      "fr"
    );

    expect(result.status).toBe("selected");
    if (result.status === "selected") {
      expect(result.docs.map((doc) => doc.id)).toContain("hours");
    }
  });

  it("refuse une question hors corpus", async () => {
    const weather = await routeDocuments(
      "Quel temps fait-il à Casablanca ?",
      "fr"
    );
    expect(weather.status).toBe("none");

    const mayor = await routeDocuments(
      "Qui est le maire de Casablanca ?",
      "fr"
    );
    expect(mayor.status).toBe("none");
  });

  it("choisit la fiche agences pour une question de localisation", async () => {
    const result = await routeDocuments(
      "Où se trouve l'agence la plus proche ?",
      "fr"
    );

    expect(result.status).toBe("selected");
    if (result.status === "selected") {
      expect(result.docs.map((doc) => doc.id)).toContain("agencies");
      expect(result.docs.map((doc) => doc.id)).not.toContain("lost-payment");
    }
  });

  it("refuse une question sans réponse dans le corpus", async () => {
    const result = await routeDocuments(
      "Quels sont les moyens de paiement ?",
      "fr"
    );

    expect(result.status).toBe("none");
  });

  it("route une question en arabe", async () => {
    const result = await routeDocuments("ما هو ثمن التذكرة؟", "ar");

    expect(result.status).toBe("selected");
    if (result.status === "selected") {
      expect(result.docs.map((doc) => doc.id)).toContain("fares");
    }
  });

  it("route une question en anglais", async () => {
    const result = await routeDocuments("What time is the last tram?", "en");

    expect(result.status).toBe("selected");
    if (result.status === "selected") {
      expect(result.docs.map((doc) => doc.id)).toContain("hours");
    }
  });
});
