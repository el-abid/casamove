import { describe, expect, it } from "vitest";
import { api, login, register, uniqueEmail } from "../helpers/http";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../helpers/env";

describe("authentification et RBAC", () => {
  let email = "";
  let cookie = "";

  it("inscrit un usager et ouvre une session", async () => {
    email = uniqueEmail("auth");
    const response = await register(email);
    expect(response.status).toBe(200);
    expect(response.json.role).toBe("user");
    expect(response.cookie).toContain("casamove_session=");
    cookie = response.cookie;

    const me = await api("/api/auth/me", { cookie });
    expect(me.json.user.email).toBe(email);
    expect(me.json.user.role).toBe("user");
  });

  it("refuse un email déjà pris", async () => {
    const response = await register(email);
    expect(response.status).toBe(409);
  });

  it("refuse un mot de passe trop court", async () => {
    const response = await register(uniqueEmail("weak"), "123");
    expect(response.status).toBe(400);
  });

  it("refuse un mauvais mot de passe", async () => {
    const response = await login(email, "MauvaisMotDePasse!");
    expect(response.status).toBe(401);
  });

  it("interdit la file admin à un usager", async () => {
    const response = await api("/api/tickets", { cookie });
    expect(response.status).toBe(403);
  });

  it("redirige /admin sans droit", async () => {
    const response = await api("/admin", { cookie });
    expect(response.status).toBe(307);
    expect(response.location ?? "").toContain("/login");
  });

  it("accepte un administrateur", async () => {
    const response = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(response.status).toBe(200);
    expect(response.json.role).toBe("admin");

    const list = await api("/api/tickets", { cookie: response.cookie });
    expect(list.status).toBe(200);
    expect(Array.isArray(list.json.tickets)).toBe(true);
  });

  it("déconnecte la session", async () => {
    const response = await api("/api/auth/logout", {
      method: "POST",
      cookie,
    });
    expect(response.status).toBe(200);

    const me = await api("/api/auth/me", { cookie });
    expect(me.json.user).toBeNull();
  });
});
