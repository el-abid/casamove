import { describe, expect, it } from "vitest";
import { chat } from "../helpers/http";

describe("chat et agents", () => {
  it("répond à une question horaire avec la source du guide", async () => {
    const result = await chat("Quel est le dernier tram ?");
    expect(result.status).toBe(200);
    expect(result.reply).toContain("22h30");
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources[0].source).toContain("Guide");
  });

  it("refuse une question hors corpus", async () => {
    const result = await chat("Quelle est la couleur du tram ?");
    expect(result.reply.toLowerCase()).toContain("pas cette information");
    expect(result.sources.length).toBe(0);
  });

  it("répond à une salutation", async () => {
    const result = await chat("bonjour");
    expect(result.reply.toLowerCase()).toContain("bonjour");
    expect(result.ticket).toBeUndefined();
  });

  it("explique comment déposer une réclamation", async () => {
    const result = await chat("Comment déposer une réclamation ?");
    expect(result.reply).toContain("05 22 99 83 83");
    expect(result.sources[0]?.source ?? "").toContain("Guide utilisateur");
  });

  it("explique comment suivre une réclamation", async () => {
    const result = await chat("Comment suivre ma réclamation ?");
    expect(result.reply.toLowerCase()).toContain("numéro");
    expect(result.sources[0]?.source ?? "").toContain("Guide utilisateur");
  });

  it("crée un ticket pour une réclamation détaillée", async () => {
    const result = await chat(
      "Je veux signaler une agression sur la ligne 1 hier soir"
    );
    expect(result.reply).toContain("enregistrée");
    expect(result.ticket).toBeDefined();
    expect(result.ticket.priority).toBe("P1");
    expect(result.ticket.status).toBe("pending");
  });

  it("ne bloque pas la conversation après une réclamation", async () => {
    const sessionId = `thread-${Date.now()}`;
    const complaint = await chat(
      "Je veux signaler un retard sur la ligne 1 ce matin",
      { sessionId }
    );
    expect(complaint.ticket).toBeDefined();

    const greeting = await chat("bonjour", { sessionId });
    expect(greeting.reply.toLowerCase()).toContain("bonjour");
    expect(greeting.ticket).toBeUndefined();

    const status = await chat(
      `Où est mon dossier ${complaint.ticket.number} ?`,
      { sessionId }
    );
    expect(status.reply).toContain(complaint.ticket.number);
    expect(status.reply.toLowerCase()).toContain("attente");
  });

  it("demande des détails avant de créer un ticket", async () => {
    const result = await chat("Je veux signaler un problème.");
    expect(result.reply).toContain("Décrivez");
    expect(result.ticket).toBeUndefined();
  });

  it("répond en arabe", async () => {
    const result = await chat("ما هو ثمن التذكرة؟", { locale: "ar" });
    expect(result.reply).toContain("8");
    expect(result.sources[0]?.source ?? "").toContain("دليل");
  });

  it("comprend une reformulation sur les horaires", async () => {
    const result = await chat("Ça roule jusqu'à quelle heure ?");
    expect(result.reply).toContain("22h30");
    expect(result.sources[0]?.title ?? "").toContain("Horaires");
  });

  it("comprend une reformulation sur le prix", async () => {
    const result = await chat("C'est combien un trajet ?");
    expect(result.reply).toContain("8 DH");
    expect(result.sources[0]?.title ?? "").toContain("Tarifs");
  });

  it("répond aux tarifs existants aujourd'hui", async () => {
    const result = await chat("que sont les tarif existantes aujourd'hui ?");
    expect(result.reply).toContain("8 DH");
    expect(result.sources[0]?.title ?? "").toContain("Tarifs");
  });

  it("répond à une question de validité avec la durée", async () => {
    const result = await chat(
      "Est-ce que mon billet est valable toute la journée ?"
    );
    expect(result.reply).toContain("2h30");
    expect(result.sources[0]?.title ?? "").toContain("Correspondances");
  });

  it("comprend un objet perdu formulé autrement", async () => {
    const result = await chat("J'ai perdu mon sac dans le tram");
    expect(result.reply).toContain("05 22 99 83 83");
    expect(result.sources[0]?.title ?? "").toContain("Objets perdus");
  });

  it("comprend une question sur le lieu d'achat", async () => {
    const result = await chat("Où puis-je acheter un ticket ?");
    expect(result.reply.toLowerCase()).toContain("distributeur");
    expect(result.sources[0]?.title ?? "").toContain("Acheter");
  });
});
