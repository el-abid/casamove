import {
  lineSource,
  networkSource,
  transferSource,
} from "../../content/network/casablanca.ts";
import geography from "../../content/network/geography.json" with { type: "json" };

export type LineId = (typeof lineSource)[number]["id"];
export type Accessibility = "unknown" | "accessible" | "restricted";
export type Station = {
  id: string;
  line: LineId;
  order: number;
  terminus: boolean;
  fr: string;
  ar: string;
  aliases: readonly string[];
  boarding: "diagram" | "unconfirmed";
  accessibility: Accessibility;
  geographic: { latitude: number; longitude: number; source: string } | null;
  schematic: { x: number; y: number };
};

export type NetworkEdge = {
  id: string;
  kind: "ride" | "transfer";
  from: string;
  to: string;
  minutes: number;
};

export function edgeId(from: string, to: string): string {
  return from < to ? `${from}:${to}` : `${to}:${from}`;
}

const mappedPoints: Record<
  string,
  { latitude: number; longitude: number; node: number; relation: number }
> = geography.points;

export const lines = lineSource.map(({ stops, ...line }, lane) => {
  const stations = stops.map((entry, order): Station => {
    const [key, fr, ar, aliases = [], boarding = "diagram"] = entry;
    const id = `${line.id.toLowerCase()}-${key}`;
    const point = mappedPoints[id];
    return {
      id,
      line: line.id,
      order,
      terminus: order === 0 || order === stops.length - 1,
      fr,
      ar,
      aliases,
      boarding,
      accessibility: "unknown",
      geographic: point
        ? {
            latitude: point.latitude,
            longitude: point.longitude,
            source: `https://www.openstreetmap.org/node/${point.node}`,
          }
        : null,
      schematic: {
        x: 114 + (order * 830) / (stops.length - 1),
        y: 73 + lane * 76,
      },
    };
  });
  return { ...line, stations };
});

export const stations = lines.flatMap((line) => line.stations);
export const stationById: ReadonlyMap<string, Station> = new Map(
  stations.map((stop) => [stop.id, stop])
);
export const lineById: ReadonlyMap<string, (typeof lines)[number]> = new Map(
  lines.map((line) => [line.id, line])
);

export const transfers: readonly NetworkEdge[] = transferSource.map(
  ([from, to]) => ({
    id: edgeId(from, to),
    kind: "transfer",
    from,
    to,
    minutes: 5,
  })
);

export const rideEdges: readonly NetworkEdge[] = lines.flatMap((line) =>
  line.stations.slice(1).map((to, index) => {
    const from = line.stations[index].id;
    return {
      id: edgeId(from, to.id),
      kind: "ride",
      from,
      to: to.id,
      minutes: line.mode === "tramway" ? 2.5 : 2,
    };
  })
);

export const network = {
  ...networkSource,
  lines,
  transfers,
  rideEdges,
  geographicSource: {
    attribution: geography.attribution,
    license: geography.license,
    licenseUrl: geography.licenseUrl,
  },
};

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const searchIndex = stations.map((station) => ({
  station,
  names: [station.fr, station.ar, ...station.aliases].map(normalize),
}));

export function findStations(
  query: string,
  limit = 12,
  boardableOnly = false
): Station[] {
  const key = normalize(query);
  const tokens = key.split(" ");
  return searchIndex
    .flatMap(({ station, names }) => {
      if (boardableOnly && station.boarding === "unconfirmed") return [];
      const rank = Math.min(
        ...names.map((name) => {
          if (name === key) return 0;
          if (name.startsWith(key)) return 1;
          return tokens.every((token) => name.includes(token)) ? 2 : Infinity;
        })
      );
      return Number.isFinite(rank) ? [{ station, rank }] : [];
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map(({ station }) => station);
}

export function validateNetwork() {
  if (lineById.size !== lines.length || stationById.size !== stations.length) {
    throw new Error("Duplicate network identifiers");
  }
  const edgeIds = new Set<string>();
  for (const edge of [...rideEdges, ...transfers]) {
    const from = stationById.get(edge.from);
    const to = stationById.get(edge.to);
    if (!from || !to || edgeIds.has(edge.id))
      throw new Error(`Invalid edge ${edge.id}`);
    if (
      edge.kind === "ride" &&
      (from.line !== to.line || from.order + 1 !== to.order)
    ) {
      throw new Error(`Non-adjacent ride edge ${edge.id}`);
    }
    if (
      edge.kind === "transfer" &&
      (from.line === to.line ||
        from.boarding === "unconfirmed" ||
        to.boarding === "unconfirmed")
    ) {
      throw new Error(`Invalid transfer edge ${edge.id}`);
    }
    edgeIds.add(edge.id);
  }
  return {
    version: network.version,
    lines: lines.map((line) => ({
      id: line.id,
      diagram: line.diagram,
      stations: line.stations.length,
      unconfirmed: line.stations.filter(
        (station) => station.boarding === "unconfirmed"
      ).length,
    })),
    stations: stations.length,
    rideEdges: rideEdges.length,
    transfers: transfers.length,
    geographic: stations.filter((station) => station.geographic).length,
  };
}
