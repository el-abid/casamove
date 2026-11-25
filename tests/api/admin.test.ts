import { describe, expect, it } from "vitest";
import { api, chat, login, register, uniqueEmail } from "../helpers/http";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../helpers/env";

describe("console admin", () => {
  let adminCookie = "";
  let adminId = 0;
  let ticketNumber = "";

  it("connecte l'administrateur", async () => {
    const response = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(response.status).toBe(200);
    expect(response.json.role).toBe("admin");
    adminCookie = response.cookie;

    const me = await api("/api/auth/me", { cookie: adminCookie });
    adminId = me.json.user.id;
  });

  it("liste le dossier créé dans le chat", async () => {
    const complaint = await chat(
      "Je veux signaler un retard sur la ligne 1 ce matin"
    );
    ticketNumber = complaint.ticket.number;

    const list = await api("/api/tickets", { cookie: adminCookie });
    expect(list.status).toBe(200);
    expect(
      list.json.tickets.some(
        (ticket: { number: string }) => ticket.number === ticketNumber
      )
    ).toBe(true);
  });

  it("approuve un dossier et met à jour le statut", async () => {
    const decision = await api(`/api/tickets/${ticketNumber}/decision`, {
      method: "POST",
      cookie: adminCookie,
      body: { action: "approve", comment: "Validation de test" },
    });

    expect(decision.status).toBe(200);
    expect(decision.json.ticket.status).toBe("in_progress");

    const read = await api(`/api/tickets/${ticketNumber}`, {
      cookie: adminCookie,
    });
    expect(read.json.ticket.status).toBe("in_progress");
    expect(read.json.decisions[0].comment).toBe("Validation de test");
    expect(read.json.decisions[0].action).toBe("approve");
    expect(read.json.decisions[0].adminEmail).toBe(ADMIN_EMAIL);
    expect(
      read.json.events.some(
        (event: { event: string }) => event.event === "approve"
      )
    ).toBe(true);
  });

  it("liste les agents et expose la santé technique", async () => {
    const agents = await api("/api/admin/agents", { cookie: adminCookie });
    expect(agents.status).toBe(200);
    expect(
      agents.json.agents.some(
        (agent: { id: number; email: string }) =>
          agent.id === adminId && agent.email === ADMIN_EMAIL
      )
    ).toBe(true);

    const health = await api("/api/health/status", { cookie: adminCookie });
    expect(health.status).toBe(200);
    expect(health.json.db.ok).toBe(true);
    expect(health.json.llm.enabled).toBe(false);
    expect(health.json.embeddings.vectors).toBe(51);
  });

  it("assigne et désassigne un dossier avec journal", async () => {
    const assigned = await api(`/api/tickets/${ticketNumber}/assign`, {
      method: "POST",
      cookie: adminCookie,
      body: { assigneeId: adminId },
    });

    expect(assigned.status).toBe(200);
    expect(assigned.json.ticket.assignedTo).toBe(adminId);
    expect(
      assigned.json.events.some(
        (event: { event: string }) => event.event === "assigned"
      )
    ).toBe(true);

    const detail = await api(`/api/tickets/${ticketNumber}`, {
      cookie: adminCookie,
    });
    expect(detail.json.ticket.assignedTo).toBe(adminId);

    const unassigned = await api(`/api/tickets/${ticketNumber}/assign`, {
      method: "POST",
      cookie: adminCookie,
      body: { assigneeId: null },
    });
    expect(unassigned.status).toBe(200);
    expect(unassigned.json.ticket.assignedTo).toBeNull();
    expect(
      unassigned.json.events.some(
        (event: { event: string }) => event.event === "unassigned"
      )
    ).toBe(true);
  });

  it("affiche la fiche usager et son abonnement", async () => {
    const user = await login("usager@casamove.ma", "Usager2026!");
    const complaint = await chat(
      "Je veux signaler une rame sale sur la ligne 1 ce matin (fiche usager)",
      { cookie: user.cookie }
    );

    const detail = await api(`/api/tickets/${complaint.ticket.number}`, {
      cookie: adminCookie,
    });

    expect(detail.status).toBe(200);
    expect(detail.json.customer.email).toBe("usager@casamove.ma");
    expect(detail.json.customer.subscription.planLabel).toBe("Étudiant");
    expect(detail.json.customer.ticketCount).toBeGreaterThan(0);
    expect(
      detail.json.customer.recentTickets.some(
        (ticket: { number: string }) =>
          ticket.number === complaint.ticket.number
      )
    ).toBe(true);
    expect(
      detail.json.events.some(
        (event: { event: string }) => event.event === "created"
      )
    ).toBe(true);
  });

  it("refuse les API d'administration à un usager", async () => {
    const user = await register(uniqueEmail("console"));
    const agents = await api("/api/admin/agents", { cookie: user.cookie });
    const health = await api("/api/health/status", { cookie: user.cookie });
    const assign = await api(`/api/tickets/${ticketNumber}/assign`, {
      method: "POST",
      cookie: user.cookie,
      body: { assigneeId: adminId },
    });
    const csv = await api("/api/voc/export?period=7", { cookie: user.cookie });

    expect(agents.status).toBe(403);
    expect(health.status).toBe(403);
    expect(assign.status).toBe(403);
    expect(csv.status).toBe(403);
  });

  it("publie la réponse dans le suivi du chat", async () => {
    const status = await chat(`Où est mon dossier ${ticketNumber} ?`);
    expect(status.reply).toContain(ticketNumber);
    expect(status.reply).toContain("Réponse publiée");
  });

  it("affiche la réponse publiée dans Mon compte", async () => {
    const user = await register(uniqueEmail("reply"));
    const complaint = await chat(
      "Je veux signaler un retard sur la ligne 1 ce matin",
      { cookie: user.cookie }
    );

    const decision = await api(
      `/api/tickets/${complaint.ticket.number}/decision`,
      {
        method: "POST",
        cookie: adminCookie,
        body: { action: "approve", comment: "Réponse visible" },
      }
    );
    expect(decision.status).toBe(200);

    const detail = await api(`/api/tickets/${complaint.ticket.number}`, {
      cookie: user.cookie,
    });
    const draft = detail.json.ticket.draft as string;

    const page = await api("/fr/account", { cookie: user.cookie });
    expect(page.status).toBe(200);
    expect(page.text).toContain("Réponses publiées");
    expect(page.text).toContain(draft.slice(0, 40));
  });

  it("expose les agrégats VoC à l'admin", async () => {
    const response = await api("/api/voc", { cookie: adminCookie });
    expect(response.status).toBe(200);
    expect(response.json.total).toBeGreaterThan(0);
    expect(Array.isArray(response.json.byTheme)).toBe(true);
  });

  it("filtre le VoC par période et expose les verbatims", async () => {
    const response = await api("/api/voc?period=7", {
      cookie: adminCookie,
    });

    expect(response.status).toBe(200);
    expect(response.json.period).toBe("7");
    expect(response.json.byDay).toHaveLength(7);
    expect(Array.isArray(response.json.verbatims)).toBe(true);
    expect(
      response.json.previous === null ||
        typeof response.json.previous === "object"
    ).toBe(true);
  });

  it("exporte le VoC en CSV", async () => {
    const response = await api("/api/voc/export?period=7", {
      cookie: adminCookie,
    });

    expect(response.status).toBe(200);
    expect(response.text).toContain("Numéro");
    expect(response.text).toContain("Créé le");
    expect(response.text).toContain("Sentiment");
  });

  it("refuse la VoC à un usager", async () => {
    const user = await register(uniqueEmail("voc"));
    const response = await api("/api/voc", { cookie: user.cookie });
    expect(response.status).toBe(403);
  });

  it("refuse la relance manuelle depuis la console", async () => {
    const response = await api("/api/signals", {
      method: "POST",
      cookie: adminCookie,
      body: { kind: "renewal" },
    });
    expect(response.status).toBe(400);
    expect(response.json.error).toBe("renewal_automated");
  });

  it("publie un message personnalisé avec ligne et sévérité", async () => {
    const payload = {
      fr: {
        title: "Travaux ligne 2",
        body: "Circulation interrompue ce week-end.",
      },
      ar: { title: "أشغال الخط 2", body: "الحركة متوقفة نهاية الأسبوع." },
      en: { title: "Line 2 works", body: "Service interrupted this weekend." },
    };

    const response = await api("/api/signals", {
      method: "POST",
      cookie: adminCookie,
      body: {
        kind: "info",
        line: "ligne 2",
        severity: "critical",
        payload,
      },
    });

    expect(response.status).toBe(200);
    expect(response.json.signal.line).toBe("ligne 2");
    expect(response.json.signal.severity).toBe("critical");
    expect(response.json.signal.createdByEmail).toBe(ADMIN_EMAIL);
  });

  it("refuse un payload incomplet", async () => {
    const response = await api("/api/signals", {
      method: "POST",
      cookie: adminCookie,
      body: {
        kind: "info",
        payload: { fr: { title: "x", body: "" } },
      },
    });

    expect(response.status).toBe(400);
  });

  it("livre une alerte une seule fois, compte les lues et les masquées", async () => {
    const sessionId = `test-session-${Date.now()}`;
    const first = await api(`/api/signals?sessionId=${sessionId}`);
    expect(first.status).toBe(200);
    expect(first.json.signals.length).toBeGreaterThan(0);

    const second = await api(`/api/signals?sessionId=${sessionId}`);
    expect(second.status).toBe(200);
    expect(second.json.signals).toHaveLength(0);

    const target = first.json.signals[0];

    const read = await api(`/api/signals/${target.id}/read`, {
      method: "POST",
      body: { sessionId },
    });
    expect(read.status).toBe(200);

    const dismiss = await api(`/api/signals/${target.id}/dismiss`, {
      method: "POST",
      body: { sessionId },
    });
    expect(dismiss.status).toBe(200);

    const list = await api("/api/signals?scope=all", {
      cookie: adminCookie,
    });
    const updated = list.json.signals.find(
      (signal: { id: number }) => signal.id === target.id
    );
    expect(updated.readCount).toBeGreaterThanOrEqual(1);
    expect(updated.dismissedCount).toBeGreaterThanOrEqual(1);
  });
});
