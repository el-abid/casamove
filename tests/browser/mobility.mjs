import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.env.CASAMOVE_PLAYWRIGHT_MODULE;
const { chromium } = await import(
  modulePath ? pathToFileURL(modulePath).href : "playwright"
);
const base = process.env.CASAMOVE_E2E_URL ?? "http://localhost:3211";
const destination = resolve(
  process.env.CASAMOVE_SCREENSHOTS ?? "docs/upgrade/screenshots"
);
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CASAMOVE_BROWSER_EXECUTABLE,
  headless: true,
});
const viewport = { width: 1440, height: 960 };
const passenger = await browser.newContext({
  viewport,
  reducedMotion: "reduce",
  serviceWorkers: "allow",
});
const staff = await browser.newContext({ viewport, reducedMotion: "reduce" });
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});
const rider = await passenger.newPage();
const tower = await staff.newPage();
const phone = await mobile.newPage();
const issues = [];
const simulations = new Map();
for (const page of [rider, tower, phone]) {
  page.setDefaultTimeout(18000);
  page.on("pageerror", (error) => issues.push(error.message));
}
const picture = async (page, name) => {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  return page.screenshot({
    path: resolve(destination, name + ".png"),
    fullPage: true,
    animations: "disabled",
  });
};
const request = async (context, path, data) => {
  const response = data
    ? await context.request.post(base + path, { data })
    : await context.request.get(base + path);
  assert.ok(response.ok(), path + " returned " + response.status());
  return response.json();
};
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const starter =
  "/fr/journey?from=t3-casa-port&to=bw1-sidi-maarouf&preference=fastest";
const closureTitle = "Exercice — fermeture T3";
const reportName = "Observation d’essai " + Date.now();

async function createSimulation(title, effect, line, start, end) {
  await tower
    .locator("form")
    .filter({ has: tower.locator("input[name=title]") })
    .first()
    .locator("select")
    .first()
    .selectOption(line);
  await tower.getByLabel("Effet opérationnel").selectOption(effect);
  if (start) await tower.locator("select[name=station]").selectOption(start);
  if (end) await tower.locator("select[name=endStation]").selectOption(end);
  await tower.getByRole("textbox", { name: "Titre" }).fill(title);
  await tower
    .getByRole("textbox", { name: "Explication" })
    .fill("Exercice de supervision CasaMove.");
  const created = tower.waitForResponse(
    (response) =>
      response.url().endsWith("/api/mobility/disruptions") &&
      response.request().method() === "POST"
  );
  await tower.getByRole("button", { name: "Créer l’incident simulé" }).click();
  const response = await created;
  assert.equal(response.status(), 201);
  const data = await response.json();
  simulations.set(data.id, data.revision);
  await tower
    .getByText("Modifications enregistrées.", { exact: true })
    .waitFor();
  return data;
}

async function resolveSimulation(id, title) {
  const card = tower.locator(".mob-tower-list li").filter({ hasText: title });
  const response = tower.waitForResponse(
    (item) =>
      item.url().endsWith("/api/mobility/disruptions/" + id) &&
      item.request().method() === "PATCH"
  );
  await card.getByRole("button", { name: "Résoudre", exact: true }).click();
  assert.equal((await response).status(), 200);
  simulations.delete(id);
}

try {
  await Promise.all([
    request(passenger, "/api/auth/login", {
      email: "usager@casamove.ma",
      password: "Usager2026!",
    }),
    request(staff, "/api/auth/login", {
      email: "admin@casamove.ma",
      password: "CasaMove2026!",
    }),
  ]);
  await Promise.all([
    rider.goto(base + "/fr"),
    tower.goto(base + "/admin/mobility"),
  ]);
  await rider.getByText("Aucune perturbation simulée active.").waitFor();
  await rider.keyboard.press("Tab");
  assert.equal(
    await rider.evaluate(() => document.activeElement?.getAttribute("href")),
    "#main-content"
  );
  await rider.locator(".mob-hero h1").click();
  assert.equal(
    await rider
      .locator(".mob-hero h1")
      .evaluate((node) => getComputedStyle(node).color),
    "rgb(255, 255, 255)"
  );
  await picture(rider, "01-accueil-fr");
  await tower.getByRole("heading", { name: "Créer une simulation" }).waitFor();
  console.log("French home and authenticated Tower ready");

  const origin = rider.getByRole("combobox", { name: "Départ" });
  await origin.fill("casa p");
  await rider.getByRole("option", { name: /Casa Port/ }).waitFor();
  await origin.press("ArrowDown");
  await origin.press("Enter");
  assert.equal(await origin.inputValue(), "Casa Port");
  await rider.getByRole("combobox", { name: "Arrivée" }).fill("سيدي معروف");
  await rider.getByRole("option", { name: /Sidi Maarouf/ }).click();
  await Promise.all([
    rider.waitForURL("**/journey?*"),
    rider.getByRole("button", { name: "Calculer l’itinéraire" }).click(),
  ]);
  await rider
    .locator(".mob-timeline")
    .getByText("Bd Mohammed VI", { exact: false })
    .first()
    .waitFor();
  await picture(rider, "02-itineraire-multimodal");
  await rider.getByText("Enregistrer le trajet", { exact: true }).click();
  await rider
    .getByRole("textbox", { name: "Nom du trajet" })
    .fill("Démo Casa Port");
  await rider.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await rider.getByText("Modifications enregistrées.").waitFor();
  await rider.getByRole("button", { name: "Démarrer le trajet" }).click();
  await rider.getByRole("heading", { name: "Compagnon de trajet" }).waitFor();
  await picture(rider, "03-compagnon");
  const unrelated = await passenger.newPage();
  await unrelated.goto(
    base + "/fr/journey?from=t1-casa-voyageurs&to=t1-nations-unies"
  );
  await unrelated
    .locator(".mob-route-result")
    .getByRole("heading", { name: /Casa Voyageurs/ })
    .waitFor();
  console.log(
    "Bilingual search, keyboard selection, saved trip and companion passed"
  );

  const initialPageLoad = await rider.evaluate(() => performance.timeOrigin);
  const since = Date.now();
  const closure = await createSimulation(
    closureTitle,
    "segment-closure",
    "T3",
    "t3-dar-attouzani",
    "t3-bd-mohammed-vi"
  );
  await rider
    .getByRole("heading", { name: "Une perturbation touche votre itinéraire." })
    .waitFor({ timeout: 26000 });
  const rerouteMs = Date.now() - since;
  assert.equal(
    await rider.evaluate(() => performance.timeOrigin),
    initialPageLoad
  );
  await rider
    .locator(".mob-timeline")
    .getByText("Mohammed Smiha", { exact: false })
    .first()
    .waitFor();
  await unrelated
    .locator(".mob-status")
    .getByText(closureTitle)
    .waitFor({ timeout: 26000 });
  assert.equal(await unrelated.locator(".mob-impact").count(), 0);
  await picture(rider, "04-reroutage");
  await picture(tower, "05-control-tower");
  await rider
    .getByRole("button", { name: "Suivre le nouvel itinéraire" })
    .click();
  await rider.getByRole("button", { name: "Mettre en pause" }).click();
  await rider.reload();
  await rider.getByRole("button", { name: "Reprendre", exact: true }).click();
  await rider
    .getByRole("button", { name: "Confirmer la prochaine étape" })
    .click();
  await rider
    .locator(".mob-companion")
    .getByText("Mohammed Smiha", { exact: true })
    .first()
    .waitFor();
  console.log(
    "Two-session reroute passed in " +
      rerouteMs +
      " ms, and the companion restored after reload"
  );

  const suspensionTitle = "Exercice — suspension BW1";
  const suspension = await createSimulation(
    suspensionTitle,
    "line-suspension",
    "BW1"
  );
  await rider
    .getByText("Aucun autre trajet disponible pour le moment.")
    .waitFor({ timeout: 26000 });
  await picture(rider, "06-sans-alternative");
  await resolveSimulation(suspension.id, suspensionTitle);
  await rider
    .getByText("Aucun autre trajet disponible pour le moment.")
    .waitFor({ state: "hidden", timeout: 26000 });
  await rider.getByRole("button", { name: "Terminer", exact: true }).click();
  console.log("No-alternative state and restoration passed");

  await rider.goto(base + "/fr/reports");
  await rider.locator(".mob-form select").first().selectOption("T3");
  await rider
    .getByLabel("Station", { exact: true })
    .selectOption("t3-dar-attouzani");
  await rider
    .getByLabel("Fin du segment (facultative)")
    .selectOption("t3-bd-mohammed-vi");
  await rider.getByLabel("Catégorie").selectOption("delay");
  await rider
    .getByRole("textbox", { name: "Description (facultative)" })
    .fill(reportName);
  await rider.getByRole("button", { name: "Envoyer le signalement" }).click();
  await rider
    .getByText("Signalement reçu et en attente de vérification.")
    .waitFor();
  await picture(rider, "07-community-pulse");
  const observation = tower
    .locator(".mob-tower-list li")
    .filter({ hasText: reportName });
  await observation.getByLabel("Modération").selectOption("confirmed");
  await observation
    .getByLabel("Associer à un incident")
    .selectOption(String(closure.id));
  await observation
    .getByRole("button", { name: "Enregistrer la modération" })
    .click();
  await observation.locator("p").filter({ hasText: "Confirmé" }).waitFor();
  await picture(tower, "08-moderation");
  await resolveSimulation(closure.id, closureTitle);
  await rider.goto(base + "/fr/account");
  await rider.getByText("Démo Casa Port", { exact: true }).waitFor();
  await rider
    .getByText("Carte de démonstration · non valable pour voyager")
    .waitFor();
  await rider
    .getByText("Mise à jour d’un signalement", { exact: true })
    .first()
    .waitFor();
  await rider
    .getByText("Perturbation résolue", { exact: true })
    .first()
    .waitFor();
  await picture(rider, "09-espace-et-wallet");
  await rider
    .locator("#mobility-notifications")
    .screenshot({ path: resolve(destination, "10-notifications.png") });
  await rider.getByRole("button", { name: "Tout marquer comme lu" }).click();
  await rider.waitForFunction(
    () =>
      document.querySelector("#mobility-notifications .mob-count")
        ?.textContent === "0"
  );
  await rider.goto(base + starter);
  await rider
    .locator(".mob-timeline")
    .getByText("Bd Mohammed VI", { exact: false })
    .first()
    .waitFor();
  console.log(
    "Report, moderation, notifications, demo wallet and initial route restoration passed"
  );

  await rider.goto(base + "/fr/network");
  await rider.locator(".mob-map [data-station]").first().waitFor();
  assert.equal(await rider.locator(".mob-map [data-station]").count(), 151);
  await picture(rider, "11-reseau-schematique");
  await rider
    .getByRole("button", { name: "Carte géographique", exact: true })
    .click();
  await rider.locator(".mob-geo .leaflet-interactive").first().waitFor();
  await rider.getByText(/143\/151 stations cartographiées/).waitFor();
  assert.equal(
    await rider.locator(".mob-geo .leaflet-interactive").count(),
    143
  );
  await rider
    .locator(".leaflet-tile-loaded")
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  const loadedTiles = await rider.locator(".leaflet-tile-loaded").count();
  await picture(rider, "12-carte-geographique");
  console.log(
    "Maps display 151 schematic stations and 143 geographic positions, " +
      loadedTiles +
      " tiles loaded"
  );

  await phone.goto(base + "/ar");
  await phone.getByRole("heading", { level: 1 }).waitFor();
  assert.equal(await phone.locator("html").getAttribute("dir"), "rtl");
  assert.ok(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  );
  await picture(phone, "13-mobile-ar");
  await phone.locator(".menu-btn").click();
  await phone
    .getByRole("navigation")
    .getByRole("link", { name: "المسارات", exact: true })
    .click();
  await phone.getByRole("button", { name: "احسب المسار" }).waitFor();
  assert.ok(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  );

  await rider.goto(base + "/en");
  await rider.getByText("No active simulated disruptions.").waitFor();
  await picture(rider, "14-accueil-en");
  const manifest = await request(passenger, "/manifest.webmanifest");
  assert.equal(manifest.display, "standalone");
  await rider.waitForFunction(() => !!navigator.serviceWorker.controller, {
    timeout: 20000,
  });
  const cache = await rider.evaluate(async () => {
    const [key] = (await caches.keys()).filter((name) =>
      name.startsWith("casamove-public-")
    );
    return (await (await caches.open(key)).keys()).map(
      (entry) => new URL(entry.url).pathname
    );
  });
  assert.ok(
    cache.includes("/fr/network") &&
      cache.includes("/en/journey") &&
      cache.includes("/api/mobility/network")
  );
  assert.ok(
    !cache.some((entry) =>
      /(?:\/account|\/admin|\/api\/auth|\/api\/mobility\/network\/status)/.test(
        entry
      )
    )
  );
  await passenger.setOffline(true);
  await rider.goto(base + "/en/network");
  await rider.locator(".mob-map [data-station]").first().waitFor();
  await rider.getByText("Offline", { exact: true }).waitFor();
  await rider.goto(base + starter.replace("/fr/", "/en/"));
  await rider.getByText("Offline", { exact: true }).waitFor();
  await rider
    .locator(".mob-timeline")
    .getByText("Bd Mohammed VI", { exact: false })
    .first()
    .waitFor();
  await picture(rider, "15-planificateur-hors-ligne");
  await passenger.setOffline(false);
  await rider
    .getByText("No active simulated disruptions.")
    .waitFor({ timeout: 20000 });
  await pause(100);
  assert.deepEqual(issues, []);
  console.log(
    JSON.stringify({
      rerouteMs,
      loadedTiles,
      cachedPublicPaths: cache.length,
      screenshots: 15,
      pageErrors: issues.length,
    })
  );
} finally {
  for (const [id, revision] of simulations) {
    await staff.request
      .patch(base + "/api/mobility/disruptions/" + id, {
        data: { action: "resolve", revision },
      })
      .catch(() => {});
  }
  await browser.close();
}
