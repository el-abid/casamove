import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://api.alsaalbaida.ma";
const OUT = path.resolve("content/providers/alsa");
const HEADERS = {
  "Content-Type": "application/json",
  Origin: "https://www.casabus.ma",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(endpoint, body) {
  const response = await fetch(`${API}${endpoint}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${endpoint} -> ${response.status}`);
  }
  return response.json();
}

const list = await post("/api/Routes/busList", { keyword: "" });
const routes = [];

for (const item of list.data?.busList ?? []) {
  const routeId = String(item.routeId);
  await sleep(250);
  const header = await post("/api/Routes/routeHeader", { routeId }).catch(
    () => null
  );
  await sleep(250);
  const detail = await post("/api/Routes/routedetail", { routeId }).catch(
    () => null
  );

  const head = header?.data ?? {};
  const data = detail?.data ?? {};
  const stops = (data.stopInfos ?? []).map((stop) => ({
    id: stop.stopId,
    name: stop.stopName,
    lat: Number(stop.stopLat),
    lon: Number(stop.stopLon),
    sequence: Number(stop.stopSequence),
    time: stop.departureTime ?? null,
  }));

  routes.push({
    id: routeId,
    shortName: item.routeShortName,
    color: item.routeColor ? `#${item.routeColor}` : "#c0392b",
    textColor: item.routeTextColor ? `#${item.routeTextColor}` : "#ffffff",
    from: head.departure_stop ?? data.departureStop ?? null,
    to: head.arrival_stop ?? data.arrivalStop ?? null,
    firstTime: head.departure_time ?? null,
    lastTime: head.arrival_time ?? null,
    frequencyMinutes: head.frequency ?? null,
    durationMinutes: head.duree_trajet
      ? Math.round(head.duree_trajet / 60)
      : null,
    stops,
  });

  console.log(`${item.routeShortName} · ${stops.length} arrêts`);
}

const payload = {
  provider: "bus",
  operator: "ALSA Al Baida",
  source: "https://api.alsaalbaida.ma",
  fetchedAt: new Date().toISOString(),
  routes,
};

await mkdir(OUT, { recursive: true });
await writeFile(
  path.join(OUT, "network.json"),
  `${JSON.stringify(payload, null, 2)}\n`,
  "utf8"
);

console.log(`network.json écrit avec ${routes.length} lignes.`);
