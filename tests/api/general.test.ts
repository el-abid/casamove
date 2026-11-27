import { describe, expect, it } from "vitest";
import { api, parseSse } from "../helpers/http";

async function general(message: string) {
  const result = await api("/api/chat/general", {
    method: "POST",
    body: {
      message,
      locale: "fr",
      sessionId: `general-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
  });

  const events = parseSse(result.text);
  const reply = events
    .filter((event) => event.event === "token")
    .map((event) => event.data.text)
    .join("");
  const sources =
    events.find((event) => event.event === "sources")?.data.sources ?? [];

  return { status: result.status, reply, sources, events };
}

describe("agent général intermodal", () => {
  it("planifie Sidi Moumen vers l'aéroport Mohammed V", async () => {
    const result = await general(
      "Comment aller de Sidi Moumen à l'aéroport Mohammed V ?"
    );
    expect(result.status).toBe(200);
    expect(result.reply).toContain("Itinéraire");
    expect(result.reply).toContain("Aéroport Mohammed V");
    expect(result.reply).toMatch(/Tram|Train|Bus/);
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("planifie Casa Voyageurs vers Rabat en train", async () => {
    const result = await general(
      "Comment aller de Casa Voyageurs à Rabat ?"
    );
    expect(result.reply).toContain("Rabat Ville");
    expect(result.reply).toContain("ONCF");
  });

  it("passe la main à l'agent bus pour une question opérateur", async () => {
    const result = await general("Quelles lignes desservent Sidi Maarouf ?");
    expect(result.reply).toContain("L006");
    expect(result.reply.toLowerCase()).toContain("sidi maarouf");
  });

  it("répond à une question hors périmètre par l'aide générale", async () => {
    const result = await general("Quelle est la capitale du Maroc ?");
    expect(result.reply.toLowerCase()).toContain("assistant");
  });

  it("expose une carte d'agent A2A pour le bus", async () => {
    const card = await api("/api/agents/bus");
    expect(card.status).toBe(200);
    expect(card.json.name).toBe("Casabus");
    expect(card.json.protocol).toBe("a2a-subset");
    expect(card.json.capabilities).toContain("information");
  });
});
