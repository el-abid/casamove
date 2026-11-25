import { describe, expect, it } from "vitest";
import { api, chat, login } from "../helpers/http";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../helpers/env";

describe("cycle de réclamation et CSAT", () => {
  let adminCookie = "";
  let userCookie = "";
  let ticketNumber = "";

  it("crée une réclamation en attente", async () => {
    const user = await login("usager@casamove.ma", "Usager2026!");
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(user.status).toBe(200);
    expect(admin.status).toBe(200);
    userCookie = user.cookie;
    adminCookie = admin.cookie;

    const complaint = await chat(
      "Je veux signaler une insulte d'un agent à la station Abdelmoumen sur la ligne 2 ce matin",
      { cookie: userCookie }
    );

    ticketNumber = complaint.ticket.number;
    expect(complaint.ticket.status).toBe("pending");
    expect(complaint.ticket.line).toBe("ligne 2");
  });

  it("publie la réponse puis garde le dossier en cours", async () => {
    const decision = await api(`/api/tickets/${ticketNumber}/decision`, {
      method: "POST",
      cookie: adminCookie,
      body: { action: "approve", comment: "Réponse initiale" },
    });

    expect(decision.status).toBe(200);
    expect(decision.json.ticket.status).toBe("in_progress");
    expect(
      decision.json.messages.some(
        (message: { role: string }) => message.role === "agent"
      )
    ).toBe(true);
  });

  it("transmet le message de l'usager à l'agent", async () => {
    const reply = await chat("non c'est bon merci", {
      cookie: userCookie,
      ticketNumber,
    });

    expect(reply.reply.toLowerCase()).toContain("clôturer");
    expect(reply.ticket?.status).toBe("in_progress");

    const messages = await api(`/api/tickets/${ticketNumber}/messages`, {
      cookie: adminCookie,
    });
    expect(
      messages.json.messages.some(
        (message: { role: string; body: string }) =>
          message.role === "user" && message.body === "non c'est bon merci"
      )
    ).toBe(true);
    expect(messages.json.ticket.lastMessageRole).toBe("user");
  });

  it("répond depuis la console puis clôture", async () => {
    const sent = await api(`/api/tickets/${ticketNumber}/messages`, {
      method: "POST",
      cookie: adminCookie,
      body: { body: "Merci, je clôture le dossier." },
    });
    expect(sent.status).toBe(200);
    expect(sent.json.ticket.lastMessageRole).toBe("agent");
    expect(
      sent.json.messages.some(
        (message: { role: string; body: string }) =>
          message.role === "agent" &&
          message.body === "Merci, je clôture le dossier."
      )
    ).toBe(true);

    const resolved = await api(`/api/tickets/${ticketNumber}/resolve`, {
      method: "POST",
      cookie: adminCookie,
    });
    expect(resolved.status).toBe(200);
    expect(resolved.json.ticket.status).toBe("resolved");
    expect(resolved.json.ticket.resolvedAt).toBeTruthy();
    expect(resolved.json.ticket.lastMessageRole).toBe("system");
    expect(
      resolved.json.messages.some(
        (message: { role: string; body: string }) =>
          message.role === "system" && message.body.includes("clôturé")
      )
    ).toBe(true);
  });

  it("recueille une seule note CSAT de 1 à 5", async () => {
    const score = await api(`/api/tickets/${ticketNumber}/csat`, {
      method: "POST",
      cookie: userCookie,
      body: { score: 5 },
    });
    expect(score.status).toBe(200);
    expect(score.json.ticket.csatScore).toBe(5);

    const again = await api(`/api/tickets/${ticketNumber}/csat`, {
      method: "POST",
      cookie: userCookie,
      body: { score: 3 },
    });
    expect(again.status).toBe(409);

    const page = await api("/fr/account", { cookie: userCookie });
    expect(page.text).toContain("Clôturé");
  });

  it("agrège le CSAT dans le VoC", async () => {
    const voc = await api("/api/voc?period=all", { cookie: adminCookie });
    expect(voc.status).toBe(200);
    expect(voc.json.csatCount).toBeGreaterThanOrEqual(1);
    expect(voc.json.csatAverage).toBeGreaterThan(0);
    expect(
      voc.json.byStatus.some((item: { key: string }) => item.key === "resolved")
    ).toBe(true);
    expect(
      voc.json.byLine.some(
        (item: { key: string; count: number }) =>
          item.key === "ligne 2" && item.count >= 1
      )
    ).toBe(true);
  });
});
