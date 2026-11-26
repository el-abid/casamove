import {
  edgeId,
  lineById,
  rideEdges,
  stationById,
  transfers,
  type LineId,
  type NetworkEdge,
} from "./network.ts";

export const preferences = [
  "fastest",
  "fewest-transfers",
  "fewest-stops",
  "accessible",
  "tramway",
  "busway",
] as const;
export type Preference = (typeof preferences)[number];
export const effects = [
  "delay",
  "station-closure",
  "segment-closure",
  "line-suspension",
  "accessibility",
  "information",
] as const;
export type Effect = (typeof effects)[number];
export type Impact = {
  effect: Effect;
  line: LineId;
  station: string | null;
  endStation: string | null;
};
export type PlanInput = {
  from: string;
  to: string;
  preference: Preference;
  avoidLines?: LineId[];
  avoidStations?: string[];
};
type Step = NetworkEdge & { stops: number };
export type Ride = {
  kind: "ride";
  line: LineId;
  toward: string;
  stations: string[];
  passThrough: string[];
  minutes: number;
};
export type Transfer = {
  kind: "transfer";
  from: string;
  to: string;
  minutes: number;
};
export type Journey = {
  stations: string[];
  legs: (Ride | Transfer)[];
  minutes: number;
  stops: number;
  transfers: number;
  accessibility: "unknown" | "verified" | "restricted";
};
export type PlanResult = {
  status:
    | "ok"
    | "unknown-station"
    | "same-station"
    | "unavailable-station"
    | "no-route";
  journeys: Journey[];
};

export function edgeWithinImpact(edge: NetworkEdge, impact: Impact): boolean {
  const from = stationById.get(edge.from)!;
  const to = stationById.get(edge.to)!;
  if (!impact.station)
    return from.line === impact.line || to.line === impact.line;
  if (!impact.endStation)
    return edge.from === impact.station || edge.to === impact.station;
  if (edge.kind !== "ride" || from.line !== impact.line) return false;
  const first = stationById.get(impact.station);
  const last = stationById.get(impact.endStation);
  if (!first || !last) return false;
  return (
    Math.min(from.order, to.order) >= Math.min(first.order, last.order) &&
    Math.max(from.order, to.order) <= Math.max(first.order, last.order)
  );
}

function isAffectedStation(id: string, impact: Impact) {
  if (impact.station && !impact.endStation) return id === impact.station;
  return stationById.get(id)?.line === impact.line;
}

export function affectsJourney(
  journey: Journey,
  impacts: readonly Impact[]
): boolean {
  return journey.legs.some((leg) =>
    impacts.some((impact) => {
      if (leg.kind === "transfer") {
        return (
          (impact.effect === "station-closure" ||
            impact.effect === "line-suspension" ||
            impact.effect === "accessibility") &&
          [leg.from, leg.to].some((id) => isAffectedStation(id, impact))
        );
      }
      if (impact.effect === "line-suspension") return leg.line === impact.line;
      if (impact.effect === "station-closure") {
        return [leg.stations[0], leg.stations.at(-1)].includes(
          impact.station ?? ""
        );
      }
      if (impact.effect === "information") return false;
      if (impact.effect === "accessibility")
        return leg.stations.some((id) => isAffectedStation(id, impact));
      return leg.stations
        .slice(1)
        .some((to, i) =>
          edgeWithinImpact(
            {
              id: edgeId(leg.stations[i], to),
              kind: "ride",
              from: leg.stations[i],
              to,
              minutes: 0,
            },
            impact
          )
        );
    })
  );
}

type Cost = readonly [number, number, number];
const zero: Cost = [0, 0, 0];
const add = (a: Cost, b: Cost): Cost => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const compare = (a: Cost, b: Cost) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

function cost(step: Step, preference: Preference): Cost {
  const transfer = step.kind === "transfer" ? 1 : 0;
  const to = stationById.get(step.to)!;
  switch (preference) {
    case "fewest-transfers":
      return [transfer, step.minutes, step.stops];
    case "fewest-stops":
      return [step.stops, step.minutes, transfer];
    case "accessible":
      return [
        to.accessibility === "accessible" && !transfer ? 0 : 1,
        step.minutes,
        transfer,
      ];
    case "tramway":
    case "busway":
      return [
        !transfer && lineById.get(to.line)?.mode !== preference ? 1 : 0,
        step.minutes,
        transfer,
      ];
    default:
      return [step.minutes, transfer, step.stops];
  }
}

function shortest(
  graph: ReadonlyMap<string, Step[]>,
  from: string,
  to: string,
  preference: Preference,
  blockedNodes = new Set<string>(),
  blockedSteps = new Set<string>()
) {
  const distances = new Map<string, Cost>([[from, zero]]);
  const previous = new Map<string, Step>();
  const pending = new Set([from]);
  while (pending.size) {
    const current = [...pending].reduce((best, id) =>
      compare(distances.get(id)!, distances.get(best)!) < 0 ? id : best
    );
    if (current === to) {
      const steps: Step[] = [];
      for (let cursor = to; cursor !== from;) {
        const step = previous.get(cursor)!;
        steps.push(step);
        cursor = step.from;
      }
      return steps.reverse();
    }
    pending.delete(current);
    for (const step of graph.get(current) ?? []) {
      if (
        blockedNodes.has(step.to) ||
        blockedSteps.has(`${step.from}>${step.to}`)
      )
        continue;
      const next = add(distances.get(current)!, cost(step, preference));
      const known = distances.get(step.to);
      if (known && compare(next, known) >= 0) continue;
      distances.set(step.to, next);
      previous.set(step.to, step);
      pending.add(step.to);
    }
  }
  return null;
}

// Yen's loopless alternatives. At most three routes on the bundled network.
function alternatives(
  graph: Map<string, Step[]>,
  input: PlanInput,
  first: Step[],
  limit: number
) {
  const selected = [first];
  const candidates = new Map<string, { steps: Step[]; cost: Cost }>();
  const key = (steps: Step[]) => steps.map((step) => step.to).join("|");
  while (selected.length < limit) {
    const last = selected.at(-1)!;
    for (const [index, spur] of last.entries()) {
      const root = last.slice(0, index);
      const blocked = selected.flatMap((path) => {
        const step = path[index];
        return step && key(path.slice(0, index)) === key(root)
          ? [`${step.from}>${step.to}`]
          : [];
      });
      const tail = shortest(
        graph,
        spur.from,
        input.to,
        input.preference,
        new Set(root.map((step) => step.from)),
        new Set(blocked)
      );
      if (!tail) continue;
      const steps = [...root, ...tail];
      candidates.set(key(steps), {
        steps,
        cost: steps.reduce(
          (acc, step) => add(acc, cost(step, input.preference)),
          zero
        ),
      });
    }
    const best = [...candidates.entries()].sort((a, b) =>
      compare(a[1].cost, b[1].cost)
    )[0];
    if (!best) break;
    candidates.delete(best[0]);
    selected.push(best[1].steps);
  }
  return selected;
}

function describe(
  steps: Step[],
  closed: ReadonlySet<string>,
  restrictions: readonly Impact[]
): Journey {
  const legs: Journey["legs"] = [];
  for (const step of steps) {
    if (step.kind === "transfer") {
      legs.push({
        kind: "transfer",
        from: step.from,
        to: step.to,
        minutes: step.minutes,
      });
      continue;
    }
    const previous = legs.at(-1);
    const from = stationById.get(step.from)!;
    const to = stationById.get(step.to)!;
    const line = lineById.get(from.line)!;
    if (previous?.kind === "ride") {
      previous.stations.push(step.to);
      previous.minutes += step.minutes;
      if (!step.stops) previous.passThrough.push(step.to);
    } else {
      legs.push({
        kind: "ride",
        line: line.id,
        stations: [step.from, step.to],
        minutes: step.minutes,
        toward: (to.order > from.order
          ? line.stations.at(-1)!
          : line.stations[0]
        ).id,
        passThrough: closed.has(step.to) ? [step.to] : [],
      });
    }
  }
  const path = [steps[0].from, ...steps.map((step) => step.to)];
  const boardingPoints = legs.flatMap((leg) =>
    leg.kind === "ride"
      ? [leg.stations[0], leg.stations.at(-1)!]
      : [leg.from, leg.to]
  );
  const restricted = boardingPoints.some(
    (id) =>
      stationById.get(id)?.accessibility === "restricted" ||
      restrictions.some((impact) => isAffectedStation(id, impact))
  );
  return {
    stations: path,
    legs,
    minutes: Math.ceil(steps.reduce((sum, step) => sum + step.minutes, 0)),
    stops: steps.reduce((sum, step) => sum + step.stops, 0),
    transfers: legs.filter((leg) => leg.kind === "transfer").length,
    accessibility: restricted ? "restricted" : "unknown",
  };
}

export function planJourney(
  input: PlanInput,
  impacts: readonly Impact[] = [],
  limit = 3
): PlanResult {
  const fail = (status: Exclude<PlanResult["status"], "ok">): PlanResult => ({
    status,
    journeys: [],
  });
  const from = stationById.get(input.from);
  const to = stationById.get(input.to);
  if (!from || !to) return fail("unknown-station");
  if (from.id === to.id) return fail("same-station");
  const suspended = new Set([
    ...(input.avoidLines ?? []),
    ...impacts
      .filter((impact) => impact.effect === "line-suspension")
      .map((impact) => impact.line),
  ]);
  const avoid = new Set(input.avoidStations);
  const closed = new Set([
    ...[...stationById.values()]
      .filter((station) => station.boarding === "unconfirmed")
      .map((station) => station.id),
    ...impacts.flatMap((impact) =>
      impact.effect === "station-closure" && impact.station
        ? [impact.station]
        : []
    ),
  ]);
  const restrictions = impacts.filter(
    (impact) => impact.effect === "accessibility"
  );
  const unavailable = (id: string) => {
    const station = stationById.get(id)!;
    return avoid.has(id) || suspended.has(station.line);
  };
  const cannotBoard = (id: string) =>
    closed.has(id) ||
    unavailable(id) ||
    (input.preference === "accessible" &&
      (stationById.get(id)?.accessibility === "restricted" ||
        restrictions.some((impact) => isAffectedStation(id, impact))));
  if (cannotBoard(from.id) || cannotBoard(to.id))
    return fail("unavailable-station");
  const graph = new Map<string, Step[]>();
  const blocks = impacts.filter(
    (impact) => impact.effect === "segment-closure"
  );
  const delays = impacts.filter((impact) => impact.effect === "delay");
  for (const edge of [...rideEdges, ...transfers]) {
    if (unavailable(edge.from) || unavailable(edge.to)) continue;
    if (
      edge.kind === "transfer" &&
      (cannotBoard(edge.from) || cannotBoard(edge.to))
    )
      continue;
    if (blocks.some((impact) => edgeWithinImpact(edge, impact))) continue;
    const delay =
      edge.kind === "ride"
        ? delays.filter((impact) => edgeWithinImpact(edge, impact)).length * 2
        : 0;
    for (const [from, to] of [
      [edge.from, edge.to],
      [edge.to, edge.from],
    ]) {
      const step = {
        ...edge,
        from,
        to,
        minutes: edge.minutes + delay,
        stops: edge.kind === "ride" && !closed.has(to) ? 1 : 0,
      };
      graph.set(from, [...(graph.get(from) ?? []), step]);
    }
  }
  const first = shortest(graph, input.from, input.to, input.preference);
  if (!first) return fail("no-route");
  return {
    status: "ok",
    journeys: alternatives(
      graph,
      input,
      first,
      Math.min(3, Math.max(1, limit))
    ).map((steps) => describe(steps, closed, restrictions)),
  };
}
