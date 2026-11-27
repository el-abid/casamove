import { describe, expect, it } from "vitest";
import { intermodalStats, planIntermodal } from "@/lib/mobility/intermodal";

describe("graphe intermodal", () => {
  it("contient les réseaux tram et bus", () => {
    const stats = intermodalStats();
    expect(stats.nodes).toBeGreaterThan(1_000);
    expect(stats.tramStations).toBeGreaterThan(100);
    expect(stats.busStops).toBeGreaterThan(900);
  });

  it("relie Sidi Moumen à l'aéroport avec un changement", () => {
    const itinerary = planIntermodal("Sidi Moumen", "Aéroport Mohammed V");
    expect(itinerary).not.toBeNull();
    expect(itinerary?.legs.some((leg) => leg.mode === "tram")).toBe(true);
    expect(
      itinerary?.legs.some(
        (leg) => leg.mode === "train" || leg.mode === "bus"
      )
    ).toBe(true);
  });

  it("relie Casa Voyageurs à Rabat en train", () => {
    const itinerary = planIntermodal("Casa Voyageurs", "Rabat");
    expect(itinerary).not.toBeNull();
    expect(itinerary?.legs.some((leg) => leg.mode === "train")).toBe(true);
    expect(itinerary?.to).toBe("Rabat Ville");
  });

  it("relie Casa Port à Ain Diab", () => {
    const itinerary = planIntermodal("Casa Port", "Ain Diab");
    expect(itinerary).not.toBeNull();
    expect(itinerary?.minutes).toBeGreaterThan(0);
  });
});
