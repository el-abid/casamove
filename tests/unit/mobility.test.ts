import { describe, expect, it } from "vitest";
import {
  edgeId,
  findStations,
  lines,
  rideEdges,
  stationById,
  transfers,
  validateNetwork,
} from "@/lib/mobility/network";
import {
  affectsJourney,
  planJourney,
  type Impact,
  type PlanInput,
} from "@/lib/mobility/routing";

const trip: PlanInput = {
  from: "t3-casa-port",
  to: "bw1-sidi-maarouf",
  preference: "fastest",
};
const segment: Impact = {
  effect: "segment-closure",
  line: "T3",
  station: "t3-dar-attouzani",
  endStation: "t3-bd-mohammed-vi",
};
const suspension: Impact = {
  effect: "line-suspension",
  line: "BW1",
  station: null,
  endStation: null,
};

describe("Casablanca mobility network", () => {
  it("validates the source counts, stable station IDs and every interchange", () => {
    expect(validateNetwork()).toMatchObject({
      stations: 151,
      transfers: 13,
      rideEdges: 145,
      geographic: 143,
    });
    expect(
      lines.map((line) => [
        line.id,
        line.stations.length,
        line.stations[0].fr,
        line.stations.at(-1)?.fr,
      ])
    ).toEqual([
      ["T1", 37, "Sidi Moumen", "Lissasfa"],
      ["T2", 33, "Ain Diab Plage", "Sidi Bernoussi"],
      ["T3", 20, "Casa Port", "Hay Al Wahda"],
      ["T4", 19, "Parc de la Ligue Arabe", "Mohammed Erradi"],
      ["BW1", 20, "Salmia 2", "Omar El Khayam"],
      ["BW2", 22, "Oulmes", "Ouled Azzouz"],
    ]);
    expect(transfers.map(({ from, to }) => [from, to])).toContainEqual([
      "t3-bd-mohammed-vi",
      "bw1-al-qods",
    ]);
    for (const { from, to } of rideEdges) {
      expect(stationById.get(to)?.order).toBe(stationById.get(from)!.order + 1);
    }
  });

  it("searches French, Arabic and transliteration aliases", () => {
    expect(findStations("  AERoPostale ")[0]?.id).toBe("bw2-aeropostale");
    expect(findStations("القُدْس")[0]?.id).toBe("bw1-al-qods");
    expect(findStations("Omar El Khayyam")[0]?.id).toBe("bw1-omar-el-khayam");
    expect(findStations("anfa park", 5, true)).toHaveLength(0);
  });
});

describe("deterministic mobility routing", () => {
  it("respects direction, adjacency and mode on a direct trip", () => {
    const input = { ...trip, from: "t3-casa-port", to: "t3-place-victoire" };
    const forward = planJourney(input).journeys[0];
    const reverse = planJourney({ ...input, from: input.to, to: input.from })
      .journeys[0];
    expect(forward.legs).toMatchObject([
      { line: "T3", toward: "t3-hay-al-wahda" },
    ]);
    expect(reverse.legs).toMatchObject([
      { line: "T3", toward: "t3-casa-port" },
    ]);
    expect(forward.stations).toEqual([...reverse.stations].reverse());
  });

  it("routes in both tramway-busway directions and returns loopless alternatives", () => {
    const forward = planJourney(trip).journeys;
    const reverse = planJourney({ ...trip, from: trip.to, to: trip.from })
      .journeys[0];
    expect(forward[0].legs[1]).toMatchObject({
      kind: "transfer",
      from: "t3-bd-mohammed-vi",
      to: "bw1-al-qods",
    });
    expect(reverse.legs[1]).toMatchObject({
      kind: "transfer",
      from: "bw1-al-qods",
      to: "t3-bd-mohammed-vi",
    });
    expect(forward).toHaveLength(3);
    expect(
      new Set(forward.map(({ stations }) => stations.join(":"))).size
    ).toBe(3);
    expect(
      forward.every(
        (route) => new Set(route.stations).size === route.stations.length
      )
    ).toBe(true);
    expect(forward[1].transfers).toBeGreaterThan(1);
  });

  it("uses distinct optimisation preferences and marks unverified accessibility", () => {
    const fewestStops = planJourney({ ...trip, preference: "fewest-stops" })
      .journeys[0];
    expect(fewestStops.stops).toBeLessThan(planJourney(trip).journeys[0].stops);
    expect(
      planJourney({ ...trip, preference: "fewest-transfers" }).journeys[0]
        .transfers
    ).toBe(1);
    expect(
      planJourney({ ...trip, preference: "accessible" }).journeys[0]
        .accessibility
    ).toBe("unknown");
    expect(planJourney({ ...trip, preference: "busway" }).status).toBe("ok");
    expect(planJourney({ ...trip, preference: "tramway" }).status).toBe("ok");
  });

  it("rejects invalid, identical or unavailable endpoints", () => {
    expect(planJourney({ ...trip, from: "not-a-station" }).status).toBe(
      "unknown-station"
    );
    expect(planJourney({ ...trip, from: trip.to }).status).toBe("same-station");
    expect(planJourney({ ...trip, from: "t2-anfa-park" }).status).toBe(
      "unavailable-station"
    );
    expect(planJourney(trip, [suspension]).status).toBe("unavailable-station");
  });

  it("reroutes around segment closures without affecting unrelated journeys", () => {
    const baseline = planJourney(trip).journeys[0];
    expect(affectsJourney(baseline, [segment])).toBe(true);
    const rerouted = planJourney(trip, [segment]).journeys[0];
    expect(rerouted.transfers).toBe(2);
    const closed = edgeId(segment.station!, segment.endStation!);
    expect(
      rerouted.stations
        .slice(1)
        .map((id, index) => edgeId(rerouted.stations[index], id))
    ).not.toContain(closed);
    const unrelated = planJourney({
      ...trip,
      from: "t3-casa-port",
      to: "t3-mohammed-smiha",
    }).journeys[0];
    expect(
      affectsJourney(unrelated, [segment, { ...segment, effect: "delay" }])
    ).toBe(false);
    expect(planJourney(trip, [segment, suspension]).journeys).toHaveLength(0);
    expect(planJourney(trip).journeys[0]).toEqual(baseline);
  });

  it("allows travel through a closed station and prevents transfers or boarding there", () => {
    const closure: Impact = {
      effect: "station-closure",
      line: "T3",
      station: "t3-mohammed-smiha",
      endStation: null,
    };
    const through = planJourney({ ...trip, to: "t3-place-victoire" }, [closure])
      .journeys[0];
    expect(through.legs[0]).toMatchObject({
      passThrough: ["t3-mohammed-smiha"],
    });
    expect(affectsJourney(through, [closure])).toBe(false);
    expect(
      planJourney({ ...trip, to: "t3-mohammed-smiha" }, [closure]).status
    ).toBe("unavailable-station");
    const connect = planJourney({ ...trip, to: "t1-mohammed-diouri" }, [
      closure,
    ]).journeys[0];
    expect(connect.legs).not.toContainEqual({
      kind: "transfer",
      from: "t3-mohammed-smiha",
      to: "t1-mohammed-diouri",
      minutes: 5,
    });
  });

  it("returns no route when a closure isolates two otherwise available stations", () => {
    expect(
      planJourney({ ...trip, to: "t3-mohammed-smiha" }, [
        {
          ...segment,
          station: "t3-casa-port",
          endStation: "t3-mohammed-smiha",
        },
      ]).status
    ).toBe("no-route");
  });
});
