import { describe, expect, it } from "vitest";

import { createRenewalSignals } from "@/lib/agent/signals";
import { api, login } from "../helpers/http";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../helpers/env";

describe("agent Succès client", () => {
  it("cible les abonnements qui expirent sous sept jours", async () => {
    const signals = await createRenewalSignals();

    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0].userId).toEqual(expect.any(Number));
    expect(signals[0].payload.fr.body).toContain("jour");
    expect(signals[0].payload.fr.body).not.toContain("en ligne");

    const duplicate = await createRenewalSignals();
    expect(duplicate).toEqual([]);
  });

  it("refuse la relance manuelle depuis l'API", async () => {
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const response = await api("/api/signals", {
      method: "POST",
      cookie: admin.cookie,
      body: { kind: "renewal" },
    });

    expect(response.status).toBe(400);
    expect(response.json.error).toBe("renewal_automated");
  });

  it("ne montre la relance qu'à l'abonnement concerné", async () => {
    await createRenewalSignals();

    const usager = await login("usager@casamove.ma", "Usager2026!");
    const seen = await api("/api/signals", { cookie: usager.cookie });
    expect(
      seen.json.signals.some(
        (signal: { kind: string }) => signal.kind === "renewal"
      )
    ).toBe(true);

    const mensuel = await login("mensuel@casamove.ma", "Mensuel2026!");
    const notSeen = await api("/api/signals", { cookie: mensuel.cookie });
    expect(
      notSeen.json.signals.some(
        (signal: { kind: string }) => signal.kind === "renewal"
      )
    ).toBe(false);

    const anonymous = await api("/api/signals");
    expect(
      anonymous.json.signals.some(
        (signal: { kind: string }) => signal.kind === "renewal"
      )
    ).toBe(false);
  });

  it("garde la perturbation globale", async () => {
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const response = await api("/api/signals", {
      method: "POST",
      cookie: admin.cookie,
      body: { kind: "disruption" },
    });

    expect(response.status).toBe(200);
    expect(response.json.signal.userId).toBeNull();

    const anonymous = await api("/api/signals");
    expect(
      anonymous.json.signals.some(
        (signal: { kind: string }) => signal.kind === "disruption"
      )
    ).toBe(true);
  });
});
