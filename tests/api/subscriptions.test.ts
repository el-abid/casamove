import { describe, expect, it } from "vitest";
import { api, chat, login } from "../helpers/http";

describe("abonnements", () => {
  it("répond avec l'abonnement de l'usager connecté", async () => {
    const user = await login("usager@casamove.ma", "Usager2026!");
    expect(user.status).toBe(200);

    const response = await chat("Quel est mon abonnement ?", {
      cookie: user.cookie,
    });

    expect(response.reply).toContain("Étudiant");
    expect(response.reply).toContain("150");
    expect(response.ticket).toBeUndefined();
  });

  it("demande la connexion pour un abonnement anonyme", async () => {
    const response = await chat("Quel est mon abonnement ?");
    expect(response.reply.toLowerCase()).toContain("connectez-vous");
  });

  it("signale un abonnement expiré", async () => {
    const user = await login("expire@casamove.ma", "Expire2026!");
    const response = await chat("Mon abonnement est-il actif ?", {
      cookie: user.cookie,
    });

    expect(response.reply.toLowerCase()).toContain("expiré");
    expect(response.reply).toContain("60");
  });

  it("répond avec le bon abonnement selon l'usager", async () => {
    const user = await login("mensuel@casamove.ma", "Mensuel2026!");
    const response = await chat("Quel est mon abonnement ?", {
      cookie: user.cookie,
    });

    expect(response.reply).toContain("Mensuel");
    expect(response.reply).toContain("230");
    expect(response.reply).not.toContain("Étudiant");
  });

  it("affiche l'abonnement sur la page compte", async () => {
    const user = await login("usager@casamove.ma", "Usager2026!");
    const page = await api("/fr/account", { cookie: user.cookie });
    expect(page.status).toBe(200);
    expect(page.text).toContain("Étudiant");
    expect(page.text).not.toContain("Renouveler");
  });
});
