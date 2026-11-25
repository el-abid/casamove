import type { NextRequest } from "next/server";

import { markSignalRead } from "@/lib/agent/signals";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const signalId = Number(id);

  if (!Number.isInteger(signalId) || signalId <= 0) {
    return Response.json({ error: "invalid_signal" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const sessionId =
    typeof body?.sessionId === "string" && body.sessionId.length > 4
      ? body.sessionId
      : null;
  const user = await getCurrentUser();

  if (!user && !sessionId) {
    return Response.json({ error: "session_required" }, { status: 400 });
  }

  const read = await markSignalRead(signalId, {
    userId: user?.id ?? null,
    sessionId,
  });

  if (!read) {
    return Response.json({ error: "delivery_not_found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
