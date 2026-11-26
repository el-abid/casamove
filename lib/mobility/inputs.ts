import { lineById, stationById, type LineId } from "./network.ts";
import { effects, preferences, type PlanInput } from "./routing.ts";
import {
  incidentCategories,
  reportCategories,
  severities,
} from "./categories.ts";
import type { IncidentInput, ReportInput } from "./store.ts";

export function choice<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return typeof value === "string" && values.some((item) => item === value);
}

export const textField = (value: unknown, max: number) =>
  typeof value === "string" && value.length <= max && !value.includes("\u0000")
    ? value.trim()
    : null;
export const isLine = (value: unknown): value is LineId =>
  typeof value === "string" && lineById.has(value);
export const isStation = (value: unknown): value is string =>
  typeof value === "string" && stationById.has(value);
export const isId = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value > 0 &&
  value <= 2147483647;

type Fields = Record<string, unknown>;
export function parsePlan(body: Fields): PlanInput | null {
  const {
    from,
    to,
    preference = "fastest",
    avoidLines = [],
    avoidStations = [],
  } = body;
  if (
    !isStation(from) ||
    !isStation(to) ||
    !choice(preferences, preference) ||
    !Array.isArray(avoidLines) ||
    avoidLines.length > 6 ||
    !avoidLines.every(isLine) ||
    !Array.isArray(avoidStations) ||
    avoidStations.length > 20 ||
    !avoidStations.every(isStation)
  )
    return null;
  return { from, to, preference, avoidLines, avoidStations };
}

export function parseIncident(body: Fields): IncidentInput | null {
  const {
    line,
    station = null,
    endStation = null,
    effect,
    category,
    severity,
    published,
    expiresAt = null,
  } = body;
  const title = textField(body.title, 100);
  const description = textField(body.description, 800);
  if (
    !title ||
    description === null ||
    !isLine(line) ||
    !choice(effects, effect) ||
    !choice(incidentCategories, category) ||
    !choice(severities, severity) ||
    typeof published !== "boolean"
  )
    return null;
  if (
    station !== null &&
    (!isStation(station) || stationById.get(station)?.line !== line)
  )
    return null;
  if (
    endStation !== null &&
    (!isStation(endStation) ||
      stationById.get(endStation)?.line !== line ||
      !station ||
      station === endStation)
  )
    return null;
  if (effect === "line-suspension" && station) return null;
  if (effect === "station-closure" && (!station || endStation)) return null;
  if (effect === "segment-closure" && (!station || !endStation)) return null;
  if (effect === "accessibility" && endStation) return null;
  if (
    expiresAt !== null &&
    (typeof expiresAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expiresAt) ||
      !Number.isFinite(Date.parse(expiresAt)) ||
      Date.parse(expiresAt) <= Date.now())
  )
    return null;
  return {
    line,
    station,
    endStation,
    effect,
    category,
    severity,
    published,
    expiresAt,
    title,
    description,
  };
}

export function parseReport(body: Fields): ReportInput | null {
  const { station, endStation = null, category, severity = "info" } = body;
  const description = textField(body.description ?? "", 600);
  if (
    !isStation(station) ||
    !choice(reportCategories, category) ||
    !choice(severities, severity) ||
    description === null
  )
    return null;
  if (
    endStation !== null &&
    (!isStation(endStation) ||
      endStation === station ||
      stationById.get(endStation)?.line !== stationById.get(station)?.line)
  )
    return null;
  return { station, endStation, category, description, severity };
}
