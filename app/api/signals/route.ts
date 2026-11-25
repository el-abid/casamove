import type { NextRequest } from "next/server";

import {
  createSignal,
  listSignals,
  recordSignalDeliveries,
  type SignalKind,
  type SignalPayload,
  type SignalSeverity,
} from "@/lib/agent/signals";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCALES = ["fr", "ar", "en"] as const;
const SEVERITIES: SignalSeverity[] = ["info", "warning", "critical"];

function parsePayload(value: unknown): SignalPayload | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  const parsed = {} as SignalPayload;

  for (const locale of LOCALES) {
    const item = payload[locale];
    if (!item || typeof item !== "object") return null;
    const { title, body } = item as { title?: unknown; body?: unknown };
    if (typeof title !== "string" || typeof body !== "string") return null;
    if (title.trim().length < 3 || title.trim().length > 120) return null;
    if (body.trim().length < 5 || body.trim().length > 600) return null;
    parsed[locale] = { title: title.trim(), body: body.trim() };
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const since = request.nextUrl.searchParams.get("since") ?? undefined;
  const scope = request.nextUrl.searchParams.get("scope");
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const user = await getCurrentUser();
  const includeAll = scope === "all" && isAdmin(user);

  const signals = await listSignals(since, {
    userId: user?.id ?? null,
    sessionId,
    includeAll,
  });

  if (!includeAll) {
    await recordSignalDeliveries(signals, {
      userId: user?.id ?? null,
      sessionId,
    });
  }

  return Response.json({ signals });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  if (body?.kind === "renewal") {
    return Response.json({ error: "renewal_automated" }, { status: 400 });
  }

  const kind: SignalKind = body?.kind === "info" ? "info" : "disruption";
  const line =
    typeof body?.line === "string" && body.line ? body.line : "ligne 1";
  const severity: SignalSeverity = SEVERITIES.includes(body?.severity)
    ? body.severity
    : kind === "disruption"
      ? "warning"
      : "info";
  const payload = body?.payload ? parsePayload(body.payload) : null;

  if (body?.payload && !payload) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const signal = await createSignal(kind, line, {
    payload: payload ?? undefined,
    severity,
    createdBy: { id: user.id, email: user.email },
  });

  return Response.json({ signals: [signal], count: 1, signal });
}
