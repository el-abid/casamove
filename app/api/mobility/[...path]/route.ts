import { getCurrentUser, isAdmin } from "@/lib/auth/session";
import {
  findStations,
  lines,
  network,
  stationById,
} from "@/lib/mobility/network";
import { planJourney } from "@/lib/mobility/routing";
import {
  choice,
  isId,
  isStation,
  parseIncident,
  parsePlan,
  parseReport,
  textField,
} from "@/lib/mobility/inputs";
import { reportStatuses } from "@/lib/mobility/categories";
import {
  completeJourney,
  createReport,
  editSaved,
  moderateReport,
  networkStatus,
  passengerSpace,
  readNotices,
  towerOverview,
  writeFavourite,
  writeIncident,
  writePreferences,
  writeSaved,
} from "@/lib/mobility/store";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const error = (code: string, status: number) => json({ error: code }, status);

async function data(request: Request): Promise<Record<string, unknown> | null> {
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let bytes = 0;
  let raw = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        return null;
      }
      raw += decoder.decode(value, { stream: true });
    }
    const value: unknown = JSON.parse(raw + decoder.decode());
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: Context) {
  const path = (await params).path;
  const endpoint = path.join("/");
  try {
    if (endpoint === "network") return json(network);
    if (endpoint === "lines") return json(lines);
    if (endpoint === "network/status" || endpoint === "disruptions")
      return json(await networkStatus());
    if (endpoint === "stations") {
      const query = new URL(request.url).searchParams.get("q") ?? "";
      return query.length <= 100
        ? json(findStations(query, 151))
        : error("invalid-input", 400);
    }
    if (path.length === 2 && path[0] === "stations") {
      const station = stationById.get(path[1]);
      return station ? json(station) : error("not-found", 404);
    }
    const user = await getCurrentUser();
    if (!user) return error("sign-in", 401);
    if (endpoint === "tower")
      return isAdmin(user)
        ? json(await towerOverview())
        : error("forbidden", 403);
    if (
      ["space", "routes/saved", "reports", "notifications"].includes(endpoint)
    ) {
      const space = await passengerSpace(user.id);
      if (endpoint === "routes/saved") return json(space.saved);
      if (endpoint === "reports") return json(space.reports);
      if (endpoint === "notifications") return json(space.notices);
      return json(space);
    }
    return error("not-found", 404);
  } catch {
    return error("service-unavailable", 503);
  }
}

async function mutate(request: Request, { params }: Context) {
  const endpoint = (await params).path.join("/");
  const body = await data(request);
  if (!body) return error("invalid-input", 400);
  const method = request.method;
  if (
    method === "POST" &&
    (endpoint === "routes/plan" || endpoint === "routes/recalculate")
  ) {
    const plan = parsePlan(body);
    if (!plan) return error("invalid-input", 400);
    const status = await networkStatus();
    return json({
      ...planJourney(plan, status.incidents),
      networkVersion: status.version,
      source: status.source,
      estimated: true,
    });
  }
  const user = await getCurrentUser();
  if (!user) return error("sign-in", 401);
  const admin = isAdmin(user);
  if (endpoint === "disruptions" && method === "POST") {
    if (!admin) return error("forbidden", 403);
    const incident = parseIncident(body);
    return incident
      ? json(await writeIncident(user.id, incident), 201)
      : error("invalid-input", 400);
  }
  const target = /^(disruptions|reports|routes\/saved)\/(\d+)$/.exec(endpoint);
  if (target && (method === "PATCH" || method === "DELETE")) {
    const [, type, rawId] = target;
    const id = Number(rawId);
    if (!isId(id)) return error("invalid-input", 400);
    if (type === "routes/saved") {
      const name = textField(body.name, 60);
      if (method === "PATCH" && (!name || typeof body.notify !== "boolean"))
        return error("invalid-input", 400);
      const updated = await editSaved(
        user.id,
        id,
        method === "DELETE"
          ? null
          : { name: name!, notify: body.notify === true }
      );
      return updated ? json({ id }) : error("not-found", 404);
    }
    if (!admin) return error("forbidden", 403);
    if (method !== "PATCH" || !isId(body.revision))
      return error("invalid-input", 400);
    if (type === "disruptions") {
      const incident = parseIncident(body);
      if (!incident && body.action !== "resolve")
        return error("invalid-input", 400);
      const updated = await writeIncident(
        user.id,
        body.action === "resolve" ? null : incident,
        id,
        body.revision
      );
      return updated ? json(updated) : error("conflict", 409);
    }
    const { status, incidentId = null } = body;
    if (
      !choice(reportStatuses, status) ||
      (incidentId !== null && !isId(incidentId))
    )
      return error("invalid-input", 400);
    const report = await moderateReport(
      user.id,
      id,
      body.revision,
      status,
      incidentId
    );
    return report ? json(report) : error("conflict", 409);
  }
  if (method === "POST" && endpoint === "reports") {
    const report = parseReport(body);
    if (!report) return error("invalid-input", 400);
    const result = await createReport(user.id, report);
    return result
      ? json(result, result.duplicate ? 200 : 201)
      : error("rate-limit", 429);
  }
  if (method === "POST" && endpoint === "routes/saved") {
    const plan = parsePlan(body);
    const name = textField(body.name, 60);
    if (!plan || !name || planJourney(plan, [], 1).status !== "ok")
      return error("invalid-input", 400);
    const id = await writeSaved(user.id, plan, name, body.notify !== false);
    return id ? json({ id }, 201) : error("limit", 409);
  }
  if (method === "POST" && endpoint === "favourites") {
    if (!isStation(body.station) || typeof body.add !== "boolean")
      return error("invalid-input", 400);
    await writeFavourite(user.id, body.station, body.add);
    return json({ ok: true });
  }
  if (method === "PATCH" && endpoint === "preferences") {
    const { accessibility, history, notifications, language = null } = body;
    if (
      typeof accessibility !== "boolean" ||
      typeof history !== "boolean" ||
      typeof notifications !== "boolean" ||
      (language !== null && !choice(["fr", "ar", "en"] as const, language))
    )
      return error("invalid-input", 400);
    await writePreferences(user.id, {
      accessibility,
      history,
      notifications,
      language,
    });
    return json({ ok: true });
  }
  if (method === "POST" && endpoint === "journeys/complete") {
    const plan = parsePlan(body);
    const { key } = body;
    if (
      !plan ||
      plan.from === plan.to ||
      typeof key !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        key
      )
    )
      return error("invalid-input", 400);
    await completeJourney(user.id, plan, key);
    return json({ ok: true });
  }
  if (method === "PATCH" && endpoint === "notifications") {
    const { ids = null } = body;
    if (
      ids !== null &&
      (!Array.isArray(ids) ||
        ids.length > 150 ||
        !ids.every(
          (id): id is string => typeof id === "string" && id.length < 128
        ))
    )
      return error("invalid-input", 400);
    await readNotices(user.id, ids);
    return json({ ok: true });
  }
  return error("not-found", 404);
}

async function guardedMutation(request: Request, context: Context) {
  try {
    return await mutate(request, context);
  } catch {
    return error("service-unavailable", 503);
  }
}

export {
  guardedMutation as POST,
  guardedMutation as PATCH,
  guardedMutation as DELETE,
};
