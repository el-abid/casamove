import { describe, expect, it } from "vitest";
import { api, chat, login, register, uniqueEmail } from "../helpers/http";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../helpers/env";

describe("agent Support", () => {
  it("retrouve un dossier avec son numéro", async () => {
    const user = await register(uniqueEmail("lookup"));
    const complaint = await chat(
      "Je veux signaler un retard sur la ligne 1 ce matin",
      { cookie: user.cookie }
    );
    const status = await chat(
      `Où est mon dossier ${complaint.ticket.number} ?`,
      { cookie: user.cookie }
    );

    expect(status.reply).toContain(complaint.ticket.number);
    expect(status.reply.toLowerCase()).toContain("attente");
    expect(status.ticket?.number).toBe(complaint.ticket.number);
  });

  it("liste les dossiers d'un usager connecté", async () => {
    const user = await register(uniqueEmail("support"));
    const complaint = await chat(
      "Je veux signaler un retard sur la ligne 1 ce matin",
      { cookie: user.cookie }
    );

    const mine = await chat("Quels sont mes dossiers ?", {
      cookie: user.cookie,
    });

    expect(mine.reply).toContain(complaint.ticket.number);
  });

  it("refuse le dossier d'un autre usager", async () => {
    const owner = await register(uniqueEmail("owner"));
    const complaint = await chat(
      "Je veux signaler une agression sur la ligne 1 hier soir",
      { cookie: owner.cookie }
    );

    const anonymous = await chat(
      `Où est mon dossier ${complaint.ticket.number} ?`
    );

    expect(anonymous.reply.toLowerCase()).toMatch(
      /pas été trouvé|ne trouve pas/
    );
  });

  it("demande la connexion pour consulter ses dossiers", async () => {
    const response = await chat("Quels sont mes dossiers ?");
    expect(response.reply.toLowerCase()).toContain("connectez-vous");
  });

  it("reconnaît une demande de suivi sans numéro", async () => {
    const response = await chat("Où en est ma réclamation ?");
    expect(response.reply.toLowerCase()).toContain("connectez-vous");
  });

  it("lit une perturbation active", async () => {
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const signal = await api("/api/signals", {
      method: "POST",
      cookie: admin.cookie,
      body: { kind: "disruption" },
    });
    expect(signal.status).toBe(200);

    const response = await chat("La ligne 1 est-elle perturbée ?");
    expect(response.reply).toContain("Casa Port");
    expect(response.reply.toLowerCase()).toContain("perturbation");
  });

  it("réutilise un dossier identique récent", async () => {
    const user = await register(uniqueEmail("dedup"));
    const first = await chat(
      "Je veux signaler un retard sur la ligne 1 ce matin",
      { cookie: user.cookie }
    );
    const second = await chat(
      "Je veux signaler un retard sur la ligne 1 ce matin",
      { cookie: user.cookie }
    );

    expect(second.ticket.number).toBe(first.ticket.number);
  });

  it("protège la lecture d'un dossier par son numéro", async () => {
    const user = await register(uniqueEmail("reader"));
    const complaint = await chat(
      "Je veux signaler un retard sur la ligne 1 ce matin",
      { cookie: user.cookie }
    );

    const owner = await api(`/api/tickets/${complaint.ticket.number}`, {
      cookie: user.cookie,
    });
    expect(owner.status).toBe(200);
    expect(owner.json.ticket.number).toBe(complaint.ticket.number);

    const anonymous = await api(`/api/tickets/${complaint.ticket.number}`);
    expect(anonymous.status).toBe(401);
  });

  it("interdit la publication d'un signal à un usager", async () => {
    const user = await register(uniqueEmail("signal"));
    const response = await api("/api/signals", {
      method: "POST",
      cookie: user.cookie,
      body: { kind: "disruption" },
    });
    expect(response.status).toBe(403);
  });
});
