import alsaNetwork from "@/content/providers/alsa/network.json";
import {
  lines as tramLines,
  stations as tramStations,
} from "@/lib/mobility/network";

export type IntermodalMode = "tram" | "bus" | "train" | "walk";

export type IntermodalLeg = {
  mode: IntermodalMode;
  line: string | null;
  from: string;
  to: string;
  minutes: number;
  stops: number;
};

export type IntermodalItinerary = {
  from: string;
  to: string;
  minutes: number;
  legs: IntermodalLeg[];
};

type BusStop = { id: string; name: string };
type BusRoute = {
  shortName: string;
  stops: BusStop[];
};
type BusNetwork = { routes: BusRoute[] };

type Node = {
  id: string;
  name: string;
  mode: IntermodalMode;
  canonical: string;
};

type Edge = {
  to: string;
  minutes: number;
  mode: IntermodalMode;
  line: string | null;
};

const RIDE_MINUTES = 2;
const TRANSFER_MINUTES = 4;

export function canonicalPlace(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(terminus|station|gare|arret|arrêt)\b/g, " ")
    .replace(/\ba eroport\b/g, "aeroport")
    .replace(/\bmohamed\b/g, "mohammed")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(l|la|le|les|d|du|de|des|the)\s+/, "");
}

const nodes = new Map<string, Node>();
const graph = new Map<string, Edge[]>();

function addNode(id: string, name: string, mode: IntermodalMode) {
  if (nodes.has(id)) return;
  nodes.set(id, { id, name, mode, canonical: canonicalPlace(name) });
}

function addEdge(from: string, to: string, minutes: number, mode: IntermodalMode, line: string | null) {
  const list = graph.get(from) ?? [];
  list.push({ to, minutes, mode, line });
  graph.set(from, list);
}

function addRide(from: string, to: string, mode: IntermodalMode, line: string) {
  addEdge(from, to, RIDE_MINUTES, mode, line);
  addEdge(to, from, RIDE_MINUTES, mode, line);
}

function build() {
  for (const line of tramLines) {
    for (const station of line.stations) {
      addNode(`tram:${station.id}`, station.fr, "tram");
    }
    for (let index = 0; index < line.stations.length - 1; index += 1) {
      const current = line.stations[index];
      const next = line.stations[index + 1];
      addRide(`tram:${current.id}`, `tram:${next.id}`, "tram", line.id);
    }
  }

  const bus = alsaNetwork as BusNetwork;
  for (const route of bus.routes) {
    for (const stop of route.stops) {
      addNode(`bus:${stop.id}`, stop.name, "bus");
    }
    for (let index = 0; index < route.stops.length - 1; index += 1) {
      const current = route.stops[index];
      const next = route.stops[index + 1];
      addRide(`bus:${current.id}`, `bus:${next.id}`, "bus", route.shortName);
    }
  }

  const train = [
    ["casa-port", "Casa Port"],
    ["casa-voyageurs", "Casa Voyageurs"],
    ["aeroport", "Aéroport Mohammed V"],
    ["rabat", "Rabat Ville"],
    ["mohammedia", "Mohammedia"],
  ] as const;

  for (const [id, name] of train) {
    addNode(`train:${id}`, name, "train");
  }

  const trainEdges = [
    ["casa-port", "casa-voyageurs", 5],
    ["casa-voyageurs", "aeroport", 35],
    ["casa-voyageurs", "rabat", 60],
    ["casa-port", "mohammedia", 45],
  ] as const;

  for (const [from, to, minutes] of trainEdges) {
    addEdge(`train:${from}`, `train:${to}`, minutes, "train", "ONCF");
    addEdge(`train:${to}`, `train:${from}`, minutes, "train", "ONCF");
  }

  const byPlace = new Map<string, string[]>();
  for (const node of nodes.values()) {
    if (!node.canonical) continue;
    const list = byPlace.get(node.canonical) ?? [];
    list.push(node.id);
    byPlace.set(node.canonical, list);
  }

  for (const ids of byPlace.values()) {
    if (ids.length < 2) continue;
    for (const from of ids) {
      for (const to of ids) {
        if (from === to) continue;
        addEdge(from, to, TRANSFER_MINUTES, "walk", null);
      }
    }
  }
}

build();

const placeIndex = new Map<string, string[]>();
for (const node of nodes.values()) {
  if (!node.canonical) continue;
  const list = placeIndex.get(node.canonical) ?? [];
  list.push(node.id);
  placeIndex.set(node.canonical, list);
}

function resolve(query: string): string[] {
  const needle = canonicalPlace(query);
  if (!needle || needle.length < 3) return [];

  const exact = placeIndex.get(needle);
  if (exact) return exact.slice(0, 8);

  const prefix: string[] = [];
  const contains: string[] = [];
  for (const node of nodes.values()) {
    if (!node.canonical) continue;
    if (node.canonical.startsWith(needle) || needle.startsWith(node.canonical)) {
      prefix.push(node.id);
    } else if (needle.length >= 5 && node.canonical.includes(needle)) {
      contains.push(node.id);
    }
  }

  return [...new Set(prefix.length > 0 ? prefix : contains)].slice(0, 8);
}

function shortestPath(
  starts: string[],
  goals: Set<string>
): { path: string[]; minutes: number } | null {
  const distances = new Map<string, number>();
  const previous = new Map<string, { node: string; edge: Edge }>();
  const queue: { id: string; distance: number }[] = [];

  for (const start of starts) {
    distances.set(start, 0);
    queue.push({ id: start, distance: 0 });
  }

  while (queue.length > 0) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift()!;
    if (current.distance > (distances.get(current.id) ?? Infinity)) continue;
    if (goals.has(current.id)) {
      const path = [current.id];
      let cursor = current.id;
      while (previous.has(cursor)) {
        const step = previous.get(cursor)!;
        path.unshift(step.node);
        cursor = step.node;
      }
      return { path, minutes: current.distance };
    }

    for (const edge of graph.get(current.id) ?? []) {
      const next = current.distance + edge.minutes;
      if (next >= (distances.get(edge.to) ?? Infinity)) continue;
      distances.set(edge.to, next);
      previous.set(edge.to, { node: current.id, edge });
      queue.push({ id: edge.to, distance: next });
    }
  }

  return null;
}

function compress(
  path: string[],
  goals: Set<string>
): IntermodalLeg[] {
  const legs: IntermodalLeg[] = [];
  let current: IntermodalLeg | null = null;

  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    const edge = (graph.get(from) ?? []).find((item) => item.to === to);
    if (!edge) continue;
    const fromNode = nodes.get(from)!;
    const toNode = nodes.get(to)!;

    if (
      current &&
      current.mode === edge.mode &&
      current.line === edge.line &&
      edge.mode !== "walk"
    ) {
      current.to = toNode.name;
      current.minutes += edge.minutes;
      current.stops += 1;
      continue;
    }

    if (current) legs.push(current);
    current = {
      mode: edge.mode,
      line: edge.line,
      from: fromNode.name,
      to: toNode.name,
      minutes: edge.minutes,
      stops: edge.mode === "walk" ? 0 : 1,
    };

    if (goals.has(to) && index === path.length - 2) {
      legs.push(current);
      current = null;
    }
  }

  if (current) legs.push(current);
  return legs;
}

export function planIntermodal(
  fromQuery: string,
  toQuery: string
): IntermodalItinerary | null {
  const starts = resolve(fromQuery);
  const goals = new Set(resolve(toQuery));
  if (starts.length === 0 || goals.size === 0) return null;

  let best: { path: string[]; minutes: number } | null = null;
  for (const start of starts) {
    const result = shortestPath([start], goals);
    if (result && (!best || result.minutes < best.minutes)) best = result;
  }

  if (!best) return null;

  const legs = compress(best.path, goals).filter(
    (leg) => leg.mode !== "walk" || leg.minutes >= TRANSFER_MINUTES
  );

  if (legs.length === 0) return null;

  return {
    from: nodes.get(best.path[0])!.name,
    to: nodes.get(best.path[best.path.length - 1])!.name,
    minutes: best.minutes,
    legs,
  };
}

export function intermodalStats() {
  return {
    nodes: nodes.size,
    edges: [...graph.values()].reduce((total, edges) => total + edges.length, 0),
    tramStations: tramStations.length,
    busStops: new Set([...nodes.values()].filter((n) => n.mode === "bus").map((n) => n.id)).size,
  };
}
