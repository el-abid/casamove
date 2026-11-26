import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { beforeAll, describe, expect, it } from "vitest";
import { importNetwork } from "@/lib/mobility/store";
import { ADMIN_EMAIL, ADMIN_PASSWORD, TEST_DB_URL } from "../helpers/env";
import { api, login, register, uniqueEmail } from "../helpers/http";

const root = "/api/mobility";
const plan = {
  from: "t3-casa-port",
  to: "bw1-sidi-maarouf",
  preference: "fastest",
};
const disruption = {
  effect: "segment-closure",
  line: "T3",
  station: "t3-dar-attouzani",
  endStation: "t3-bd-mohammed-vi",
  title: "Simulation de test",
  description: "Segment indisponible",
  category: "operations",
  severity: "major",
  published: true,
};

describe("mobility API, authenticated ownership and operations", () => {
  let admin: string;
  let passenger: string;
  let other: string;

  beforeAll(async () => {
    admin = (await login(ADMIN_EMAIL, ADMIN_PASSWORD)).cookie;
    passenger = (await register(uniqueEmail("mobility"))).cookie;
    other = (await register(uniqueEmail("mobility-other"))).cookie;
  });

  it("exposes the public network and persistently imports it with no duplicates", async () => {
    const result = await api(`${root}/network`);
    expect(result.status).toBe(200);
    expect(result.json.lines).toHaveLength(6);
    expect(result.json.transfers).toHaveLength(13);
    await Promise.all([importNetwork(), importNetwork()]);
    const client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    try {
      const { rows } = await client.query(`
        SELECT (SELECT count(*)::int FROM mobility_stations) AS stations,
        (SELECT count(*)::int FROM mobility_network_versions) AS versions
      `);
      expect(rows[0]).toEqual({ stations: 151, versions: 1 });
    } finally {
      await client.end();
    }
  });

  it("enforces the admin boundary, reacts to revisions and restores the route", async () => {
    const forbidden = await api(`${root}/disruptions`, {
      method: "POST",
      body: disruption,
      cookie: passenger,
    });
    expect(forbidden.status).toBe(403);
    expect((await api(`${root}/tower`, { cookie: passenger })).status).toBe(
      403
    );
    const original = await api(`${root}/routes/plan`, {
      method: "POST",
      body: plan,
    });
    expect(original.json.journeys[0].transfers).toBe(1);
    const created = await api(`${root}/disruptions`, {
      method: "POST",
      body: disruption,
      cookie: admin,
    });
    expect(created.status).toBe(201);
    expect(created.json.source).toBe("simulation");
    const path = `${root}/disruptions/${created.json.id}`;
    const status = await api(`${root}/network/status`);
    expect(status.json.incidents).toHaveLength(1);
    expect(status.json.version).not.toBe(original.json.networkVersion);
    const recalculate = await api(`${root}/routes/recalculate`, {
      method: "POST",
      body: plan,
    });
    expect(recalculate.json.journeys[0].transfers).toBe(2);
    const change = await api(path, {
      method: "PATCH",
      cookie: admin,
      body: { ...disruption, title: "Incident modifié", revision: 1 },
    });
    expect(change.status).toBe(200);
    const stale = await api(path, {
      method: "PATCH",
      cookie: admin,
      body: { action: "resolve", revision: 1 },
    });
    expect(stale.status).toBe(409);
    const resolved = await api(path, {
      method: "PATCH",
      cookie: admin,
      body: { action: "resolve", revision: 2 },
    });
    expect(resolved.status).toBe(200);
    const tower = await api(`${root}/tower`, { cookie: admin });
    expect(
      tower.json.history.map(({ action }: { action: string }) => action)
    ).toEqual(["resolved", "updated", "created"]);
    expect(tower.json.counts).toMatchObject({ active: 0, resolved: 1 });
    const restored = await api(`${root}/routes/plan`, {
      method: "POST",
      body: plan,
    });
    expect(restored.json.journeys[0]).toEqual(original.json.journeys[0]);
  });

  it("deduplicates passenger reports without altering routing and delivers moderation notices", async () => {
    const body = {
      station: disruption.station,
      endStation: disruption.endStation,
      category: "delay",
      description: "Observation de test",
    };
    const send = () =>
      api(`${root}/reports`, { method: "POST", body, cookie: passenger });
    const responses = await Promise.all([send(), send()]);
    expect(responses.map((item) => item.status).sort()).toEqual([200, 201]);
    const [first] = responses;
    const reportId = first.json.report.id;
    expect(responses[1].json.report.id).toBe(reportId);
    expect((await api(`${root}/reports`, { cookie: other })).json).toHaveLength(
      0
    );
    expect((await api(`${root}/network/status`)).json.incidents).toHaveLength(
      0
    );
    const edits = { status: "confirmed", revision: 1 };
    const endpoint = `${root}/reports/${reportId}`;
    expect(
      (await api(endpoint, { method: "PATCH", body: edits, cookie: passenger }))
        .status
    ).toBe(403);
    expect(
      (await api(endpoint, { method: "PATCH", body: edits, cookie: admin }))
        .status
    ).toBe(200);
    const notifications = await api(`${root}/notifications`, {
      cookie: passenger,
    });
    expect(notifications.json).toContainEqual(
      expect.objectContaining({ kind: "report", read: false })
    );
    expect(
      (
        await api(`${root}/notifications`, {
          method: "PATCH",
          cookie: passenger,
          body: {},
        })
      ).status
    ).toBe(200);
    expect(
      (await api(`${root}/notifications`, { cookie: passenger })).json
    ).toContainEqual(expect.objectContaining({ kind: "report", read: true }));
  });

  it("isolates saved trips and favourites and stores completed history only with consent", async () => {
    const saved = await api(`${root}/routes/saved`, {
      method: "POST",
      body: { ...plan, name: "Université" },
      cookie: passenger,
    });
    expect(saved.status).toBe(201);
    expect(
      (
        await api(`${root}/routes/saved/${saved.json.id}`, {
          method: "DELETE",
          cookie: other,
          body: {},
        })
      ).status
    ).toBe(404);
    expect(
      (
        await api(`${root}/favourites`, {
          method: "POST",
          body: { station: plan.from, add: true },
          cookie: passenger,
        })
      ).status
    ).toBe(200);
    const body = { ...plan, key: randomUUID() };
    expect(
      (
        await api(`${root}/journeys/complete`, {
          method: "POST",
          body,
          cookie: passenger,
        })
      ).status
    ).toBe(200);
    expect(
      (await api(`${root}/space`, { cookie: passenger })).json
    ).toMatchObject({
      favourites: [plan.from],
      saved: [expect.objectContaining({ name: "Université" })],
      history: [],
    });
    expect((await api(`${root}/space`, { cookie: other })).json).toMatchObject({
      favourites: [],
      saved: [],
      history: [],
    });
    const prefs = {
      accessibility: true,
      history: true,
      notifications: true,
      language: "ar",
    };
    expect(
      (
        await api(`${root}/preferences`, {
          method: "PATCH",
          body: prefs,
          cookie: passenger,
        })
      ).status
    ).toBe(200);
    await Promise.all(
      [1, 2].map(() =>
        api(`${root}/journeys/complete`, {
          method: "POST",
          body,
          cookie: passenger,
        })
      )
    );
    const space = await api(`${root}/space`, { cookie: passenger });
    expect(space.json.preferences).toMatchObject(prefs);
    expect(space.json.history).toHaveLength(1);
  });
});
